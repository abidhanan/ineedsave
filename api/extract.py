"""Extract downloadable media from a social media URL.

Uses yt-dlp for video/audio (1000+ sites) and falls back to gallery-dl for
image posts. Every option is returned as a signed /api/download token, so the
download function only ever fetches URLs produced here.

Token modes (handled by api/download.js):
  direct - stream one file as-is
  merge  - combine a video-only and an audio-only stream (ffmpeg, no re-encode)
  remux  - turn an HLS stream into a single MP4 (ffmpeg, no re-encode)
  mp3    - convert the audio track to MP3 (ffmpeg)

Optional residential proxy (env PROXY_URL, e.g. http://user:pass@host:port).
A "{session}" placeholder in it is replaced with a random id per request so the
provider keeps the same exit IP for extraction and download; YouTube media URLs
only work from the IP that extracted them. Only the session id is put in the
token, never the proxy credentials.
"""

import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import time
import zlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Vercel's filesystem is read-only except /tmp.
os.environ.setdefault("HOME", "/tmp")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp")

import yt_dlp  # noqa: E402

TOKEN_TTL = 6 * 60 * 60
MAX_ENTRIES = 30
MAX_VIDEO_OPTIONS = 8
AUDIO_EXTS = {"mp3", "m4a", "aac", "ogg", "opus", "wav", "flac", "weba"}
IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "heic", "avif"}
VIDEO_EXTS = {"mp4", "webm", "mov", "m4v", "mkv"}
FORWARD_HEADERS = {"user-agent", "referer", "origin", "cookie", "accept"}

# Sites that block datacenter IPs outright: go through the proxy straight away.
PROXY_FIRST_HOSTS = ("youtube.com", "youtu.be", "reddit.com", "redd.it", "vimeo.com")
# Media hosts whose URLs are bound to the extracting IP, so downloads must use the proxy too.
PROXY_MEDIA_HOSTS = ("googlevideo.com",)
BLOCKED_HINTS = ("not a bot", "login", "logged-in", "authenticat", "cookies", "429", "rate", "403", "blocked")


class ExtractError(Exception):
    pass


# ---------------------------------------------------------------- signing

def _secret():
    secret = os.environ.get("SIGNING_SECRET")
    if not secret:
        raise ExtractError("server_config")
    return secret.encode()


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def source(url, headers=None):
    return {
        "u": url,
        "h": {k: v for k, v in (headers or {}).items() if k.lower() in FORWARD_HEADERS and v},
    }


def sign(mode, inputs, filename, size=None):
    payload = {"m": mode, "i": inputs, "n": filename, "e": int(time.time()) + TOKEN_TTL}
    if size:
        payload["z"] = int(size)  # estimated output bytes
    body = _b64(zlib.compress(json.dumps(payload, separators=(",", ":")).encode(), 9))
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"/api/download?t={body}.{sig}"


# ---------------------------------------------------------------- proxy

def proxy_url(session):
    template = os.environ.get("PROXY_URL", "").strip()
    return template.replace("{session}", session) if template and session else None


def host_matches(url, hosts):
    host = (urlparse(url).hostname or "").lower()
    return any(host == h or host.endswith("." + h) for h in hosts)


# ---------------------------------------------------------------- helpers

def safe_name(title, ext, suffix=""):
    name = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", title or "media")
    name = re.sub(r"\s+", " ", name).strip(" .")[:80] or "media"
    if suffix:
        name = f"{name} ({suffix})"
    return f"{name}.{ext or 'bin'}"


def transport(fmt):
    """'direct', 'hls' or None when the format can't be fetched by the proxy."""
    url = fmt.get("url") or ""
    if not url.startswith("http") or fmt.get("ext") in ("mhtml", "mpd"):
        return None
    proto = (fmt.get("protocol") or "https").lower()
    if "m3u8" in proto:
        return "hls"
    if proto in ("http", "https"):
        return "direct"
    return None


def size_of(fmt):
    return fmt.get("filesize") or fmt.get("filesize_approx")


def ext_of(fmt, default="bin"):
    return (fmt.get("ext") or default).lower()


