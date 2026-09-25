import { test, expect } from '@playwright/test';
import { UAT_URL } from '../helpers/uat';

// Purpose: the site is served securely, with protective HTTP headers.

test.describe('Security headers and transport', () => {
  test('TC-SEC-01 plain HTTP redirects to HTTPS', async ({ request }) => {
    const res = await request.get(UAT_URL.replace('https://', 'http://') + '/login', { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()['location']).toMatch(/^https:\/\//);
  });

  test('TC-SEC-02 language cookie is Secure and SameSite', async ({ request }) => {
    const res = await request.get('/login');
    const cookie = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value).join('\n');
    expect(cookie).toContain('i18next=');
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=/i);
  });

  test('TC-SEC-03 does not advertise server software versions', async ({ request }) => {
    const h = (await request.get('/login')).headers();
    expect(h['server'] || '').not.toMatch(/\d+\.\d+/);
  });

  test('TC-SEC-04 known issue: HSTS is enabled', async ({ request }) => {
    test.fail(true, 'Strict-Transport-Security is "max-age=0", which switches HSTS off. Fix: max-age=31536000; includeSubDomains.');
    const hsts = (await request.get('/login')).headers()['strict-transport-security'] || '';
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1] || 0)).toBeGreaterThanOrEqual(15552000);
  });

  test('TC-SEC-05 known issue: pages cannot be embedded by other sites', async ({ request }) => {
    test.fail(true, 'No X-Frame-Options or CSP frame-ancestors, so the login page can be framed (clickjacking). Fix: X-Frame-Options: DENY or frame-ancestors \'self\'.');
    const h = (await request.get('/login')).headers();
    const framed = /deny|sameorigin/i.test(h['x-frame-options'] || '') || /frame-ancestors/i.test(h['content-security-policy'] || '');
    expect(framed).toBe(true);
  });

  test('TC-SEC-06 known issue: browsers are told not to guess content types', async ({ request }) => {
    test.fail(true, 'X-Content-Type-Options is missing. Fix: X-Content-Type-Options: nosniff.');
    expect((await request.get('/login')).headers()['x-content-type-options']).toBe('nosniff');
  });

  test('TC-SEC-07 public config exposes no secrets', async ({ request }) => {
    const res = await request.get('/api/config');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/secret|password|private[_-]?key|api[_-]?key|token/i);
  });
});
