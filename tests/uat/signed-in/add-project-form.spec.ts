import { test, expect } from './helpers/test';
import { openApp, PROJECT } from './helpers/app';

// Purpose: the Add Project form opens with the right fields, blocks an empty save, and cancels cleanly.
// These tests never save a project.

const panel = (page: import('@playwright/test').Page) => page.locator('div').filter({ has: page.getByText('Add Project', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Cancel' }) }).last();

test.describe('Add Project form', () => {
  let createAttempts: string[];

  test.beforeEach(async ({ page }) => {
    // Block the create-project call so no test here can ever add a project, even if validation fails.
    createAttempts = [];
    await page.route(/\/extended\/projects(\?|$)/, route => {
      if (route.request().method() !== 'POST') return route.fallback();
      createAttempts.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    await openApp(page, '/leeact/projects/all-projects');
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page.getByText('Add Project', { exact: true })).toBeVisible();
  });

  test('TC-PRJ-ADD-01 form shows the Basic Information and Teams steps', async ({ page }) => {
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Teams', { exact: true }).last()).toBeVisible();
  });

  test('TC-PRJ-ADD-02 form shows all project fields', async ({ page }) => {
    for (const label of ['Project Name', 'Description', 'Project Type', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Industry', 'Account', 'Account Contact']) {
      await expect(panel(page).getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('TC-PRJ-ADD-03 Project Name is marked as required', async ({ page }) => {
    await expect(panel(page).getByText(/Project Name\s*\*/)).toBeVisible();
  });

  test('TC-PRJ-ADD-04 form offers shortcuts to create a type, industry, account and contact', async ({ page }) => {
    for (const t of ['Create New Project Type', 'Create New Industry', 'Create New Account', 'Create New Account Contact']) {
      await expect(page.getByRole('button', { name: `+ ${t}`, exact: true })).toBeVisible();
    }
  });

  test('TC-PRJ-ADD-05 Save, Next and Cancel buttons are shown', async ({ page }) => {
    for (const b of ['Save', 'Next', 'Cancel']) await expect(page.getByRole('button', { name: b, exact: true }).last()).toBeVisible();
  });

  test('TC-PRJ-ADD-06 saving an empty form is blocked and creates nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await expect(page.getByText(/required|please enter|cannot be empty/i).first()).toBeVisible();
    await expect(page.getByText('Add Project', { exact: true })).toBeVisible();
    expect(createAttempts, 'the form should not even try to create a project').toEqual([]);
  });

  test('TC-PRJ-ADD-07 Cancel closes the form without adding a project', async ({ page }) => {
    const rowsBefore = await page.getByRole('row').count();
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await expect(page.getByText('Add Project', { exact: true })).toHaveCount(0);
    expect(await page.getByRole('row').count()).toBe(rowsBefore);
    await expect(page.getByRole('row').filter({ hasText: PROJECT.name })).toBeVisible();
  });

  test('TC-PRJ-ADD-08 known issue: typed values are discarded after Cancel', async ({ page }) => {
    test.fail(true, 'After Cancel and reopening, the form still holds the text typed before. Confirm with product whether drafts should be kept; if not, reset the form on Cancel.');
    const name = panel(page).getByRole('textbox').first();
    await name.fill('Playwright draft - not saved');
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(panel(page).getByRole('textbox').first()).toHaveValue('');
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  });
});
