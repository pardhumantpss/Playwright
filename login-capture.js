// Opens a visible browser so the user can log in manually; saves the session for signed-in tests.
// Usage: node login-capture.js [baseUrl] [stateFile]
//   node login-capture.js                                               -> tp.leeact.io, .auth/tp-state.json
//   node login-capture.js https://uat.leecycle.dev .auth/uat-state.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = (process.argv[2] || 'https://tp.leeact.io').replace(/\/$/, '');
const STATE = process.argv[3] || '.auth/tp-state.json';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  console.log('Waiting up to 10 minutes for manual login...');
  await page.waitForURL(u => !/\/(login|forgot-password)/.test(u.pathname) && u.pathname !== '/', { timeout: 600000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await ctx.storageState({ path: STATE });
  const landing = page.url();
  const links = await page.$$eval('a[href]', as => [...new Set(as.map(a => a.href))]);
  const internal = links.filter(h => h.startsWith(BASE + '/') && !/logout|signout|sign-out|delete/i.test(h));
  fs.writeFileSync(STATE.replace(/\.json$/, '-links.json'), JSON.stringify({ landing, internal }, null, 1));
  console.log('LOGGED_IN landing=' + landing);
  console.log('LINKS ' + JSON.stringify(internal));
  await browser.close();
})();
