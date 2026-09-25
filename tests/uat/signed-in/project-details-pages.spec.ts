import { test, expect } from './helpers/test';
import { openApp, shell, APP_ERROR } from './helpers/app';

// Purpose: every Project Details section and the Workspace overview open for the selected project without errors.

const SECTIONS = [
  { name: 'Overview', path: 'overview' }, { name: 'Scope', path: 'scope' }, { name: 'Milestones', path: 'milestones' },
  { name: 'Sprints', path: 'sprints' }, { name: 'Boards', path: 'boards' }, { name: 'Tasks', path: 'tasks' },
  { name: 'Files', path: 'files' }, { name: 'Risks', path: 'risks' }, { name: 'Issues', path: 'issues' },
  { name: 'Notes', path: 'notes' }, { name: 'Changes', path: 'changes' }, { name: 'Dependencies', path: 'dependencies' },
  { name: 'Meetings', path: 'meetings' }, { name: 'Teams', path: 'teams' }, { name: 'Epics', path: 'epics' },
];

test.describe('Project Details sections', () => {
  for (const s of SECTIONS) {
    test(`TC-PD-01 ${s.name} section opens without errors`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', e => jsErrors.push(e.message));
      await openApp(page, `/leeact/project-details/${s.path}`);
      await expect(shell.notFound(page)).toHaveCount(0);
      await expect(page).toHaveTitle(new RegExp(s.name));
      await expect(page.getByText(APP_ERROR)).toHaveCount(0);
      expect(jsErrors).toEqual([]);
    });
  }

  test('TC-PD-02 Tasks shows task summary figures', async ({ page }) => {
    await openApp(page, '/leeact/project-details/tasks');
    for (const k of ['Total Task Lists', 'Active Tasks', 'Completed Tasks', 'Overdue', 'Est Hours', 'Avg Progress']) await expect(page.getByText(k).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Task', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Task List', exact: true })).toBeVisible();
  });

  test('TC-PD-03 moving between sections keeps the selected project', async ({ page }) => {
    await openApp(page, '/leeact/project-details/overview');
    const project = new URL(page.url()).searchParams.get('p');
    await shell.sidebarLink(page, 'Risks').click();
    await expect(page).toHaveURL(/project-details\/risks/);
    if (project) expect(new URL(page.url()).searchParams.get('p')).toBe(project);
  });
});

test.describe('Workspace overview', () => {
  test('TC-WS-01 overview shows member and project figures', async ({ page }) => {
    await openApp(page, '/leeact/workspace/overview');
    for (const k of ['Total Members', 'Total Projects']) await expect(page.getByText(k).first()).toBeVisible();
    for (const h of ['Projects', 'Announcements', 'Upcoming Events']) await expect(page.getByRole('heading', { name: h }).first()).toBeVisible();
  });

  test('TC-WS-02 View All on the overview opens the project list', async ({ page }) => {
    await openApp(page, '/leeact/workspace/overview');
    await page.getByText('View All').first().click();
    await expect(page).toHaveURL(/projects/);
  });
});
