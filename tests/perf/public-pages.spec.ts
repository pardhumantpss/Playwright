import { test } from '@playwright/test';
import { budgets } from './budgets';
import { measureMedian, record, checkBudget } from './helpers/measure';

const LOGIN_FORM = 'input[name="email"]';

test.describe('public page load', () => {
  test('login page · desktop', async ({ browser }, testInfo) => {
    const m = await measureMedian(browser, '/login', { profile: 'desktop', ready: LOGIN_FORM }, 3);
    record(testInfo, 'Login', 'desktop', m, budgets.login.desktop);
    checkBudget(m, budgets.login.desktop);
  });

  test('login page · mobile slow 4G', async ({ browser }, testInfo) => {
    const m = await measureMedian(browser, '/login', { profile: 'mobile', ready: LOGIN_FORM }, 2);
    record(testInfo, 'Login', 'mobile', m, budgets.login.mobile);
    checkBudget(m, budgets.login.mobile);
  });

  test('open / until the login form is ready · desktop', async ({ browser }, testInfo) => {
    const m = await measureMedian(browser, '/', { profile: 'desktop', waitForUrl: /\/login/, ready: LOGIN_FORM }, 3);
    record(testInfo, '/ → Login', 'desktop', m, budgets.rootToLogin.desktop, { budgetOnly: true });
    checkBudget(m, budgets.rootToLogin.desktop);
  });
});
