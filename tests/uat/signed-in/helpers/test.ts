import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { STATE, hasSession, NO_SESSION } from './app';

// Signed-in tests import `test` from here: it loads the saved UAT session and skips
// cleanly when there is none (so CI without credentials stays green).
export const test = base.extend<{ rail: Rail; blockedWrites: string[] }>({
  storageState: async ({}, use) => { await use(hasSession() ? STATE : undefined); },
  // Safety net: the test account is a Super Admin, so no signed-in test may change data.
  // Any PUT/PATCH/DELETE is aborted before it leaves the browser and recorded here.
  // (Reads use GET, and a few POSTs such as the access-control check, so POST is not blocked globally.)
  blockedWrites: [async ({ context }, use) => {
    const blocked: string[] = [];
    await context.route('**/*', route => {
      const m = route.request().method();
      if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') { blocked.push(`${m} ${route.request().url()}`); return route.abort('blockedbyclient'); }
      return route.fallback();
    });
    await use(blocked);
  }, { auto: true }],
  rail: async ({ page }, use) => { await use(new Rail(page)); },
});
test.beforeEach(() => { test.skip(!hasSession(), NO_SESSION); });
export { expect };

/**
 * Icon buttons on the right-hand strip. They have no labels (see TC-A11Y-APP-01),
 * so they are found by position: top to bottom.
 */
export class Rail {
  static readonly ORDER = ['profile', 'notifications', 'leeai', 'feedback', 'announcements', 'theme', 'apps'] as const;
  constructor(private page: Page) {}

  private indexes() {
    return this.page.evaluate(() => {
      const width = window.innerWidth;
      return [...document.querySelectorAll('button')]
        .map((b, i) => ({ i, r: b.getBoundingClientRect() }))
        .filter(x => x.r.width > 0 && x.r.left > width - 45 && x.r.top < window.innerHeight - 40)
        .sort((a, b) => a.r.top - b.r.top)
        .map(x => x.i);
    });
  }

  async button(name: typeof Rail.ORDER[number]): Promise<Locator> {
    // The strip renders after the page heading; wait until all its buttons are there.
    await expect.poll(async () => (await this.indexes()).length, { timeout: 30_000, message: 'right-hand strip did not render' })
      .toBeGreaterThanOrEqual(Rail.ORDER.length);
    const index = await this.indexes();
    return this.page.locator('button').nth(index[Rail.ORDER.indexOf(name)]);
  }

  async open(name: typeof Rail.ORDER[number]) { await (await this.button(name)).click(); }
}
