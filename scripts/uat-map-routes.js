// Builds tests/uat/signed-in/data/route-catalog.json: every page reachable from the app menus.
// Walks each top tab → ribbon module → sidebar links. It only opens menus; it clicks nothing
// that creates, edits or deletes. Needs a saved session: node login-capture.js https://uat.leecycle.dev .auth/uat-state.json
// Usage: node scripts/uat-map-routes.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.UAT_URL || 'https://uat.leecycle.dev';
const STATE = '.auth/uat-state.json';
const OUT = 'tests/uat/signed-in/data/route-catalog.json';

(async () => {
  if (!fs.existsSync(STATE)) throw new Error(`No session at ${STATE}. Run login-capture.js first.`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/leeact/projects/all-projects', { waitUntil: 'load' });
  if (page.url().includes('/login')) throw new Error('Saved session has expired. Run login-capture.js again.');
  await page.waitForFunction(() => !document.body.innerText.includes('Verifying access'), undefined, { timeout: 60000 });
  await page.locator('[role=tab]').first().waitFor({ timeout: 60000 });
  await page.locator('button.e-ribbon-control').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);

  const routes = new Map();
  const tabs = await page.$$eval('[role=tab]', t => [...new Set(t.map(x => x.innerText.trim()).filter(Boolean))]);
  for (const tab of tabs) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(1200);
    const modules = await page.$$eval('button.e-ribbon-control', bs => bs.filter(x => x.offsetParent !== null).map(x => x.getAttribute('aria-label') || x.innerText.trim()));
    for (const mod of modules) {
      try {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.waitForTimeout(500);
        await page.locator('button.e-ribbon-control:visible', { hasText: mod }).first().click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        // Sidebar links sit in the left 200 px of the page
        const links = await page.$$eval('a[href]', as => as
          .filter(a => a.offsetParent !== null && a.getBoundingClientRect().left < 200)
          .map(a => ({ name: a.innerText.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') })));
        const landing = new URL(page.url()).pathname;
        if (!links.length) links.push({ name: mod, href: landing });
        for (const l of links) {
          if (!l.href || l.href === '#' || routes.has(l.href)) continue;
          routes.set(l.href, { tab, module: mod, page: l.name || mod, path: l.href });
        }
        console.log(`${tab} > ${mod}: ${links.length} pages`);
      } catch (e) {
        console.log(`${tab} > ${mod}: could not open (${e.message.split('\n')[0]})`);
      }
    }
  }
  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const list = [...routes.values()];
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), base: BASE, count: list.length, routes: list }, null, 1) + '\n');
  console.log(`Wrote ${list.length} routes to ${OUT}`);
})();
