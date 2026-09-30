import { type BrowserContext, type Page } from '@playwright/test';

export const SITE_URL = process.env.SITE_URL || 'https://leeact.io';

/** Every page in the sitemap. TC-SEO-03 fails when the sitemap gains a page that is not listed here. */
export const SITEMAP_PAGES = [
  '/',
  '/features/',
  '/how-it-works/',
  '/workflow/',
  '/kpis/',
  '/pricing/',
  '/download/',
  '/about-us/',
  '/testimonial/',
  '/contact/',
  '/book-a-demo/',
  '/blog/',
  '/blog/category/project-management/',
  '/blog/7-ways-to-improve-project-visibility-across-teams/',
  '/blog/ai-project-management-team-productivity/',
  '/blog/how-to-manage-multiple-projects/',
  '/blog/leeact-delivery-management-system-beyond-traditional-project-management/',
  '/blog/managing-cross-functional-teams/',
  '/blog/what-is-execution-visibility-a-complete-guide-for-project-managers/',
  '/project-management-software-for-it-companies/',
  '/ai-powered-delivery-management-software/',
  '/ai-task-clarity-scoring-for-project-teams/',
  '/client-project-management-software-for-it-service-companies/',
  '/bug-tracking-and-issue-management-for-it-teams/',
  '/flexible-project-management-software-for-agile-kanban-and-waterfall-teams/',
  '/project-feed-for-real-time-delivery-visibility/',
  '/project-signoff-and-approval-management-software/',
  '/project-time-tracking-with-work-proof/',
  '/reduce-manual-follow-ups-in-project-management/',
  '/work-management-software-for-remote-it-teams/',
  '/asana-vs-leeact/',
  '/jira-vs-leeact/',
  '/monday-vs-leeact/',
];

/** Pages linked from the site but left out of the sitemap (sign-up form, blog tag lists). */
export const UNLISTED_PAGES = [
  '/signup/',
  '/blog/tag/ai/',
  '/blog/tag/ai-project-management/',
  '/blog/tag/artificial-intelligence/',
  '/blog/tag/delivery-management/',
  '/blog/tag/productivity/',
  '/blog/tag/project-management/',
  '/blog/tag/team-productivity/',
];

export const ALL_PAGES = [...SITEMAP_PAGES, ...UNLISTED_PAGES];

/** Pages visitors reach most: checked for accessibility. */
export const KEY_PAGES = ['/', '/features/', '/pricing/', '/contact/', '/book-a-demo/', '/signup/', '/blog/', '/download/'];

/** The 11 pages in the header's Solutions menu. */
export const SOLUTION_PAGES = [
  '/ai-powered-delivery-management-software/',
  '/ai-task-clarity-scoring-for-project-teams/',
  '/bug-tracking-and-issue-management-for-it-teams/',
  '/client-project-management-software-for-it-service-companies/',
  '/flexible-project-management-software-for-agile-kanban-and-waterfall-teams/',
  '/project-feed-for-real-time-delivery-visibility/',
  '/project-management-software-for-it-companies/',
  '/project-signoff-and-approval-management-software/',
  '/project-time-tracking-with-work-proof/',
  '/reduce-manual-follow-ups-in-project-management/',
  '/work-management-software-for-remote-it-teams/',
];

/** Analytics beacons: blocked like every other write, but not counted as a form submission. */
export const ANALYTICS = /\/g55r\/|\/cdn-cgi\/rum|google-analytics|googletagmanager|googleadservices|doubleclick\.net|nel\.cloudflare|google\.[a-z.]+\/(g|rmkt|ccm|pagead)\//;

/** A Google Ads conversion beacon. */
export const AD_CONVERSION = /[?&]en=conversion(&|$)/;

/** Blocks non-GET requests on a context and returns the list of blocked ones (same as the `blocked` fixture). */
export async function blockWrites(context: BrowserContext) {
  const blocked: string[] = [];
  await context.route('**/*', route => {
    const req = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.continue();
    blocked.push(`${req.method()} ${req.url()}`);
    return route.abort('blockedbyclient');
  });
  return blocked;
}

/** Page width beyond the window, sampled for 3 s: decorative images bob up and down, so overflow comes and goes. */
export async function maxOverflow(page: Page) {
  let max = 0;
  for (let i = 0; i < 6; i++) {
    max = Math.max(max, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await page.waitForTimeout(500);
  }
  return max;
}

/** Opens a page and scrolls to the bottom and back, so lazy-loaded images and sections load. */
export async function openAndScroll(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  return res;
}

/** Reads attribute values from raw HTML, for checks that don't need a browser. */
export function attrs(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map(m => m[1]);
}

export function metaContent(html: string, key: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]*>`, 'i'))?.[0];
  return tag?.match(/content="([^"]*)"/i)?.[1];
}
