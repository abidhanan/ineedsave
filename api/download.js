// Streams a media file produced by /api/extract to the browser as a download.
// Only URLs carried by a valid signed token are fetched, so this is not an open proxy.
//
// Source fields in the token: u = url, h = request headers,
// p = proxy session id (route through PROXY_URL), c = chunk size (fetch in Range chunks).

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { inflateSync } from 'node:zlib';
import ffmpegPath from 'ffmpeg-static';
import { fetch as proxyFetch, ProxyAgent } from 'undici';

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
const MIME = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg' };
// Processed files are first written to /tmp so they get a real duration and index (gallery
// apps show 00:00 for streamed fragmented MP4). Bigger outputs fall back to streaming.
const FILE_OUTPUT_LIMIT = 400 * 1024 * 1024;

function verify(token) {
  const secret = process.env.SIGNING_SECRET;
  const [body, sig] = (token || '').split('.');
  if (!secret || !body || !sig) return null;

  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const payload = JSON.parse(inflateSync(Buffer.from(body, 'base64url')).toString('utf8'));
  if (!payload.e || payload.e * 1000 < Date.now()) return null;
  return payload;
}

// Sources marked with a session id must leave through the same proxy exit IP that
// extracted them. The proxy credentials stay in the env, never in the token.
function proxyFor(src) {
  const template = (process.env.PROXY_URL || '').trim();
  return src.p && template ? template.replaceAll('{session}', src.p) : null;
}

function fetcher(src) {
  const proxy = proxyFor(src);
  const dispatcher = proxy ? new ProxyAgent(proxy) : null;
  return (headers, signal) => {
    const init = { headers: { ...src.h, ...headers }, redirect: 'follow', signal };
    return dispatcher ? proxyFetch(src.u, { ...init, dispatcher }) : fetch(src.u, init);
  };
}

class UpstreamError extends Error {}

/**
 * Opens a source as { status, headers, body }. Sources with a chunk size are read as
 * consecutive Range requests (YouTube answers 403 to one big request for large files).
 * `range` is the browser's Range header, honoured so downloads can resume.
 */