def kind_of(fmt):
    vcodec, acodec, ext = fmt.get("vcodec"), fmt.get("acodec"), ext_of(fmt, "")
    if ext in IMAGE_EXTS:
        return "image"
    if vcodec == "none" or (vcodec is None and ext in AUDIO_EXTS) or fmt.get("resolution") == "audio only":
        return "audio"
    return "muxed" if acodec != "none" else "video"


def is_watermarked(fmt):
    text = f"{fmt.get('format_note') or ''} {fmt.get('format_id') or ''}".lower()
    return "watermark" in text and "no watermark" not in text


def add_sizes(*fmts):
    sizes = [size_of(f) for f in fmts]
    return sum(sizes) if all(sizes) else None


# ---------------------------------------------------------------- yt-dlp

class Builder:
    def __init__(self, ydl, info, session=None):
        self.ydl = ydl
        self.info = info
        self.session = session
        self.title = info.get("title") or info.get("id") or "media"
        formats = info.get("formats") or ([info] if info.get("url") else [])
        self.formats = [f for f in formats if transport(f) and not self.needs_proxy_hls(f)]

    def needs_proxy_hls(self, fmt):
        # HLS segments would have to go through the proxy too, which ffmpeg can't do reliably.
        return bool(self.session) and transport(fmt) == "hls" and host_matches(fmt["url"], PROXY_MEDIA_HOSTS)

    def src(self, fmt):
        headers = dict(fmt.get("http_headers") or self.base_headers())
        try:
            cookies = self.ydl.cookiejar.get_cookie_header(fmt["url"])
        except Exception:
            cookies = None
        if cookies:
            headers["Cookie"] = cookies
        src = source(fmt["url"], headers)
        if self.session and host_matches(fmt["url"], PROXY_MEDIA_HOSTS):
            src["p"] = self.session
        chunk = (fmt.get("downloader_options") or {}).get("http_chunk_size")
        if chunk:
            src["c"] = int(chunk)  # host rejects large single requests (YouTube)
        return src

    def estimate(self, *fmts):
        """Bytes for the given formats, from the reported size or bitrate x duration."""
        total = 0
        for fmt in fmts:
            size = size_of(fmt) or (fmt.get("tbr") or 0) * 125 * (self.info.get("duration") or 0)
            if not size:
                return None
            total += size
        return int(total)

    def base_headers(self):
        return {"User-Agent": (self.ydl.params.get("http_headers") or {}).get("User-Agent")}

    def best_audio(self, prefer_ext=None):
        audios = [f for f in self.formats if kind_of(f) == "audio"]
        if not audios:
            return None

        def score(f):
            return (
                transport(f) == "direct",
                prefer_ext is not None and ext_of(f) in prefer_ext,
                f.get("abr") or f.get("tbr") or 0,
            )
        return max(audios, key=score)

    def video_options(self):
        best = {}  # quality key -> (rank, option)

        def offer(key, rank, option):
            if key not in best or rank > best[key][0]:
                best[key] = (rank, option)

        audio_mp4 = self.best_audio(prefer_ext={"m4a", "mp4", "aac"})
        audio_webm = self.best_audio(prefer_ext={"webm", "opus", "weba"})

        for fmt in self.formats:
            kind = kind_of(fmt)
            if kind not in ("muxed", "video"):
                continue
            width, height = fmt.get("width") or 0, fmt.get("height") or 0
            height = min(width, height) if width and height else height  # vertical videos: 1080x1920 -> 1080p
            key = height or self.unknown_label(fmt)
            quality = f"{height}p" if height else key
            ext = ext_of(fmt, "mp4")
            if ext not in VIDEO_EXTS:
                ext = "mp4"
            watermark = is_watermarked(fmt)
            note = "@watermark" if watermark else ""
            via = transport(fmt)
            h264 = (fmt.get("vcodec") or "").startswith(("avc", "h264"))  # plays on every phone
            pref = (not watermark, ext == "mp4", h264, via == "direct", fmt.get("tbr") or 0, size_of(fmt) or 0)

            if kind == "muxed" and via == "direct":
                option = self.option("video", quality, ext, size_of(fmt), note,
                                     sign("direct", [self.src(fmt)], safe_name(self.title, ext, quality)))
                offer(key, (3,) + pref, option)
            elif kind == "muxed":
                option = self.option("video", quality, "mp4", size_of(fmt), note,
                                     sign("remux", [self.src(fmt)], safe_name(self.title, "mp4", quality),
                                          self.estimate(fmt)))
                offer(key, (1,) + pref, option)
            else:
                audio = audio_webm if ext == "webm" and audio_webm and ext_of(audio_webm) in ("webm", "weba") else audio_mp4
                if audio:
                    out = "webm" if ext == "webm" and ext_of(audio) in ("webm", "weba") else "mp4"
                    option = self.option("video", quality, out, add_sizes(fmt, audio), note,
                                         sign("merge", [self.src(fmt), self.src(audio)],
                                              safe_name(self.title, out, quality), self.estimate(fmt, audio)))
                    offer(key, (2,) + pref, option)
                elif via == "direct":
                    option = self.option("video", quality, ext, size_of(fmt), "@no_audio",
                                         sign("direct", [self.src(fmt)], safe_name(self.title, ext, quality)))
                    offer(key, (0,) + pref, option)

        # Silent video is only worth offering when nothing with sound exists.
        if any(rank[0] > 0 for rank, _ in best.values()):
            best = {k: v for k, v in best.items() if v[0][0] > 0}
        # Unlabelled variants (no resolution, no name) are usually duplicates of a known quality.
        if any(isinstance(k, int) for k in best):
            best = {k: v for k, v in best.items() if not (isinstance(k, str) and k.startswith("#"))}

        named = {"UHD": 4, "FHD": 3, "HD": 2, "SD": 1}
        ordered = sorted(best.items(), key=lambda kv: (
            isinstance(kv[0], int), kv[0] if isinstance(kv[0], int) else named.get(kv[0], 0), kv[1][0]), reverse=True)
        options = [opt for _, (_, opt) in ordered[:MAX_VIDEO_OPTIONS]]
        unnamed = [o for o in options if o["quality"].startswith("#")]
        for i, opt in enumerate(unnamed, 1):
            opt["quality"] = "@video" if len(unnamed) == 1 else f"@video:{i}"
        return options

    @staticmethod
    def unknown_label(fmt):
        note = (fmt.get("format_note") or "").strip()
        if note and "dash" not in note.lower() and len(note) <= 12:
            return note.upper() if len(note) <= 3 else note
        fid = str(fmt.get("format_id") or "")
        if fid.lower() in ("sd", "hd", "fhd", "uhd"):
            return fid.upper()
        return f"#{fid}"  # placeholder, renamed to "Video N" once options are ranked

    def audio_options(self):
        options = []
        audio = self.best_audio(prefer_ext={"m4a", "mp3", "aac"})
        if audio:
            ext = ext_of(audio, "m4a")
            abr = int(audio.get("abr") or 0)
            if transport(audio) == "direct":
                options.append(self.option("audio", f"{abr} kbps" if abr else "@original_audio", ext, size_of(audio), "@original_quality",
                                           sign("direct", [self.src(audio)], safe_name(self.title, ext))))
            if ext != "mp3":
                options.append(self.option("audio", "MP3", "mp3", None, "192 kbps",
                                           sign("mp3", [self.src(audio)], safe_name(self.title, "mp3"),
                                                self.estimate(audio))))
            return options

        muxed = [f for f in self.formats if kind_of(f) == "muxed"]
        if muxed:
            # No separate audio track (TikTok, Instagram, Facebook...): pull it out of the smallest video.
            fmt = min(muxed, key=lambda f: (transport(f) != "direct", size_of(f) or f.get("tbr") or 0))
            options.append(self.option("audio", "MP3", "mp3", None, "192 kbps",
                                       sign("mp3", [self.src(fmt)], safe_name(self.title, "mp3"),
                                            self.estimate(fmt))))
        return options

    def image_options(self, has_av):
        options = []
        for fmt in self.formats:
            if kind_of(fmt) == "image":
                ext = ext_of(fmt, "jpg")
                options.append(self.option("image", "@photo", ext, size_of(fmt), "",
                                           sign("direct", [self.src(fmt)], safe_name(self.title, ext))))
        thumb = best_thumbnail(self.info)
        if thumb:
            ext = thumb_ext(thumb)
            options.append(self.option("image", "@thumbnail" if has_av else "@photo", ext, None, "",
                                       sign("direct", [source(thumb, self.base_headers())],
                                            safe_name(self.title, ext, "thumbnail" if has_av else ""))))
        return options

    @staticmethod
    def option(kind, quality, ext, size, note, url):
        return {"type": kind, "quality": quality, "ext": ext, "size": size, "note": note, "url": url}

    def build(self):
        videos = self.video_options()
        audios = self.audio_options()
        return videos + audios + self.image_options(bool(videos or audios))


