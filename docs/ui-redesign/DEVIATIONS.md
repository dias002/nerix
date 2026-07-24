# Deviations

## 2026-07-21: Phase 1-2 verification scripts

1. Requirement: run separate typecheck, lint, tests, and production build after the phase.
2. Reason: `apps/web/package.json` does not define `typecheck` or `lint` scripts, and the root package also has no lint script.
3. Closest equivalent: ran `npm --prefix apps/web run build` and root `npm run check`. The root check builds shared/api, runs API tests, and builds web.
4. Files affected: no code files affected by this deviation.
5. Follow-up: add explicit `typecheck` and `lint` scripts for web in a later infrastructure pass.
6. Status update: resolved in phase 10 by adding `apps/web` `typecheck` and static `lint` scripts and wiring them into root `npm run check`.

## 2026-07-21: Topbar model/network selector scope

1. Requirement: Topbar should include model/network selector where relevant.
2. Reason: the user limited this iteration to phases 1-2 and explicitly asked not to move to pages. A real selector needs chat/model state integration from phase 3 to avoid visual controls that do not change behavior.
3. Closest equivalent: `WorkspaceTopbar` shows a contextual `Nomdu Auto` control on chat/apps/media/avatar routes without changing route business logic.
4. Files affected: `apps/web/src/app/components/shell/WorkspaceTopbar.tsx`.
5. Follow-up: replace the contextual control with the real `ModelSelector`/`NetworkSelector` during phase 3 core workflow.

## 2026-07-21: Phase 3 progress events

1. Requirement: processing state should use real backend events and not fake exact progress.
2. Reason: chat streaming exposes response deltas and existing local progress steps, but the backend does not yet emit a normalized `TaskProgressEvent` stream for every step.
3. Closest equivalent: added `TaskDock` for active chat/media jobs and reused the existing honest indeterminate `TaskProgress` steps without claiming exact percentages.
4. Files affected: `apps/web/src/app/pages/Chat.tsx`, `apps/web/src/app/components/workspace/TaskDock.tsx`, `apps/web/src/app/components/workspace/ProcessTrail.tsx`.
5. Follow-up: add real SSE/WebSocket task events from API and connect them to `TaskDock`/`ProcessTrail`.

## 2026-07-21: Phase 4 history sources

1. Requirement: history should support chats, projects, images, video, voice, and favorites.
2. Reason: current history API returns chat conversations only. There is no unified activity endpoint for project/media/favorite events.
3. Closest equivalent: rebuilt history as grouped timeline for real chat data and added honest filters for available data only.
4. Files affected: `apps/web/src/app/pages/History.tsx`, `apps/web/src/app/components/workspace/TimelineItem.tsx`.
5. Follow-up: add a backend activity feed endpoint before showing project/media history filters.

## 2026-07-21: Project creation modal focus trap

1. Requirement: modals should trap focus and return focus after closing.
2. Reason: phase 4 used a lightweight project creation dialog to keep the change scoped and avoid pulling another modal abstraction into page logic.
3. Closest equivalent: the dialog has `role="dialog"`, `aria-modal`, Escape close, overlay close, and visible controls.
4. Files affected: `apps/web/src/app/pages/Projects.tsx`.
5. Follow-up: replace this local dialog with the shared accessible `Modal` primitive in the next foundation/accessibility pass.

## 2026-07-21: Phase 5 media generation status

1. Requirement: Media Studio should show real render stages, queue state, variants, and generation history.
2. Reason: the current web app exposes a generation job runner and job cards, but there is no complete media library, variant history, or provider-normalized progress stream for every media type.
3. Closest equivalent: rebuilt `/workspace/media` as a real studio around existing generation jobs, with honest running/empty states and no fake exact progress.
4. Files affected: `apps/web/src/app/pages/Media.tsx`, `apps/web/src/styles/workspace.css`.
5. Follow-up: add unified media assets, variant history, and backend task progress events before showing full queue/history controls.

## 2026-07-21: Phase 5 avatar editor scope

1. Requirement: Avatar should be an immersive editor with source photo, style, portrait/live mode, emotion grid, and bottom control dock.
2. Reason: `AvatarStudio` already contains working avatar generation, reference presets, live rig logic, consent checks, and profile saving. Rewriting the whole editor in the same UI phase would risk breaking the working avatar flow.
3. Closest equivalent: aligned the avatar shell, stage, inspector surface, and bottom dock with Nomdu Signal tokens while preserving existing avatar business logic.
4. Files affected: `apps/web/src/app/pages/AvatarStudio.tsx`, `apps/web/src/styles/workspace.css`.
5. Follow-up: split avatar controls into reusable inspector sections and emotion cards in a dedicated avatar UX pass.

## 2026-07-21: Phase 6 billing detail sections

1. Requirement: Balance should include a fully redesigned usage dashboard, current plan, pricing comparison, calculator, token explanation, and spend history.
2. Reason: checkout, payment history, and ledger rows are tied to existing payment behavior. The high-level balance/pricing layout was redesigned, but the lower financial rows were preserved to avoid changing billing logic during a UI pass.
3. Closest equivalent: added current plan hierarchy, usage bars, recommended/current plan states, and a clearer cost calculator while keeping existing payment and transaction flows intact.
4. Files affected: `apps/web/src/app/pages/Balance.tsx`, `apps/web/src/styles/workspace.css`.
5. Follow-up: move payment rows, ledger rows, and tariff details to shared billing components after a billing QA pass.

