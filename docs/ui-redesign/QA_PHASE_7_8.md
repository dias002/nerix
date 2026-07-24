# QA Phase 7-8

Date: 2026-07-21

Scope:

1. Phase 7: public landing route `/`.
2. Phase 8: verification pass for build, route sanity, responsive screenshots, and known limitations.

## Phase 7 Changes

The landing page now follows the Nomdu Signal Workspace direction:

1. The first viewport explains the main product idea: the user describes a task, and NomduChat builds the workflow.
2. The hero includes a product workflow demo instead of decorative floating cards.
3. The page includes sections for workflow, scenarios, model routing, media, projects, business products, pricing, updates, FAQ, and final CTA.
4. Pricing is visible before registration.
5. The page uses shared design tokens and the new landing CSS layer.
6. The landing visual language stays connected to the workspace without copying workspace layouts.

## Phase 8 QA Checklist

Manual checks to run after implementation:

1. `/` renders without console errors.
2. Header navigation links target valid page sections or existing routes.
3. Locale selector remains accessible and does not duplicate the workspace topbar selector.
4. Primary CTA opens `/workspace`.
5. Pricing CTA opens the existing pricing route.
6. Desktop layout keeps the workflow demo beside the hero text at wide widths.
7. Tablet layout collapses the hero and sections into one column without horizontal scroll.
8. Mobile layout keeps CTAs at full width and avoids one-word text columns.
9. Focus-visible is present on links and buttons.
10. `prefers-reduced-motion` disables landing transitions and animations.

Viewport targets:

1. 390 x 844
2. 768 x 1024
3. 1024 x 768
4. 1280 x 800
5. 1440 x 900
6. 1920 x 1080

## Expected Verification Commands

```bash
npm run check
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Current expected limitation:

1. `typecheck` and `lint` scripts are not defined in `apps/web/package.json`.
2. `npm run check` is the closest available project-level verification command.

## Screenshot Targets

Screenshots should be captured for:

1. `/` at 1440 x 900.
2. `/` at 390 x 844.

The screenshot review should check:

1. Hero composition.
2. Header wrapping.
3. Pricing card hierarchy.
4. Footer wrapping.
5. Mobile CTA and text fit.

## Actual Results

Commands run:

1. `npm run check` - passed.
2. `npm --prefix apps/web run typecheck` - unavailable, missing script.
3. `npm --prefix apps/web run lint` - unavailable, missing script.
4. Playwright screenshot sanity for `/` at 1440 x 900 and 390 x 844 - passed after hiding the duplicate global language switch on the landing route.
5. Playwright dark theme screenshot sanity for `/` at 1440 x 900 - passed.

Build notes:

1. API build passed.
2. API tests passed: 86 tests.
3. Web production build passed.
4. Vite still reports the existing large `AvatarStudio` chunk warning over 500 kB.

Screenshots:

1. `/private/tmp/nomdu-phase78-landing-desktop.png`
2. `/private/tmp/nomdu-phase78-landing-mobile.png`
3. `/private/tmp/nomdu-phase78-landing-dark-desktop.png`

## Known Follow-Ups

1. Full landing localization for KZ and EN is still required.
2. Lighthouse Performance and Accessibility were not automated in this pass.
3. The existing large avatar chunk warning is outside the landing scope.
4. A dedicated route-level accessibility test suite is still needed.