def best_thumbnail(info):
    if info.get("extractor_key") == "Youtube" and info.get("id"):
        # maxresdefault is listed for every video but often 404s on older uploads.
        return f"https://i.ytimg.com/vi/{info['id']}/hqdefault.jpg"
    thumbs = [t for t in (info.get("thumbnails") or []) if (t.get("url") or "").startswith("http")]
    if thumbs:
        thumbs.sort(key=lambda t: (t.get("preference") or 0, (t.get("width") or 0) * (t.get("height") or 0)))
        return thumbs[-1]["url"]
    return info.get("thumbnail")


def thumb_ext(url):
    path = urlparse(url).path.lower()
    for ext in ("png", "webp", "gif", "jpeg", "jpg"):
        if path.endswith("." + ext):
            return ext
    return "jpg"


def make_item(ydl, info, platform, session=None):
    builder = Builder(ydl, info, session)
    options = builder.build()
    if not options:
        return None
    thumb = best_thumbnail(info)
    return {
        "title": info.get("title") or info.get("description") or info.get("id") or "Media",
        "uploader": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
        "duration": info.get("duration"),
        "platform": platform,
        "thumbnail": sign("direct", [source(thumb, builder.base_headers())], "thumbnail.jpg") if thumb else None,
        "options": options,
    }


