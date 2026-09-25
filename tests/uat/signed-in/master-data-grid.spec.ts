import { test, expect } from './helpers/test';
import { openApp } from './helpers/app';

// Purpose: the shared master-data table (tested on Priority Master) sorts, pages, exports and opens Add.
// Nothing is added or edited.

test.describe('Master data table (Priority Master)', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/leeact/settings/priority');
    await expect(page.getByRole('heading', { name: 'Priority Master' })).toBeVisible();
    await expect(page.getByRole('columnheader').first()).toBeVisible();
  });

  test('TC-GRID-01 shows the heading, description and toolbar', async ({ page }) => {
    await expect(page.getByText('Manage and configure priority values')).toBeVisible();
    for (const b of ['Add', 'CSV Export', 'Excel Export', 'PDF Export', 'Columns']) await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
  });

  test('TC-GRID-02 shows the expected columns', async ({ page }) => {
    const headers = (await page.getByRole('columnheader').allInnerTexts()).map(h => h.trim());
    for (const c of ['PRIORITY NAME', 'CODE', 'COLOR CODE', 'ENTITY', 'ENTITY TYPE']) expect(headers).toContain(c);
  });

  test('TC-GRID-03 lists at least one priority', async ({ page }) => {
    expect(await page.getByRole('row').count()).toBeGreaterThan(1);
  });

  test('TC-GRID-04 clicking a column header sorts the rows', async ({ page }) => {
    // Column order: checkbox, then Priority Name. Read the first data row's name cell.
    const firstCell = () => page.getByRole('row').filter({ has: page.getByRole('gridcell') }).first().getByRole('gridcell').nth(1).innerText().catch(() => '');
    const header = page.getByRole('columnheader', { name: 'PRIORITY NAME' });
    await header.click();
    const asc = await firstCell();
    await header.click();
    await expect.poll(firstCell).not.toBe('');
    const sortState = await header.getAttribute('aria-sort');
    expect(sortState === 'descending' || sortState === 'ascending' || (await firstCell()) !== asc).toBe(true);
  });

  test('TC-GRID-05 Add opens a form that can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true }).last();
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(cancel).toBeHidden();
  });

  test('TC-GRID-06 CSV export downloads a CSV file', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV Export', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('TC-GRID-07 PDF export downloads a PDF file', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF Export', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('TC-GRID-08 pager shows page and item count', async ({ page }) => {
    await expect(page.getByText(/\d+ of \d+ pages \(\d+ items?\)/)).toBeVisible();
  });
});
