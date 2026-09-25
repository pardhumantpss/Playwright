// Opens a visible browser so the user can log in manually; saves the session for perf tests.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('https://tp.leeact.io/login');
  console.log('Waiting up to 10 minutes for manual login...');
  await page.waitForURL(u => !/\/(login|forgot-password)/.test(u.pathname) && u.pathname !== '/', { timeout: 600000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  fs.mkdirSync('.auth', { recursive: true });
  await ctx.storageState({ path: '.auth/tp-state.json' });
  const landing = page.url();
  const links = await page.$$eval('a[href]', as => [...new Set(as.map(a => a.href))]);
  const internal = links.filter(h => h.startsWith('https://tp.leeact.io/') && !/logout|signout|sign-out|delete/i.test(h));
  fs.writeFileSync('.auth/tp-links.json', JSON.stringify({ landing, internal }, null, 1));
  console.log('LOGGED_IN landing=' + landing);
  console.log('LINKS ' + JSON.stringify(internal));
  await browser.close();
})();