def flatten(info):
    if info.get("_type") in ("playlist", "multi_video"):
        for entry in info.get("entries") or []:
            if entry:
                yield from flatten(entry)
    else:
        yield info


class _SilentLogger:
    def debug(self, msg):
        pass

    info = warning = error = debug


def extract_ytdlp(url, session=None):
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "playlistend": MAX_ENTRIES,
        "socket_timeout": 20,
        "cachedir": False,
        "noprogress": True,
        "logger": _SilentLogger(),
    }
    if session:
        opts["proxy"] = proxy_url(session)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.sanitize_info(ydl.extract_info(url, download=False))
        platform = info.get("extractor_key") or info.get("extractor") or ""
        items = []
        for entry in flatten(info):
            item = make_item(ydl, entry, entry.get("extractor_key") or platform, session)
            if item:
                items.append(item)
            if len(items) >= MAX_ENTRIES:
                break
        return platform, items


# ---------------------------------------------------------------- gallery-dl

def extract_gallery(url, session=None):
    from gallery_dl import config, job

    config.clear()
    if session:
        config.set(("extractor",), "proxy", proxy_url(session))
    config.set(("cache",), "file", None)
    config.set(("extractor",), "timeout", 20)
    config.set(("output",), "mode", "null")

    try:
        data_job = job.DataJob(url, file=io.StringIO())
    except Exception:
        return "", []
    data_job.run()
    if not data_job.data_urls:
        if data_job.exception:
            raise ExtractError(str(data_job.exception))
        return "", []

    extractor = data_job.extractor
    session = getattr(extractor, "session", None)
    user_agent = session.headers.get("User-Agent") if session is not None else None
    headers = {"User-Agent": user_agent, "Referer": getattr(extractor, "root", None)}
    platform = (getattr(extractor, "category", "") or "").capitalize()

    groups = {}
    for media_url, meta in zip(data_job.data_urls, data_job.data_meta):
        if not media_url.startswith("http"):
            continue
        ext = (meta.get("extension") or thumb_ext(media_url)).lower()
        raw_title = str(meta.get("title") or meta.get("description") or meta.get("content") or "").strip()
        title = raw_title.splitlines()[0][:120] if raw_title else (meta.get("filename") or "media")
        post_id = meta.get("post_id") or meta.get("tweet_id") or meta.get("id") or "post"
        group = groups.setdefault(post_id, {
            "title": title,
            "uploader": _author(meta),
            "duration": None,
            "platform": platform,
            "thumbnail": None,
            "options": [],
        })
        num = len(group["options"]) + 1
        kind = "video" if ext in VIDEO_EXTS else ("audio" if ext in AUDIO_EXTS else "image")
        src = source(media_url, headers)
        if kind == "image" and not group["thumbnail"]:
            group["thumbnail"] = sign("direct", [src], "thumbnail." + ext)
        label = {"image": "photo", "video": "video", "audio": "audio"}[kind]
        group["options"].append(Builder.option(
            kind, f"@{label}:{num}", ext, meta.get("filesize") or None,
            f"{meta['width']}×{meta['height']}" if meta.get("width") and meta.get("height") else "",
            sign("direct", [src], safe_name(title, ext, str(num))),
        ))
    return platform, list(groups.values())[:MAX_ENTRIES]


