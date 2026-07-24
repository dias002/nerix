# Nomdu Signal Workspace Implementation Plan

## Phase 1: Foundation

Status: implemented.

- Add dedicated CSS files for tokens, typography, motion, and utilities.
- Import them from `styles/index.css`.
- Map existing `nd-*` classes to Nomdu Signal tokens to avoid breaking current pages.
- Update focus-visible, reduced motion, buttons, inputs, cards, badges, panels, and shell surfaces.

## Phase 2: Shell

Status: implemented.

- Split `WorkspaceLayout` into:
  - `WorkspaceSidebar`
  - `WorkspaceTopbar`
  - `UsageMeter`
  - shell dialogs or local helpers.
- Move locale switch into topbar for workspace.
- Keep public language switch available outside workspace.
- Group sidebar navigation by Work, Creation, Management.
- Use a single active indicator with signal line.

## Phase 3: Core Workflow

Status: implemented with honest progress fallbacks.

- Rebuild `/workspace` around `PromptComposer`.
- Add compact quick actions.
- Show continue-work data when available; otherwise onboarding block.
- Start introducing `TaskDock` for active generation jobs.
- Rework `/workspace/chat` in smaller steps because `Chat.tsx` is large.

## Phase 4: Organization

Status: implemented with current backend data scope.

- Rework `/workspace/projects` with page header, filters, project grid/list, creation modal/drawer.
- Rework `/workspace/history` as grouped timeline/list.

## Phase 5: Creation

Status: implemented with current generation job capabilities.

- Rework `/workspace/apps` into a real tool catalog.
- Rework `/workspace/media` into Media Studio.
- Rework `/workspace/avatar` only after preserving current avatar generation/live logic.

## Phase 6: Business, Balance, Settings

Status: implemented with existing billing and settings flows preserved.

- Rework business dashboard hierarchy.
- Rework balance with current plan, usage, calculator, token history.
- Rework settings with local nav and consistent save states.

## Phase 7: Landing

Status: implemented and localized for RU, KZ, and EN.

- Rebuild `/` with interactive workflow demo and public sections.
- Keep landing expressive but based on the same tokens.

## Phase 8: QA

Status: implemented as build/typecheck/static lint/bundle audit/route smoke. Full Lighthouse and axe-core automation remains a follow-up.

- Run `npm run check`.
- Review desktop and mobile sizes:
  - 390x844
  - 768x1024
  - 1024x768
  - 1280x800
  - 1440x900
  - 1920x1080
- Verify reduced motion, keyboard navigation, loading, empty, disabled, and error states.
