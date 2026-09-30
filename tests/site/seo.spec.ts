import { test, expect } from './helpers/test';
import { ALL_PAGES, SITEMAP_PAGES, SITE_URL, attrs, metaContent } from './helpers/site';

const TAG_PAGE = /^\/blog\/tag\//;
import { KNOWN } from './helpers/known-issues';

// Purpose: every page responds quickly and carries the metadata search engines and social previews need.
// Checks the served HTML directly, without a browser.

test.describe('Crawling: robots.txt and sitemap', () => {
  test('TC-SEO-01 robots.txt allows crawling and points to the sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/User-Agent:\s*\*/i);
    expect(text).not.toMatch(/^Disallow:\s*\/\s*$/im);
    expect(text).toMatch(/Sitemap:\s*https:\/\/leeact\.io\/sitemap/i);
  });

  test('TC-SEO-02 /sitemap.xml redirects to a valid XML sitemap', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    expect(await res.text()).toMatch(/<urlset[^>]+sitemaps\.org/);
  });

  test('TC-SEO-03 sitemap lists exactly the pages this suite checks', async ({ request }) => {
    const xml = await (await request.get('/sitemap_index.xml')).text();
    const listed = attrs(xml, /<loc>([^<]+)<\/loc>/g).map(u => u.replace(SITE_URL, ''));
    expect.soft(listed.filter(p => !SITEMAP_PAGES.includes(p)), 'new pages: add them to SITEMAP_PAGES').toEqual([]);
    expect.soft(SITEMAP_PAGES.filter(p => !listed.includes(p)), 'pages dropped from the sitemap').toEqual([]);
  });

  test('TC-SEO-04 an unknown URL returns HTTP 404', async ({ request }) => {
    const res = await request.get('/playwright-no-such-page-xyz/');
    expect(res.status()).toBe(404);
  });

  test('TC-SEO-05 every page has a unique title and description', async ({ request }) => {
    const seen = { title: new Map<string, string>(), description: new Map<string, string>() };
    const dupes: string[] = [];
    for (const path of ALL_PAGES) {
      const html = await (await request.get(path)).text();
      const values = { title: html.match(/<title>([^<]*)<\/title>/)?.[1] || '', description: metaContent(html, 'description') || '' };
      for (const key of ['title', 'description'] as const) {
        const prev = seen[key].get(values[key]);
        if (prev) dupes.push(`${key} of ${path} repeats ${prev}: "${values[key]}"`);
        seen[key].set(values[key], path);
      }
    }
    expect(dupes).toEqual([]);
  });
});

for (const path of ALL_PAGES) {
  test.describe(`SEO: ${path}`, () => {
    let html = '';
    test.beforeAll(async ({ request }) => {
      html = await (await request.get(path)).text();
    });

    test(`TC-SEO-10 ${path}: returns 200 within 3 seconds`, async ({ request }) => {
      const t0 = Date.now();
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toMatch(/text\/html/);
      expect(Date.now() - t0).toBeLessThan(3_000);
    });

    test(`TC-SEO-11 ${path}: has a title and meta description`, async () => {
      expect(html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim().length).toBeGreaterThan(10);
      expect(metaContent(html, 'description')?.trim().length).toBeGreaterThanOrEqual(30);
    });

    test(`TC-SEO-12 ${path}: canonical link points to itself`, async () => {
      test.fail(KNOWN.noCanonical.includes(path), 'Known issue: no <link rel="canonical">. Fix: add alternates.canonical to the page metadata.');
      const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
      expect(canonical).toBe(SITE_URL + path);
    });

    test(`TC-SEO-13 ${path}: has exactly one <h1>`, async () => {
      test.fail(KNOWN.noH1.includes(path), 'Known issue: blog list pages have no <h1>. Fix: make the page heading an <h1>.');
      expect(html.match(/<h1[\s>]/g)?.length ?? 0).toBe(1);
    });

    // Tag pages are noindex, follow on purpose (thin duplicate lists); every other page must be indexable.
    test(`TC-SEO-14 ${path}: ${TAG_PAGE.test(path) ? 'is kept out of the index but followed' : 'can be indexed'}`, async () => {
      if (TAG_PAGE.test(path)) expect(metaContent(html, 'robots')).toMatch(/noindex,\s*follow/i);
      else expect(metaContent(html, 'robots') || '').not.toMatch(/noindex/i);
      expect(html).toMatch(/<html[^>]+lang="en/);
    });

    test(`TC-SEO-15 ${path}: has Open Graph and Twitter card tags`, async () => {
      for (const key of ['og:title', 'og:description', 'og:image', 'twitter:card']) expect.soft(metaContent(html, key), key).toBeTruthy();
      expect(metaContent(html, 'og:image')).toMatch(/^https:\/\//);
    });

    test(`TC-SEO-16 ${path}: structured data is valid JSON`, async () => {
      const blocks = attrs(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) expect(() => JSON.parse(b)).not.toThrow();
    });
  });
}
