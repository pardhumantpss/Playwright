import { test, expect } from '@playwright/test';

// HTTP-level checks on compression, caching and asset size.
//
// Tests marked test.fail() cover known issues from the 2026-09-25 audit. They pass while
// the issue exists. Once it is fixed, Playwright reports "expected to fail, but passed":
// remove the test.fail() line then, so the check guards against the issue coming back.

async function loginScriptUrls(request: import('@playwright/test').APIRequestContext) {
  const html = await (await request.get('/login')).text();
  return [...new Set(html.match(/\/_next\/static\/chunks\/[\w.-]+\.js/g) || [])];
}

test.describe('caching and asset size', () => {
  test('login HTML is compressed', async ({ request }) => {
    const res = await request.get('/login', { headers: { 'Accept-Encoding': 'br, gzip' } });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-encoding']).toMatch(/br|gzip/);
  });

  test('hashed JavaScript chunks are cached for a year', async ({ request }) => {
    const [chunk] = await loginScriptUrls(request);
    expect(chunk, 'no /_next/static chunk found in /login HTML').toBeTruthy();
    const cc = (await request.get(chunk)).headers()['cache-control'];
    expect(cc).toContain('immutable');
    expect(cc).toMatch(/max-age=31536000/);
  });

  test('known issue: no login-page script is over 1 MB unpacked', async ({ request }) => {
    test.fail(true, 'One chunk contains the whole Hugeicons set (~4.7 MB unpacked). Fix: import icons individually.');
    const sizes = await Promise.all((await loginScriptUrls(request)).map(async u => ({ u, kb: (await (await request.get(u)).body()).length / 1024 })));
    const largest = sizes.sort((a, b) => b.kb - a.kb)[0];
    expect(largest.kb, `largest script ${largest.u}`).toBeLessThanOrEqual(1024);
  });

  test('known issue: brand font is cached', async ({ request }) => {
    test.fail(true, 'DMSans TTF is served with max-age=0 and bypasses Cloudflare. Fix: WOFF2 with long immutable caching.');
    const res = await request.get('/assets/fonts/DMSans-VariableFont_opsz,wght.ttf');
    expect(res.status()).toBe(200);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers()['cache-control'] || '')?.[1] || 0);
    expect(maxAge).toBeGreaterThanOrEqual(86400);
  });

  test('known issue: share-feedback GIF is under 2 MB', async ({ request }) => {
    test.fail(true, 'share-feedback.gif is 19.8 MB and loads on every signed-in screen. Fix: MP4/WebM or a static image, loaded on demand.');
    const res = await request.fetch('/assets/gif/share-feedback.gif', { method: 'HEAD' });
    expect(res.status()).toBe(200);
    expect(Number(res.headers()['content-length'])).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  test('known issue: / redirects signed-out visitors on the server', async ({ request }) => {
    test.fail(true, '/ returns 200 and redirects in the browser after the app boots. Fix: redirect in Next.js middleware.');
    const res = await request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
  });
});