def _author(meta):
    for key in ("author", "user", "owner", "uploader"):
        val = meta.get(key)
        if isinstance(val, dict):
            val = val.get("name") or val.get("username") or val.get("nick")
        if isinstance(val, str) and val:
            return val
    return meta.get("username")


# ---------------------------------------------------------------- main

def friendly_error(message):
    """Maps an extractor error to a code; public/i18n/*.json holds the message per language."""
    msg = message.lower()
    if "unsupported url" in msg or "no suitable" in msg:
        return "unsupported"
    if "not a bot" in msg:
        return "blocked"
    if "429" in msg or "rate-limit" in msg or "rate limit" in msg:
        return "rate_limited"
    if "private" in msg or "login" in msg or "logged-in" in msg or "cookies" in msg or "authenticat" in msg:
        return "login_required"
    if "not available" in msg or "removed" in msg or "404" in msg or "does not exist" in msg:
        return "not_found"
    if "geo" in msg or "country" in msg:
        return "geo_blocked"
    return "failed"


def extract(url):
    url = (url or "").strip()
    match = re.search(r"https?://\S+", url)
    url = match.group(0) if match else url  # accept pasted share text like "Check this out https://..."
    parsed = urlparse(url if "://" in url else "https://" + url)
    if parsed.scheme not in ("http", "https") or "." not in (parsed.hostname or ""):
        raise ExtractError("invalid_url")
    url = parsed.geturl()

    has_proxy = bool(os.environ.get("PROXY_URL", "").strip())
    if has_proxy and host_matches(url, PROXY_FIRST_HOSTS):
        attempts = [(extract_ytdlp, True)]
    else:
        attempts = [(extract_ytdlp, False), (extract_gallery, False)]

    errors = []
    while attempts:
        extractor, use_proxy = attempts.pop(0)
        try:
            platform, items = extractor(url, secrets.token_hex(4) if use_proxy else None)
            if items:
                return {"platform": platform, "items": items}
        except Exception as exc:
            if str(exc) == "server_config":
                raise
            errors.append(str(exc))
        # Blocked from the datacenter IP (Instagram login wall, rate limits...): retry once via the proxy.
        if not attempts and has_proxy and not use_proxy and any(h in " ".join(errors).lower() for h in BLOCKED_HINTS):
            attempts = [(extract_ytdlp, True), (extract_gallery, True)]

    if errors:
        raise ExtractError(friendly_error(" ".join(errors)))
    raise ExtractError("no_media")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        self._respond((query.get("url") or [""])[0])

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length") or 0)
            body = json.loads(self.rfile.read(min(length, 8192)) or b"{}")
        except Exception:
            body = {}
        self._respond(body.get("url", "") if isinstance(body, dict) else "")

    def _respond(self, url):
        try:
            status, payload = 200, extract(url)
        except ExtractError as exc:
            status, payload = 422, {"error": str(exc)}
        except Exception:
            status, payload = 500, {"error": "server_error"}
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
