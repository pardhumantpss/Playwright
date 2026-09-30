// Site defects found on 2026-09-30. Tests for these pages are marked test.fail(), so the suite stays
// green while the defect exists and reports "expected to fail, but passed" once it is fixed.
// When that happens, delete the page from its list here.

const BLOG_LISTS = [
  '/blog/',
  '/blog/category/project-management/',
  '/blog/tag/ai/',
  '/blog/tag/ai-project-management/',
  '/blog/tag/artificial-intelligence/',
  '/blog/tag/delivery-management/',
  '/blog/tag/productivity/',
  '/blog/tag/project-management/',
  '/blog/tag/team-productivity/',
];

export const KNOWN = {
  /** Blog index, category and tag pages have no <h1>. */
  noH1: BLOG_LISTS,

  /** No <link rel="canonical">. */
  noCanonical: ['/signup/'],

  /** Links with href="#" that go nowhere: 4 "Explore …" and 3 "See it in action" on the home page, Terms and Privacy on sign-up. */
  placeholderLinks: ['/', '/signup/'],

  /** tel:+01725013237: "+" must be followed by a country code, so phones can't dial it. */
  badPhoneLinks: ['/contact/'],

  /** At 1280 px the page scrolls 3 px sideways. Cause: the bobbing decorative image in the footer call-to-action
   *  (div.floating-1) sticks out past the right edge. /features/ is fine because its section has overflow: clip. */
  desktopOverflow: [
    '/', '/about-us/', '/ai-powered-delivery-management-software/', '/ai-task-clarity-scoring-for-project-teams/',
    '/asana-vs-leeact/', '/book-a-demo/', '/bug-tracking-and-issue-management-for-it-teams/',
    '/client-project-management-software-for-it-service-companies/', '/download/',
    '/flexible-project-management-software-for-agile-kanban-and-waterfall-teams/', '/how-it-works/',
    '/jira-vs-leeact/', '/monday-vs-leeact/', '/pricing/', '/project-feed-for-real-time-delivery-visibility/',
    '/project-management-software-for-it-companies/', '/project-signoff-and-approval-management-software/',
    '/project-time-tracking-with-work-proof/', '/reduce-manual-follow-ups-in-project-management/',
    '/testimonial/', '/work-management-software-for-remote-it-teams/', '/workflow/',
  ],

  /** On a phone (393 px) the page is 410 px wide: the team slider sticks out on the right. */
  mobileOverflow: ['/about-us/'],

  /** Pages that load at least one image over 1 MB (uncompressed PNG/JPG, up to 3.3 MB). */
  heavyImages: [
    '/about-us/', '/asana-vs-leeact/', '/bug-tracking-and-issue-management-for-it-teams/',
    '/client-project-management-software-for-it-service-companies/',
    '/flexible-project-management-software-for-agile-kanban-and-waterfall-teams/', '/jira-vs-leeact/',
    '/project-management-software-for-it-companies/', '/project-signoff-and-approval-management-software/',
    '/reduce-manual-follow-ups-in-project-management/', '/work-management-software-for-remote-it-teams/',
  ],

  /** Serious or critical axe violations, by page. */
  axe: {
    '/': ['color-contrast'],
    '/features/': ['color-contrast'],
    '/pricing/': ['color-contrast'],
    '/contact/': ['color-contrast'],
    '/book-a-demo/': ['color-contrast'],
    '/blog/': ['color-contrast'],
    '/download/': ['color-contrast'],
    '/signup/': ['button-name'],
  } as Record<string, string[]>,
};
