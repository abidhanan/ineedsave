import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

function environment(overrides = {}) {
  return {
    ASSETS: {
      fetch(request) {
        return new Response(new URL(request.url).pathname);
      },
    },
    BACKEND_ORIGIN: 'https://ineedsave.vercel.app',
    ...overrides,
  };
}

test('redirects the old domain to ineedsave.com', async () => {
  const response = await worker.fetch(new Request('https://ineedsave.site/artikel/?x=1'), environment());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://ineedsave.com/artikel/?x=1');
});

test('redirects www to the canonical apex domain', async () => {
  const response = await worker.fetch(new Request('https://www.ineedsave.com/artikel/?x=1'), environment());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://ineedsave.com/artikel/?x=1');
});

test('serves a localized homepage from Accept-Language', async () => {
  const request = new Request('https://ineedsave.com/', {
    headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' },
  });
  const response = await worker.fetch(request, environment());
  assert.equal(await response.text(), '/_l/fr');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('serves translated article routes while preserving Indonesian routes', async () => {
  const translated = new Request('https://ineedsave.com/artikel/example/', {
    headers: { cookie: 'ins-lang=de' },
  });
  assert.equal(
    await (await worker.fetch(translated, environment())).text(),
    '/_l/de/artikel/example/index.html',
  );

  const indonesian = new Request('https://ineedsave.com/artikel/example/', {
    headers: { cookie: 'ins-lang=id' },
  });
  assert.equal(await (await worker.fetch(indonesian, environment())).text(), '/artikel/example/');
});

test('keeps stats disabled until Upstash secrets are configured', async () => {
  const response = await worker.fetch(
    new Request('https://ineedsave.com/api/stats?slug=example'),
    environment(),
  );
  assert.deepEqual(await response.json(), { enabled: false });
});
