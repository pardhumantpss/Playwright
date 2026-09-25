import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { publicPages } from '../helpers/uat';

// Purpose: signed-out pages meet WCAG 2.1 AA as checked by axe-core.
// Violations are attached to the report; a test fails on critical or serious ones.

// Known violations, tracked by their own tests. Remove an entry once it is fixed.
const knownViolations: Record<string, string[]> = {
  login: ['button-name'], // show-password button has no label: TC-LOGIN-PWD-04
};

for (const p of publicPages) {
  test.describe(`Accessibility: ${p.name} page`, () => {
    test(`TC-A11Y-01 ${p.name}: no critical or serious WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
      await page.goto(p.path);
      await page.locator(p.ready).waitFor();
      await page.waitForLoadState('networkidle').catch(() => {});
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await testInfo.attach('axe-results.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
      const known = knownViolations[p.name] || [];
      const blocking = results.violations.filter(v => (v.impact === 'critical' || v.impact === 'serious') && !known.includes(v.id));
      for (const v of results.violations) testInfo.annotations.push({ type: `axe ${v.impact}`, description: `${v.id}: ${v.help} (${v.nodes.length})` });
      expect(blocking.map(v => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} element(s)`)).toEqual([]);
    });

    test(`TC-A11Y-02 ${p.name}: page declares its language`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}/);
    });

    test(`TC-A11Y-03 ${p.name}: every visible image has alt text`, async ({ page }) => {
      await page.goto(p.path);
      await page.locator(p.ready).waitFor();
      const missing = await page.$$eval('img', imgs => imgs.filter(i => i.offsetParent !== null && !i.hasAttribute('alt')).map(i => i.getAttribute('src')));
      expect(missing).toEqual([]);
    });
  });
}
