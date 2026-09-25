# Leeact Playwright

Playwright tests and performance scripts for https://tp.leeact.io.

## Setup

```bash
npm install
npx playwright install chromium
```

## Smoke tests

`tests/login.smoke.spec.ts` checks the signed-out pages: `/login` responds, the sign-in form renders, `/` redirects to `/login`, and the Forgot Password link works. They run on Chromium, Firefox and WebKit, and in GitHub Actions on every push to `main`.

```bash
npx playwright test
```

Tests target `https://tp.leeact.io` by default. Set `BASE_URL` to point them at another environment.

## Performance scripts

| Script | What it does |
|---|---|
| `perf-audit.js` | Public page load audit (TTFB, FCP, LCP, TBT, CLS, page weight), desktop and throttled mobile. `node perf-audit.js https://tp.leeact.io/login 5` |
| `login-capture.js` | Opens a visible browser so you can log in yourself, then saves the session to `.auth/tp-state.json`. `node login-capture.js` |
| `perf-audit-auth.js` | Same audit for signed-in pages, using the saved session. `node perf-audit-auth.js out.json <url> [<url> ...]` |
| `load-test.mjs` | Stepped load test with p50/p95/p99, stops if errors pass 5%. `node load-test.mjs https://tp.leeact.io/login 50,75,100 30 out.json` |

`.auth/` holds live session tokens and is git-ignored. Delete it when you're done testing.

Run load tests only against environments you own, and step up gradually.
