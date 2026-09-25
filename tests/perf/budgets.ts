// Performance budgets for tp.leeact.io.
//
// Budgets are regression limits: set from the 2026-09-25 baseline plus headroom for
// network noise, so they pass today and fail when a page gets clearly slower or heavier.
// Tighten them as fixes land. Targets are where we want to be (Core Web Vitals "good")
// and are only reported, not enforced.

export const BASE_URL = process.env.BASE_URL || 'https://tp.leeact.io';

export type MetricKey =
  | 'ttfb' | 'fcp' | 'lcp' | 'tbt' | 'cls' | 'readyMs'
  | 'transferKB' | 'requests' | 'largestScriptKB' | 'apiMaxDuplicates' | 'apiSlowestMs';

export type Budget = Partial<Record<MetricKey, number>>;

export const targets: Budget = { ttfb: 800, fcp: 1800, lcp: 2500, tbt: 200, cls: 0.1 };

export const budgets = {
  login: {
    // Baseline: TTFB 0.8 s, FCP 3.6 s, LCP 3.8 s, TBT 450 ms, 2.9 MB, 71 requests
    desktop: { ttfb: 2000, fcp: 6000, lcp: 6500, tbt: 1000, cls: 0.1, transferKB: 3500, requests: 90, largestScriptKB: 1200 },
    // Baseline: FCP 18.0 s, LCP 18.5 s, TBT 2.6 s
    mobile: { fcp: 25000, lcp: 25000, tbt: 5000, cls: 0.1 },
  },
  // Baseline: 6.1 s from opening / to a usable login form
  rootToLogin: { desktop: { readyMs: 10000 } },
  signedIn: {
    // Baseline: LCP 3.3–4.6 s, TBT 0.2–0.7 s, ~22 MB (19.8 MB is share-feedback.gif), up to 4 duplicate API calls
    desktop: { fcp: 6000, lcp: 7000, tbt: 1500, cls: 0.1, transferKB: 25000, requests: 150, apiMaxDuplicates: 4, apiSlowestMs: 3000 },
  },
} satisfies Record<string, Record<string, Budget>>;

export const signedInScreens = [
  { name: 'All Projects', path: '/leeact/projects/all-projects?ws=4' },
  { name: 'Workspace directory', path: '/leeact/workspace/workspace-directory?ws=4' },
  { name: 'Project details overview', path: '/leeact/project-details/overview?ws=4' },
  { name: 'Resources directory', path: '/leeact/resources/directory?ws=4' },
  { name: 'Productivity retrospective', path: '/leeact/productivity/retrospective?ws=4' },
  { name: 'Finance budgets', path: '/leeact/finance/budgets' },
  { name: 'Compliance policies', path: '/leeact/compliance/policies' },
];
