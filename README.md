# Leeact Playwright

Playwright tests and performance tests for https://tp.leeact.io, and functional tests for https://uat.leecycle.dev.

## Setup

```bash
npm install
npx playwright install chromium
```

Tests target `https://tp.leeact.io` by default. Set `BASE_URL` to test another environment.

## Smoke tests

`tests/login.smoke.spec.ts` checks the signed-out pages: `/login` responds, the sign-in form renders, `/` redirects to `/login`, and the Forgot Password link works. They run on Chromium, Firefox and WebKit.

```bash
npm test
```

## Performance tests

`tests/perf/` measures page load in Chromium and fails when a page gets slower or heavier than its budget.

```bash
npm run test:perf
npm run perf:summary
```

| File | What it checks |
|---|---|
| `public-pages.spec.ts` | Login page on desktop (median of 3) and throttled mobile (Slow 4G, 4× CPU, median of 2), and the time from opening `/` to a usable login form |
| `signed-in.spec.ts` | 7 main screens after sign-in: Web Vitals, page weight, request count, duplicate and slow API calls |
| `caching.spec.ts` | Compression and cache headers, plus the known issues from the audit |
| `budgets.ts` | Budgets (enforced) and Core Web Vitals targets (reported only) |

**Budgets** come from the 2026-09-25 baseline plus headroom for network noise. When a fix lands, lower the matching budget in `budgets.ts` so the improvement is locked in.

**Known issues** in `caching.spec.ts` are marked `test.fail()`. They pass while the issue exists. When it is fixed, Playwright reports "expected to fail, but passed": delete that `test.fail()` line, and the test then guards against the issue coming back.

**Signed-in tests** need a saved session, so they skip in GitHub Actions. To run them locally, log in once with `npm run login`, which saves the session to `.auth/` (git-ignored, it holds live tokens). Delete `.auth/` when you're done.

Results are written to `perf-results/results.jsonl`, and the HTML report to `playwright-report-perf/`.

## UAT functional tests (uat.leecycle.dev)

`tests/uat/` holds the functional test suite for UAT. Every file is named for what it tests, starts with a `// Purpose:` line, and every test has an ID such as `TC-LOGIN-VAL-06`. The full list of test cases is in [docs/UAT-TEST-CASES.md](docs/UAT-TEST-CASES.md) (regenerate with `node scripts/list-uat-testcases.mjs`).

```bash
npm run login:uat            # once: log in yourself in the browser window; saves .auth/uat-state.json
npm run test:uat             # signed-out tests on 3 browsers + signed-in tests
npm run test:uat:public      # signed-out tests only (no login needed)
npm run test:uat:signed-in   # signed-in tests only
npm run test:uat:all-pages   # opens every menu page (~500 pages, ~20 min)
npm run uat:map-routes       # rebuild the page catalog when menus change
```

| Folder | What it covers |
|---|---|
| `tests/uat/public/` | Login page, login validation, password visibility, forgot password, route protection, security headers, accessibility (axe), keyboard use, responsive layout, page health |
| `tests/uat/signed-in/` | App shell navigation, All Projects list, Add Project form, Project Details sections, right-hand panels, master-data table, accessibility, every menu page, logout |

**Signed-in tests never change data.** The UAT test account is a Super Admin, so every `PUT`, `PATCH` and `DELETE` request is blocked before it leaves the browser, and the Add Project tests also block the create call. Forms are opened, checked and cancelled; nothing is saved, marked as read or submitted. Tests that submit the login or forgot-password form use `playwright.nonexistent@example.com`.

**Signed-in tests need a session.** Locally, run `npm run login:uat` once. In GitHub Actions, add repository secrets `UAT_EMAIL` and `UAT_PASSWORD` for a dedicated test account; without them, signed-in tests skip. The logout test runs only with those secrets, or with `UAT_RUN_LOGOUT=1`, because signing out can end a manually saved session.

**Parallel workers are limited to 2.** UAT runs on a single on-premises server, and more parallel browsers slow it enough to time tests out.

## GitHub Actions

| Workflow | Runs | What it does |
|---|---|---|
| Playwright Tests | Every push and pull request to `main` | Smoke tests on 3 browsers |
| Performance Tests | Every push to `main`, daily at 09:00 IST, or by hand | Performance tests; results table on the run page, report as a download |
| Load Test | By hand only (Actions tab → Load Test → Run workflow) | Stepped load test on the login page or languages API, max 100 users |
| UAT Tests | Every push to `main`, daily at 08:30 IST, or by hand (standard, all pages, or signed-out only) | UAT functional suite; HTML report as a download |

## Standalone scripts

| Script | What it does |
|---|---|
| `perf-audit.js` | One-off page load audit with raw JSON output. `node perf-audit.js https://tp.leeact.io/login 5` |
| `perf-audit-auth.js` | The same for signed-in pages. `node perf-audit-auth.js out.json <url> [<url> ...]` |
| `login-capture.js` | Opens a browser so you can log in yourself, then saves the session to `.auth/tp-state.json` |
| `load-test.mjs` | Stepped load test with p50/p95/p99. Stops if errors pass 5%, refuses more than 100 users unless `ALLOW_HIGH_LOAD=1`. `node load-test.mjs https://tp.leeact.io/login 10,25,50 30 out.json` |

Run load tests only against environments you own, and step up gradually.
