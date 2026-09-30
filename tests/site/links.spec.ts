import { test, expect } from './helpers/test';
import { ALL_PAGES, attrs } from './helpers/site';
import { KNOWN } from './helpers/known-issues';

// Purpose: no link on the site is broken, empty or malformed, and the app downloads exist.
// Checks the served HTML directly, without a browser.

const pageHtml = new Map<string, string>();

test.beforeAll(async ({ request }) => {
  for (const path of ALL_PAGES) pageHtml.set(path, await (await request.get(path)).text());
});

const hrefs = (html: string) => attrs(html, /<a\b[^>]*\shref="([^"]*)"/g).map(h => h.replace(/&amp;/g, '&'));

test('TC-LINK-01 every internal link opens a page', async ({ request }) => {
  test.setTimeout(180_000);
  const links = new Set<string>();
  for (const html of pageHtml.values()) {
    for (const h of hrefs(html)) {
      if (/^\/(?!\/|cdn-cgi\/l\/email-protection)/.test(h)) links.add(h.split('#')[0]);
      else if (/^https:\/\/(www\.)?leeact\.io\//.test(h)) links.add(new URL(h).pathname);
    }
  }
  const broken: string[] = [];
  for (const link of links) {
    const res = await request.get(link);
    if (res.status() >= 400) broken.push(`${res.status()} ${link}`);
  }
  expect(links.size).toBeGreaterThan(30);
  expect(broken).toEqual([]);
});

test('TC-LINK-02 the Windows and Linux desktop downloads exist', async ({ request }) => {
  const html = pageHtml.get('/download/')!;
  const files = hrefs(html).filter(h => /\.(exe|deb|dmg|AppImage)$/i.test(h));
  expect(files.some(f => f.endsWith('.exe'))).toBe(true);
  expect(files.some(f => f.endsWith('.deb'))).toBe(true);
  for (const f of files) {
    // HEAD follows the GitHub redirect to the file without downloading it.
    const res = await request.head(f);
    expect(res.status(), f).toBe(200);
    expect(Number(res.headers()['content-length'] || 0), `${f} size`).toBeGreaterThan(10_000_000);
  }
});

test('TC-LINK-03 social links point to Leeact accounts over HTTPS', async () => {
  const social = new Set([...pageHtml.values()].flatMap(hrefs).filter(h => /facebook|instagram|linkedin|x\.com|twitter/.test(h) && !/share|sharer|intent/.test(h)));
  expect(social.size).toBeGreaterThanOrEqual(3);
  for (const s of social) expect(s).toMatch(/^https:\/\/(www\.)?(facebook\.com\/leeact|instagram\.com\/leeact|linkedin\.com\/company\/leeact)/);
});

for (const path of ALL_PAGES) {
  test.describe(`Links: ${path}`, () => {
    test(`TC-LINK-10 ${path}: no placeholder links (href="#")`, async () => {
      test.fail(KNOWN.placeholderLinks.includes(path), 'Known issue: links with href="#" that go nowhere ("Explore …" and "See it in action" on the home page; Terms of Service and Privacy Policy on sign-up, and those pages don\'t exist). Fix: link to real pages or use buttons.');
      expect(hrefs(pageHtml.get(path)!).filter(h => h === '#').length).toBe(0);
    });

    test(`TC-LINK-11 ${path}: phone links can be dialled`, async () => {
      test.fail(KNOWN.badPhoneLinks.includes(path), 'Known issue: tel:+01725013237 has "+" followed by 0, which is not a country code. Fix: tel:+911725013237.');
      const tels = hrefs(pageHtml.get(path)!).filter(h => h.startsWith('tel:'));
      expect(tels.filter(t => !/^tel:(\+[1-9]\d{7,14}|0\d{6,12})$/.test(t))).toEqual([]);
    });

    test(`TC-LINK-12 ${path}: links that open a new tab are protected`, async () => {
      const blank = [...pageHtml.get(path)!.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(m => m[0]);
      expect(blank.filter(a => !/rel="[^"]*noopener|rel="[^"]*noreferrer/.test(a))).toEqual([]);
    });
  });
}
