# QA Phase 9-10

Date: 2026-07-21

Scope:

1. Phase 9: move public landing copy into the shared localization system.
2. Phase 10: add web verification scripts and reduce route bundle pressure with manual vendor chunks.
3. Final hardening: add route smoke QA, bundle budget audit, and close the remaining oversized Three.js chunk warning.

## Phase 9 Changes

1. Added `home.landing` translation dictionaries for RU, KZ, and EN.
2. Updated the public landing route `/` to read copy from `useLanguage()` instead of hardcoded Russian constants.
3. Kept route semantics, CTA links, analytics goals, and visual layout unchanged.
4. Preserved registered product/model names in English where appropriate.

## Phase 10 Changes

1. Added `npm --prefix apps/web run typecheck`.
2. Added `npm --prefix apps/web run lint` as a static repository guard for merge markers, `debugger`, `console.log`, `DO NOT SUBMIT`, and selected redesigned UI accessibility regressions.
3. Wired `web:typecheck`, `web:lint`, and `web:build` into root `npm run check`.
4. Added a web `tsconfig.json` for Vite/React type checking.
5. Added Vite manual chunks for heavy vendor groups: Three.js renderer internals, MediaPipe vision, motion, MUI, and charts.
6. Fixed TypeScript issues surfaced by the new check without changing runtime behavior.

## Final Hardening Changes

1. Added `npm --prefix apps/web run bundle:audit` with a blocking 600 kB JS asset budget and route chunk budget checks.
2. Added `npm --prefix apps/web run qa:routes` for Playwright smoke checks across the public landing and main workspace routes.
3. Added root aliases `web:bundle:audit` and `web:qa:routes`.
4. Extended root `npm run check` to include bundle audit after production build.
5. Split the avatar Three.js dependency into smaller renderer subchunks and replaced the broad `THREE.*` namespace import with granular imports.
6. Prevented `/workspace/business` from calling `/business/workspace` before business access exists, removing an unauthenticated 401 during route smoke.

## Verification

Commands run:

1. `npm --prefix apps/web run typecheck` - passed.
2. `npm --prefix apps/web run lint` - passed.
3. `npm --prefix apps/web run build` - passed.
4. `npm run check` - passed.
5. Playwright landing i18n sanity for RU, EN, and KZ - passed.
6. Playwright screenshot sanity for `/` at 1440 x 900 and 390 x 844 - passed.
7. `npm run web:qa:routes` - passed for 10 routes on desktop and mobile.
8. `npm run web:bundle:audit` - passed.

Root check details:

1. Shared build passed.
2. API build passed.
3. API tests passed: 86 tests.
4. Web typecheck passed.
5. Web static lint passed with non-blocking hardcoded-color warnings.
6. Web production build passed.
7. Web bundle audit passed.

Build notes:

1. `AvatarStudio` route chunk is now about 124 kB minified after granular Three imports.
2. MediaPipe vision is split into `vendor-vision` at about 126 kB minified.
3. Motion is split into `vendor-motion` at about 133 kB minified.
4. Three.js renderer internals are split into smaller chunks; the largest are `vendor-three-webgl` at about 246 kB and `vendor-three-shaders` at about 214 kB.
5. The app entry chunk is about 369 kB minified.
6. No JS asset exceeds the 600 kB bundle audit budget.
7. Vite no longer emits the 500 kB chunk size warning.
8. Rollup still emits circular manual chunk warnings between Three renderer internals. The build succeeds and bundle audit passes.

Route smoke scope:

1. `/`
2. `/workspace`
3. `/workspace/chat`
4. `/workspace/projects`
5. `/workspace/apps`
6. `/workspace/media`
7. `/workspace/avatar`
8. `/workspace/business`
9. `/workspace/balance`
10. `/workspace/settings`

Route smoke checks:

1. Desktop viewport: 1440 x 900.
2. Mobile viewport: 390 x 844.
3. Page rendered with meaningful body text.
4. No horizontal overflow above 2 px.
5. No visible unnamed buttons.
6. No images without `alt`.
7. No route error boundary.
8. No unexpected 4xx/5xx responses. Expected unauthenticated `/auth/me` 401 is allowed.

Landing i18n sanity:

1. RU H1: `Не выбирайте нейросеть. Опишите задачу — NomduChat соберёт рабочий процесс.`
2. EN H1: `Do not choose a neural network. Describe the task — NomduChat will build the workflow.`
3. KZ H1: `Нейрожеліні таңдамаңыз. Тапсырманы сипаттаңыз — NomduChat жұмыс процесін құрады.`

Screenshots:

1. `/private/tmp/nomdu-phase910-landing-desktop.png`
2. `/private/tmp/nomdu-phase910-landing-mobile.png`

## Remaining Follow-Ups

1. Replace the static lint guard with full ESLint and jsx-a11y once dependency installation and rules are approved.
2. Add Lighthouse automation for landing and workspace routes.
3. Add axe-core accessibility automation for keyboard navigation, contrast, ARIA states, and modal focus traps.
4. Clean up remaining hardcoded UI colors in `Chat`, `Balance`, and `workspace.css`; keep avatar material colors separate from UI tokens.
5. Simplify Three.js manual chunk rules if Rollup circular chunk warnings become a CI problem.
