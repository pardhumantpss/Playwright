import { test as base } from '@playwright/test';
import { blockWrites } from './site';

export { expect } from '@playwright/test';

// Every test gets `blocked`: the non-GET requests the page tried to send. They are aborted before
// they leave the browser, so the contact, demo, sign-up and newsletter forms are never submitted
// and test visits send no analytics events.
// Note: request routing turns off the browser's HTTP cache, so every page load downloads all its images again.
export const test = base.extend<{ blocked: string[] }>({
  blocked: [async ({ context }, use) => {
    await use(await blockWrites(context));
  }, { auto: true }],
});
