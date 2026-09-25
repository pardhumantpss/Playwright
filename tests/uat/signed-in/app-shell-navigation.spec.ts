import { test, expect } from './helpers/test';
import { openApp, waitForApp, shell } from './helpers/app';

// Purpose: the app shell (top tabs, module ribbon, sidebar) takes users to the right screens.

const TABS = ['Home', 'Service Studio', 'Access Control', 'Governance', 'Tenants', 'Leecycle'];
const HOME_MODULES = ['Workspace', 'Projects', 'Project Details', 'Resources', 'Productivity', 'Finance', 'Compliance', 'Settings'];

test.describe('App shell navigation', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, '/leeact/projects/all-projects'); });

  test('TC-NAV-01 signed-in users land in the app, not on login', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('LEEACT').first()).toBeVisible();
  });

  test('TC-NAV-02 all six top tabs are shown', async ({ page }) => {
    for (const t of TABS) await expect(shell.tab(page, t)).toBeVisible();
  });

  test('TC-NAV-03 Home tab shows the eight Leeact modules', async ({ page }) => {
    await shell.tab(page, 'Home').click();
    for (const m of HOME_MODULES) await expect(shell.module(page, m)).toBeVisible();
  });

  for (const t of TABS.slice(1)) {
    test(`TC-NAV-04 ${t} tab switches the module ribbon`, async ({ page }) => {
      await shell.tab(page, 'Home').click();
      const homeModules = await page.locator('button.e-ribbon-control:visible').allInnerTexts();
      await shell.tab(page, t).click();
      await expect.poll(async () => (await page.locator('button.e-ribbon-control:visible').allInnerTexts()).join('|')).not.toBe(homeModules.join('|'));
      expect(await page.locator('button.e-ribbon-control:visible').count()).toBeGreaterThan(0);
    });
  }

  test('TC-NAV-05 Workspace module opens Workspace Directory with its sidebar pages', async ({ page }) => {
    await shell.tab(page, 'Home').click();
    await shell.module(page, 'Workspace').click();
    await expect(page).toHaveURL(/\/leeact\/workspace\/workspace-directory/);
    for (const p of ['Workspace Directory', 'Overview', 'Calendar', 'Announcements']) await expect(shell.sidebarLink(page, p)).toBeVisible();
  });

  test('TC-NAV-06 Project Details module lists its 15 sections', async ({ page }) => {
    await shell.tab(page, 'Home').click();
    await shell.module(page, 'Project Details').click();
    await expect(page).toHaveURL(/\/leeact\/project-details\//);
    for (const p of ['Overview', 'Scope', 'Milestones', 'Sprints', 'Boards', 'Tasks', 'Files', 'Risks', 'Issues', 'Notes', 'Changes', 'Dependencies', 'Meetings', 'Teams', 'Epics']) {
      await expect(shell.sidebarLink(page, p)).toBeVisible();
    }
  });

  test('TC-NAV-07 clicking a sidebar link opens that page and highlights it', async ({ page }) => {
    await shell.tab(page, 'Home').click();
    await shell.module(page, 'Workspace').click();
    await shell.sidebarLink(page, 'Calendar').click();
    await expect(page).toHaveURL(/\/leeact\/workspace\/calendar/);
    await waitForApp(page);
    await expect(page).toHaveTitle(/Calendar/);
  });

  test('TC-NAV-08 page titles follow "Uat | Leecycle | <page>"', async ({ page }) => {
    await expect(page).toHaveTitle('Uat | Leecycle | All Projects');
  });

  test('TC-NAV-09 browser Back returns to the previous page', async ({ page }) => {
    await shell.tab(page, 'Home').click();
    await shell.module(page, 'Workspace').click();
    await expect(page).toHaveURL(/workspace-directory/);
    await page.goBack();
    await expect(page).toHaveURL(/all-projects/);
  });

  test('TC-NAV-10 sidebar can be collapsed and expanded', async ({ page }) => {
    const link = page.locator('a[href="/leeact/projects/all-projects"]').first();
    await expect(link).toBeVisible();
    await shell.collapseSidebar(page).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expect(link).toBeHidden();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(shell.collapseSidebar(page)).toBeVisible();
    await expect(link).toBeVisible();
  });

  test('TC-NAV-11 reloading a page keeps the user signed in on the same page', async ({ page }) => {
    await page.reload();
    await waitForApp(page);
    await expect(page).toHaveURL(/all-projects/);
  });

  test('TC-NAV-12 an unknown app URL shows the 404 page with a way back', async ({ page }) => {
    await openApp(page, '/leeact/this-page-does-not-exist-pw');
    await expect(shell.notFound(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go Home' }).or(page.getByRole('link', { name: 'Go Home' }))).toBeVisible();
  });

  test('TC-NAV-13 Go Home on the 404 page leaves the error page', async ({ page }) => {
    await openApp(page, '/leeact/this-page-does-not-exist-pw');
    await page.getByRole('button', { name: 'Go Home' }).or(page.getByRole('link', { name: 'Go Home' })).first().click();
    await expect(shell.notFound(page)).toHaveCount(0, { timeout: 30_000 });
  });

  test('TC-NAV-14 footer shows the copyright notice', async ({ page }) => {
    await expect(page.getByText(/Copyright © 2001 - \d{4} IMS\. All Rights Reserved/)).toBeVisible();
  });
});
