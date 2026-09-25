import { test, expect } from '@playwright/test';
import { login, openLogin, publicPages } from '../helpers/uat';

// Purpose: signed-out pages work on phone, tablet and desktop screen sizes.

const viewports = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of viewports) {
  test.describe(`Responsive layout: ${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`TC-RESP-01 ${vp.name}: login form is fully visible and usable`, async ({ page }) => {
      await openLogin(page);
      for (const el of [login.email(page), login.password(page), login.submit(page)]) {
        await expect(el).toBeInViewport();
        const box = await el.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
      }
    });

    for (const p of publicPages) {
      test(`TC-RESP-02 ${vp.name}: ${p.name} page has no horizontal scroll`, async ({ page }) => {
        await page.goto(p.path);
        await page.locator(p.ready).waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }

    test(`TC-RESP-03 ${vp.name}: Sign in button is large enough to tap`, async ({ page }) => {
      await openLogin(page);
      const box = await login.submit(page).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(32);
    });
  });
}
