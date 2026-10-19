// View / like / share counters and the "popular" list for articles, stored in Upstash Redis (Vercel
// Marketplace). Without the Redis env vars it answers { enabled: false } and the pages show 0s,
// local likes and newest-first "popular" articles.
//   GET  /api/stats?slugs=a,b,c      -> { enabled, stats: { a: {views, likes, shares}, ... } }
//   GET  /api/stats?popular=4        -> { enabled, popular: [slug, ...] }   (most viewed first)
//   POST /api/stats {slug, action}   -> action: "view" | "like" | "unlike" | "share"; returns that slug's counts

const URL_ENV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEYS = { views: 'ins:article:views', likes: 'ins:article:likes', shares: 'ins:article:shares' };
const SLUG = /^[a-z0-9-]{3,80}$/;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function redis(commands) {
  const res = await fetch(`${URL_ENV}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN_ENV}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

async function counts(slugs) {
  const commands = slugs.flatMap((slug) => [['ZSCORE', KEYS.views, slug], ['ZSCORE', KEYS.likes, slug], ['ZSCORE', KEYS.shares, slug]]);
  const results = await redis(commands);
  return Object.fromEntries(slugs.map((slug, i) => [slug, {
    views: Number(results[i * 3]) || 0,
    likes: Math.max(0, Number(results[i * 3 + 1]) || 0),
    shares: Number(results[i * 3 + 2]) || 0,
  }]));
}

export async function GET(request) {
  if (!URL_ENV || !TOKEN_ENV) return json({ enabled: false });
  const params = new URL(request.url).searchParams;
  try {
    if (params.has('popular')) {
      const n = Math.min(Math.max(Number(params.get('popular')) || 4, 1), 20);
      const [popular] = await redis([['ZREVRANGE', KEYS.views, 0, n + 5]]);
      return json({ enabled: true, popular: popular || [] });
    }
    const slugs = (params.get('slugs') || params.get('slug') || '').split(',').filter((s) => SLUG.test(s)).slice(0, 20);
    if (!slugs.length) return json({ error: 'bad slug' }, 400);
    return json({ enabled: true, stats: await counts(slugs) });
  } catch {
    return json({ enabled: false });
  }
}

export async function POST(request) {
  if (!URL_ENV || !TOKEN_ENV) return json({ enabled: false });
  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const { slug = '', action = '' } = body || {};
  const change = { view: ['views', 1], like: ['likes', 1], unlike: ['likes', -1], share: ['shares', 1] }[action];
  if (!SLUG.test(slug) || !change) return json({ error: 'bad request' }, 400);
  try {
    await redis([['ZINCRBY', KEYS[change[0]], change[1], slug]]);
    return json({ enabled: true, ...(await counts([slug]))[slug] });
  } catch {
    return json({ enabled: false });
  }
}