## 2026-07-21: Phase 6 settings detail subpages

1. Requirement: Settings should use local navigation and consistent forms across all settings pages.
2. Reason: the main settings page was rebuilt, but several nested detail pages still own their existing form internals.
3. Closest equivalent: updated the shared `SettingsDetailShell` so nested settings pages inherit the new page width, background, and header alignment.
4. Files affected: `apps/web/src/app/pages/Settings.tsx`, `apps/web/src/app/pages/SettingsProfile.tsx`.
5. Follow-up: redesign each nested settings form after route-level QA confirms all current account actions still work.

## 2026-07-21: Phase 6 business route target

1. Requirement: Business page should be an operational dashboard.
2. Reason: the workspace route `/workspace/business` is implemented by `BusinessCabinet`. The public marketing route `/business` is a different page and is outside phase 6.
3. Closest equivalent: redesigned `BusinessCabinet` as the workspace operational dashboard and left the public business landing page unchanged.
4. Files affected: `apps/web/src/app/pages/BusinessCabinet.tsx`.
5. Follow-up: redesign public `/business` during the landing phase if needed.

## 2026-07-21: Phase 7 landing localization

1. Requirement: public landing should share the global localization system.
2. Reason: the current landing copy was rebuilt in Russian to match the active market and avoid adding a large translation table inside the UI phase.
3. Closest equivalent: the locale selector still updates the app language state, but the new landing body copy remains Russian-only.
4. Files affected: `apps/web/src/app/pages/Home.tsx`.
5. Follow-up: move landing copy into the existing `i18n` dictionaries for RU, KZ, and EN.
6. Status update: resolved in phase 9. Landing copy now lives in RU, KZ, and EN translation dictionaries and `Home.tsx` reads it through `useLanguage()`.

## 2026-07-21: Phase 8 automated QA coverage

1. Requirement: run typecheck, lint, production build, responsive QA, accessibility QA, and screenshot review.
2. Reason: the project still has no separate web `typecheck` or `lint` scripts, and Lighthouse/accessibility automation is not configured.
3. Closest equivalent: use `npm run check`, web production build, and Playwright screenshot sanity for desktop and mobile.
4. Files affected: `docs/ui-redesign/QA_PHASE_7_8.md`.
5. Follow-up: add explicit web typecheck/lint scripts plus automated accessibility and Lighthouse checks.
6. Status update: partially resolved in phase 10. `typecheck`, static `lint`, and production build are now available and included in `npm run check`. Lighthouse and route-level accessibility automation still remain.
7. Status update: route-level smoke QA was added in the final hardening pass and passed for the public landing plus main workspace routes on desktop and mobile. Full Lighthouse and axe-core audits still remain.

## 2026-07-21: Phase 10 vendor chunk size

1. Requirement: production build should avoid large route chunks and keep performance under control.
2. Reason: `three` is a heavy dependency required by the avatar studio. Manual chunks now keep the avatar route code small, but the dedicated `vendor-three` chunk is still 543.41 kB minified and triggers Vite's 500 kB warning.
3. Closest equivalent: split `three`, MediaPipe vision, motion, charts, and MUI into dedicated vendor chunks instead of bundling them into page routes.
4. Files affected: `apps/web/vite.config.ts`.
5. Follow-up: lazy-load the 3D avatar renderer deeper inside `AvatarStudio` or move heavy 3D work behind an explicit user action if the warning must be fully eliminated.
6. Status update: resolved in the final hardening pass. Three.js is now split into renderer subchunks, no single JS asset exceeds the 600 kB budget, and the Vite 500 kB warning is gone.
7. Remaining limitation: Rollup reports circular manual chunks between Three renderer internals. The production build succeeds and bundle audit passes, but a later pass should simplify the Three manual chunk rules if the warning becomes noisy in CI.

## 2026-07-22: Static lint scope

1. Requirement: lint should catch UI regressions and accessibility issues.
2. Reason: the project does not include a full ESLint configuration. Adding new lint dependencies was outside the no-network hardening pass.
3. Closest equivalent: extended the existing static lint script to catch merge markers, `debugger`, `console.log`, missing image alt text in redesigned TSX, unnamed visible buttons via route QA, clickable div accessibility regressions, and hardcoded color warnings.
4. Files affected: `apps/web/scripts/lint-static.mjs`, `apps/web/scripts/qa-routes.mjs`, `package.json`, `apps/web/package.json`.
5. Follow-up: replace the static guard with full ESLint plus jsx-a11y rules when dependency installation and rule choices are approved.
6. Remaining limitation: static lint still warns about hardcoded colors in `AvatarStudio`, `Chat`, `Balance`, and workspace CSS. Some are 3D/avatar material colors or legacy Tailwind surfaces, so they are warnings instead of blocking errors.

## 2026-07-22: Business route unauthenticated request

1. Requirement: route QA should not show unexpected failed requests on main workspace pages.
2. Reason: `/workspace/business` rendered briefly before the workspace redirect and called `/business/workspace` without a token, causing a 401 in browser smoke QA.
3. Closest equivalent: `BusinessCabinet` now avoids loading business workspace data until the current user actually has business access.
4. Files affected: `apps/web/src/app/pages/BusinessCabinet.tsx`.
5. Follow-up: if the business route should show a public upsell instead of redirecting guests to chat, that needs a product decision and route access change.
