import { test, expect } from './helpers/test';
import AxeBuilder from '@axe-core/playwright';
import { openApp } from './helpers/app';

// Purpose: the main signed-in screens meet WCAG 2.1 AA as checked by axe-core.
// All violations are attached to the report; the test fails on critical ones that are not yet known.

// Known critical violations. Remove an entry once it is fixed.
const KNOWN = [
  'button-name',            // unlabeled icon buttons on the right-hand strip: TC-RAIL-12
  'aria-required-children', // data table rows/grid are missing required ARIA children (seen on 3 screens, 2026-09-25)
];

const SCREENS = [
  { name: 'All Projects', path: '/leeact/projects/all-projects' },
  { name: 'Workspace overview', path: '/leeact/workspace/overview' },
  { name: 'Project tasks', path: '/leeact/project-details/tasks' },
  { name: 'Priority Master', path: '/leeact/settings/priority' },
];

for (const s of SCREENS) {
  test(`TC-A11Y-APP ${s.name}: no new critical WCAG 2.1 AA violations`, async ({ page }, testInfo) => {
    await openApp(page, s.path);
    await page.waitForLoadState('networkidle').catch(() => {});
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await testInfo.attach('axe-results.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    for (const v of results.violations) testInfo.annotations.push({ type: `axe ${v.impact}`, description: `${v.id}: ${v.help} (${v.nodes.length})` });
    const blocking = results.violations.filter(v => v.impact === 'critical' && !KNOWN.includes(v.id));
    expect(blocking.map(v => `${v.id}: ${v.help} — ${v.nodes.length} element(s)`)).toEqual([]);
  });
}
