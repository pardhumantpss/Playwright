import { test, expect } from './helpers/test';
import { SITE_URL } from './helpers/site';

// Purpose: the site is served over HTTPS on one host, with protective HTTP headers.

test.describe('Transport and redirects', () => {
  test('TC-SITE-SEC-01 plain HTTP redirects to HTTPS', async ({ request }) => {
    const res = await request.get(SITE_URL.replace('https://', 'http://') + '/', { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toBe(SITE_URL + '/');
  });

  test('TC-SITE-SEC-02 www redirects to the bare domain', async ({ request }) => {
    const res = await request.get(SITE_URL.replace('https://', 'https://www.') + '/', { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toBe(SITE_URL + '/');
  });

  test('TC-SITE-SEC-03 URLs without a trailing slash redirect to the slash version', async ({ request }) => {
    const res = await request.get('/pricing', { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/\/pricing\/$/);
  });

  test('TC-SITE-SEC-04 the server header shows no software version', async ({ request }) => {
    expect((await request.get('/')).headers()['server'] || '').not.toMatch(/\d+\.\d+/);
  });

  test('TC-SITE-SEC-05 the /api/ path is kept out of search results', async ({ request }) => {
    expect(await (await request.get('/robots.txt')).text()).toMatch(/Disallow:\s*\/api\//);
  });
});

test.describe('Security headers', () => {
  let h: Record<string, string> = {};
  test.beforeAll(async ({ request }) => {
    h = (await request.get('/')).headers();
  });

  test('TC-SITE-SEC-10 known issue: HSTS is enabled', async () => {
    test.fail(true, 'No Strict-Transport-Security header. Fix: Strict-Transport-Security: max-age=31536000; includeSubDomains.');
    expect(Number(/max-age=(\d+)/.exec(h['strict-transport-security'] || '')?.[1] || 0)).toBeGreaterThanOrEqual(15552000);
  });

  test('TC-SITE-SEC-11 known issue: pages cannot be framed by other sites', async () => {
    test.fail(true, "No X-Frame-Options or CSP frame-ancestors (clickjacking on the sign-up form). Fix: X-Frame-Options: DENY or frame-ancestors 'self'.");
    expect(/deny|sameorigin/i.test(h['x-frame-options'] || '') || /frame-ancestors/i.test(h['content-security-policy'] || '')).toBe(true);
  });

  test('TC-SITE-SEC-12 known issue: browsers are told not to guess content types', async () => {
    test.fail(true, 'X-Content-Type-Options is missing. Fix: X-Content-Type-Options: nosniff.');
    expect(h['x-content-type-options']).toBe('nosniff');
  });

  test('TC-SITE-SEC-13 known issue: a Referrer-Policy is set', async () => {
    test.fail(true, 'No Referrer-Policy header. Fix: Referrer-Policy: strict-origin-when-cross-origin.');
    expect(h['referrer-policy']).toBeTruthy();
  });

  test('TC-SITE-SEC-14 known issue: the framework is not advertised', async () => {
    test.fail(true, 'X-Powered-By: Next.js is sent. Fix: poweredByHeader: false in next.config.js.');
    expect(h['x-powered-by']).toBeUndefined();
  });
});
