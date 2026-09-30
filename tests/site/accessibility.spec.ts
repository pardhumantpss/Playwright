import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/test';
import { KEY_PAGES, blockWrites, openAndScroll } from './helpers/site';
import { KNOWN } from './helpers/known-issues';

// Purpose: the most visited pages meet WCAG 2.1 AA as checked by axe-core.
// TC-SITE-A11Y-01 fails on any new critical or serious violation; TC-SITE-A11Y-02 tracks the known ones.
// Each page is scanned once and shared by both tests.

test.describe.configure({ mode: 'default' });

for (const path of KEY_PAGES) {
  test.describe(`Accessibility: ${path}`, () => {
    let serious: { id: string; line: string }[] = [];
    let report = '';

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await blockWrites(context);
      const page = await context.newPage();
      await openAndScroll(page, path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await context.close();
      report = JSON.stringify(results.violations, null, 2);
      serious = results.violations
        .filter(v => v.impact === 'critical' || v.impact === 'serious')
        .map(v => ({ id: v.id, line: `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} element(s): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}` }));
    });

    test(`TC-SITE-A11Y-01 ${path}: no new critical or serious WCAG violations`, async ({}, testInfo) => {
      await testInfo.attach('axe-results.json', { body: report, contentType: 'application/json' });
      const known = KNOWN.axe[path] || [];
      expect(serious.filter(v => !known.includes(v.id)).map(v => v.line)).toEqual([]);
    });

    if (KNOWN.axe[path]) {
      test(`TC-SITE-A11Y-02 ${path}: known issue: ${KNOWN.axe[path].join(', ')}`, async () => {
        test.fail(true, path === '/signup/'
          ? 'Known issue: a button with no accessible name (icon-only). Fix: add aria-label.'
          : 'Known issue: text colour contrast below 4.5:1 (light grey or brand-colour text on white). Fix: darken the text colour.');
        expect(serious.filter(v => KNOWN.axe[path].includes(v.id)).map(v => v.line)).toEqual([]);
      });
    }
  });
}
