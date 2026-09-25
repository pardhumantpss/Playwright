import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { budgets, signedInScreens } from './budgets';
import { measure, record, checkBudget } from './helpers/measure';

// Uses the session saved by `node login-capture.js`. The file holds live tokens and is
// git-ignored, so these tests skip in CI and run only on a machine where someone has logged in.
const STATE = path.resolve('.auth/tp-state.json');

test.describe('signed-in page load', () => {
  test.skip(!fs.existsSync(STATE), 'No saved session. Run `node login-capture.js` and log in to enable these tests.');

  for (const screen of signedInScreens) {
    test(`${screen.name} · desktop`, async ({ browser }, testInfo) => {
      const m = await measure(browser, screen.path, { profile: 'desktop', storageState: STATE });
      test.skip(new URL(m.finalUrl).pathname.startsWith('/login'), 'Saved session has expired. Run `node login-capture.js` again.');
      record(testInfo, screen.name, 'desktop', m, budgets.signedIn.desktop);
      checkBudget(m, budgets.signedIn.desktop);
    });
  }
});