async function openSource(src, signal, range) {
  const doFetch = fetcher(src);
  const asked = /^bytes=(\d+)-(\d*)$/.exec(range || '');

  if (!src.c) {
    const res = await doFetch(range ? { Range: range } : {}, signal);
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`);
    return { status: res.status, headers: res.headers, body: res.body };
  }

  const start = asked ? Number(asked[1]) : 0;
  const askedEnd = asked && asked[2] ? Number(asked[2]) : Infinity;
  const chunkEnd = (from, last) => Math.min(from + src.c - 1, last);

  const first = await doFetch({ Range: `bytes=${start}-${chunkEnd(start, askedEnd)}` }, signal);
  if (!first.ok) throw new UpstreamError(`HTTP ${first.status}`);
  const contentRange = /bytes (\d+)-(\d+)\/(\d+)/.exec(first.headers.get('content-range') || '');
  if (first.status !== 206 || !contentRange) {
    return { status: first.status, headers: first.headers, body: first.body }; // server ignored Range
  }

  const total = Number(contentRange[3]);
  const end = Math.min(askedEnd, total - 1);
  async function* chunks() {
    let res = first;
    let next = Number(contentRange[2]) + 1;
    for (;;) {
      for await (const part of res.body) yield part;
      if (next > end) return;
      const to = chunkEnd(next, end);
      res = await doFetch({ Range: `bytes=${next}-${to}` }, signal);
      if (res.status !== 206) throw new UpstreamError(`HTTP ${res.status} on chunk ${next}`);
      next = to + 1;
    }
  }

  const headers = new Headers({
    'content-type': first.headers.get('content-type') || 'application/octet-stream',
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes',
  });
  if (asked) headers.set('content-range', `bytes ${start}-${end}/${total}`);
  return { status: asked ? 206 : 200, headers, body: ReadableStream.from(chunks()) };
}

function disposition(filename, inline) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function fail(status, message) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function direct(payload, request, inline) {
  let upstream;
  try {
    upstream = await openSource(payload.i[0], request.signal, request.headers.get('range'));
  } catch (err) {
    console.error('direct failed:', err.message);
    return fail(502, 'Could not fetch the file from the source.');
  }

  const out = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set('content-disposition', disposition(payload.n, inline));
  out.set('cache-control', inline ? 'public, max-age=3600' : 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

function urlInputArgs(src) {
  const args = ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-rw_timeout', '30000000'];
  const { 'User-Agent': ua, 'user-agent': ua2, ...rest } = src.h || {};
  if (ua || ua2) args.push('-user_agent', ua || ua2);
  const extra = Object.entries(rest).map(([k, v]) => `${k}: ${v}\r\n`).join('');
  if (extra) args.push('-headers', extra);
  return [...args, '-i', src.u];
}

// Writes a source into one of ffmpeg's extra stdin pipes.
async function feed(src, sink, signal) {
  sink.on('error', () => {}); // ffmpeg may close the pipe early; that's reported via its exit
  try {
    const { body } = await openSource(src, signal);
    await pipeline(Readable.fromWeb(body), sink);
  } catch (err) {
    if (!signal.aborted) console.error('input failed:', err.message);
    sink.destroy();
  }
}

/** Starts ffmpeg for a merge/remux/mp3 job, writing to `target` (a file path or pipe:1). */
function runFfmpeg(payload, target, toFile, request) {
  const ext = payload.n.split('.').pop().toLowerCase();
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];

  // Proxied or chunked sources are fetched by Node and piped in (fd 3, 4, ...);
  // anything else is opened by ffmpeg itself, which also handles HLS playlists.
  const piped = [];
  for (const src of payload.i) {
    if (src.p || src.c) {
      args.push('-i', `pipe:${3 + piped.length}`);
      piped.push(src);
    } else {
      args.push(...urlInputArgs(src));
    }
  }

  if (payload.m === 'merge') args.push('-map', '0:v:0', '-map', '1:a:0', '-c', 'copy');
  else if (payload.m === 'remux') args.push('-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy');
  else args.push('-vn', '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', '192k');

  if (ext === 'mp3') args.push('-f', 'mp3');
  else if (ext === 'webm') args.push('-f', 'webm');
  else {
    // HLS carries AAC as ADTS, which MP4 can't hold as-is; the filter is a no-op for regular AAC.
    if (payload.m !== 'mp3') args.push('-bsf:a', 'aac_adtstoasc');
    // A file gets a normal MP4 with its index up front; a pipe can only carry fragmented MP4.
    args.push('-movflags', toFile ? '+faststart' : 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4');
  }
  args.push(target);

  const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe', ...piped.map(() => 'pipe')] });
  const inputs = new AbortController();
  let stderr = '';
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-1000); });
  const kill = () => { if (child.exitCode === null) child.kill('SIGKILL'); };
  child.once('close', () => inputs.abort());
  request.signal?.addEventListener('abort', kill);
  piped.forEach((src, i) => feed(src, child.stdio[3 + i], inputs.signal));
  return { child, ext, kill, stderr: () => stderr };
}

function mediaHeaders(ext, filename, size) {
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-disposition': disposition(filename, false),
    'cache-control': 'no-store',
  };
  if (size) headers['content-length'] = String(size);
  return headers;
}

/** Normal case: finish the file in /tmp, then send it with its real length. Returns null if too big. */
async function transcodeToFile(payload, request) {
  const path = join(tmpdir(), `${randomUUID()}.${payload.n.split('.').pop().toLowerCase()}`);
  const cleanup = () => unlink(path).catch(() => {});
  const { child, ext, kill, stderr } = runFfmpeg(payload, path, true, request);

  // Guard /tmp: if the output outgrows the limit, stop and let the caller stream instead.
  let tooBig = false;
  const watch = setInterval(async () => {
    const size = await stat(path).then((s) => s.size, () => 0);
    if (size > FILE_OUTPUT_LIMIT) { tooBig = true; kill(); }
  }, 1000);
  const code = await new Promise((resolve) => {
    child.once('close', resolve);
    child.once('error', () => resolve(-1));
  });
  clearInterval(watch);

  if (tooBig) { await cleanup(); return null; }
  if (code !== 0) {
    await cleanup();
    if (!request.signal?.aborted) console.error('ffmpeg failed:', stderr());
    return fail(502, 'Could not process the media from the source.');
  }

  const { size } = await stat(path);
  const file = createReadStream(path);
  file.once('close', cleanup);
  return new Response(Readable.toWeb(file), { status: 200, headers: mediaHeaders(ext, payload.n, size) });
}

/** Fallback for very large outputs: stream while ffmpeg works (fragmented MP4). */
async function transcodeToStream(payload, request) {
  const { child, ext, kill, stderr } = runFfmpeg(payload, 'pipe:1', false, request);

  const stream = new ReadableStream({
    start(controller) {
      child.stdout.on('data', (chunk) => {
        controller.enqueue(new Uint8Array(chunk));
        if (controller.desiredSize <= 0) child.stdout.pause();
      });
      child.stdout.on('end', () => { try { controller.close(); } catch {} });
      child.on('error', (err) => { try { controller.error(err); } catch {} });
    },
    pull() { child.stdout.resume(); },
    cancel: kill,
  }, { highWaterMark: 8 });

  // Wait for the first bytes so an immediate ffmpeg failure becomes a proper error response.
  const started = await new Promise((resolve) => {
    child.stdout.once('data', () => resolve(true));
    child.once('close', () => resolve(false));
    child.once('error', () => resolve(false));
  });
  if (!started) {
    console.error('ffmpeg failed:', stderr());
    return fail(502, 'Could not process the media from the source.');
  }
  return new Response(stream, { status: 200, headers: mediaHeaders(ext, payload.n) });
}

async function transcode(payload, request) {
  if (!['merge', 'remux', 'mp3'].includes(payload.m)) return fail(400, 'Unknown mode.');
  if (!payload.z || payload.z <= FILE_OUTPUT_LIMIT) {
    const response = await transcodeToFile(payload, request);
    if (response) return response;
  }
  return transcodeToStream(payload, request);
}

// The page polls for this cookie to learn when the browser has started (or failed) the download.
function withSignal(response, key) {
  if (key) response.headers.append('set-cookie', `dl_${key}=${response.ok ? 1 : 0}; Path=/; Max-Age=120; SameSite=Lax`);
  return response;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const key = /^[a-z0-9]{6,20}$/.test(params.get('k') || '') ? params.get('k') : null;
  let payload;
  try {
    payload = verify(params.get('t'));
  } catch {
    payload = null;
  }
  if (!payload || !Array.isArray(payload.i) || !payload.i.length) {
    return withSignal(fail(403, 'This download link is invalid or has expired. Please process the link again.'), key);
  }
  const response = payload.m === 'direct'
    ? await direct(payload, request, params.get('inline') === '1')
    : await transcode(payload, request);
  return withSignal(response, key);
}
