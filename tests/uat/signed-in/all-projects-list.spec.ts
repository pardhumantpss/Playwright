import { test, expect } from './helpers/test';
import { openApp, PROJECT } from './helpers/app';

// Purpose: the All Projects list shows projects and its search, filters, columns and exports work.

const COLUMNS = ['ID', 'PROJECT NAME', 'STATUS', 'PRIORITY', 'PROGRESS', 'OWNER', 'TEAM', 'BUDGET', 'TIMELINE', 'NEXT MILESTONE', 'RISKS', 'ISSUES', 'ACTIONS'];
const search = (page: import('@playwright/test').Page) => page.getByPlaceholder('Search projects...');
const projectRow = (page: import('@playwright/test').Page) => page.getByRole('row').filter({ hasText: PROJECT.name });

test.describe('All Projects list', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/leeact/projects/all-projects');
    await expect(page.getByRole('columnheader').first()).toBeVisible();
  });

  test('TC-PRJ-LIST-01 shows the page heading and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'All Projects' })).toBeVisible();
    await expect(page.getByText('Manage all projects across workspaces')).toBeVisible();
  });

  test('TC-PRJ-LIST-02 shows all 13 column headers', async ({ page }) => {
    const headers = (await page.getByRole('columnheader').allInnerTexts()).map(h => h.trim()).filter(Boolean);
    for (const c of COLUMNS) expect(headers).toContain(c);
  });

  test(`TC-PRJ-LIST-03 lists project ${PROJECT.id} "${PROJECT.name}"`, async ({ page }) => {
    await expect(projectRow(page)).toBeVisible();
    await expect(projectRow(page)).toContainText(PROJECT.id);
  });

  test('TC-PRJ-LIST-04 project row shows status, priority and progress', async ({ page }) => {
    const row = projectRow(page);
    await expect(row).toContainText(/Open|In Progress|Completed|On Hold|Closed/);
    await expect(row).toContainText(/Low|Medium|High|Critical/);
    await expect(row).toContainText(/\d+(\.\d+)?%/);
  });

  test('TC-PRJ-LIST-05 searching by project name keeps the matching row', async ({ page }) => {
    await search(page).fill(PROJECT.name);
    await expect(projectRow(page)).toBeVisible();
  });

  test('TC-PRJ-LIST-06 search with no match shows the empty state', async ({ page }) => {
    await search(page).fill('zz-playwright-no-match');
    await expect(page.getByText('No projects match your filters')).toBeVisible();
    await expect(projectRow(page)).toHaveCount(0);
  });

  test('TC-PRJ-LIST-07 Clear Filters restores the list', async ({ page }) => {
    await search(page).fill('zz-playwright-no-match');
    await expect(page.getByText('No projects match your filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(projectRow(page)).toBeVisible();
    await expect(search(page)).toHaveValue('');
  });

  test('TC-PRJ-LIST-08 search is not case sensitive', async ({ page }) => {
    await search(page).fill(PROJECT.name.toUpperCase());
    await expect(projectRow(page)).toBeVisible();
  });

  test('TC-PRJ-LIST-09 filter dropdowns for Industry, Project Type, Status and Owner are shown', async ({ page }) => {
    for (const ph of ['Industry', 'Project Type', 'Status', 'Owner']) await expect(page.getByPlaceholder(ph, { exact: true }).first()).toBeAttached();
    await expect(page.getByPlaceholder('Select date range')).toBeVisible();
  });

  test('TC-PRJ-LIST-10 Status filter opens a list of statuses', async ({ page }) => {
    await page.locator('span[role=combobox]').filter({ has: page.getByPlaceholder('Status', { exact: true }) }).first().click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC-PRJ-LIST-11 CSV, Excel and PDF export buttons are shown', async ({ page }) => {
    for (const b of ['CSV Export', 'Excel Export', 'PDF Export']) await expect(page.getByRole('button', { name: b })).toBeVisible();
  });

  test('TC-PRJ-LIST-12 CSV export downloads a file with the column headers', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV Export' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/i);
    const content = await (await import('fs')).promises.readFile(await file.path(), 'utf8');
    expect(content).toMatch(/project/i);
  });

  test('TC-PRJ-LIST-13 Excel export downloads an .xlsx file', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel Export' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('TC-PRJ-LIST-14 Columns opens the Choose Column dialog, which cancels cleanly', async ({ page }) => {
    await page.getByRole('button', { name: 'Columns' }).click();
    await expect(page.getByText('Choose Column')).toBeVisible();
    await expect(page.getByText('Select All', { exact: true })).toBeVisible();
    for (const c of ['Project Name', 'Status', 'Priority', 'Owner', 'Budget']) await expect(page.getByText(c, { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await expect(page.getByText('Choose Column')).toBeHidden();
  });

  test('TC-PRJ-LIST-15 pager shows the page and item count', async ({ page }) => {
    await expect(page.getByText(/\d+ of \d+ pages \(\d+ items?\)/)).toBeVisible();
    await expect(page.getByPlaceholder('Items per page')).toBeAttached();
  });

  test('TC-PRJ-LIST-16 select-all checkbox selects every row', async ({ page }) => {
    // The real checkbox is 0 px wide; the styled box next to it takes the click.
    const all = page.locator('input[aria-label="Select all checkbox"]');
    const allBox = all.locator('xpath=following-sibling::span[contains(@class,"e-frame")]');
    await allBox.click();
    await expect(all).toBeChecked();
    for (const r of await page.locator('input[aria-label="Select row"]').all()) await expect(r).toBeChecked();
    await allBox.click();
    await expect(all).not.toBeChecked();
  });

  test('TC-PRJ-LIST-17 New Project button is shown', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
  });
});
