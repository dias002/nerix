# Nomdu Signal Workspace UI Audit

Date: 2026-07-21

## Stack

- Frontend: React 18, Vite, TypeScript.
- Router: React Router 7 with lazy route components in `apps/web/src/app/routes.tsx`.
- Styling: Tailwind v4, global CSS in `apps/web/src/styles/theme.css`, `tw-animate-css`.
- UI primitives: Radix/shadcn-like components in `apps/web/src/app/components/ui`.
- Icons: Lucide is the main icon library; MUI icons are installed but should not be introduced into new workspace UI.
- Motion: `motion/react` is available; most component feedback can use CSS transitions.
- Data: direct API clients in `apps/web/src/app/api-client`; no React Query layer.

## Current Visual Problems

1. Workspace UI reads as a wireframe because almost every block uses `border-white/10`, dark fill, and similar radius.
2. Page compositions are too similar: several routes use card grids even when the task needs a studio, timeline, or dashboard pattern.
3. `WorkspaceLayout.tsx` mixes shell, navigation, usage, profile, onboarding, subscription warnings, and role switching in one large file.
4. `Chat.tsx` and `AvatarStudio.tsx` contain both product logic and heavy visual layout logic, making phased redesign risky.
5. Tokens are not authoritative yet. `theme.css` contains legacy monochrome tokens, `nd-*` tokens, light-mode overrides, and many direct utility colors remain in route components.
6. Sidebar active state uses multiple indicators at once: background, ring, icon color, and a left line.
7. Locale switching is globally fixed in `App.tsx`, so workspace topbar cannot own it and public/workspace contexts are visually mixed.
8. The workspace home route is a transition screen with a CTA to chat instead of a real composer-first workspace.
9. Apps and Media have working generation logic, but visually read as documentation/landing content rather than tools and studio surfaces.
10. Empty states still use framed containers and example chips without a recognizable Nomdu Signal motif.
11. Interface copy mixes Russian and English labels: `Business`, `Free`, `Tools`, `studio`, `premium cover`, `apps`.
12. Several secondary texts use very dark gray utility classes, reducing readability.

## Duplicated Or Overlapping Components

- Button styling exists in `components/Button.tsx`, `nd-primary-action`, direct Tailwind classes, and shadcn button variants.
- Card styling exists in `nd-card`, shadcn card, `GlassPanel`, direct route containers, and custom empty states.
- Empty/loading/error states are scattered between `EmptyState`, route-level markup, `GenerationJobCard`, and dialogs.
- Navigation is split between desktop sidebar in `WorkspaceLayout`, `MobileNavigation`, command palette entries, and route redirects.
- Model/process feedback appears in `ModelReason`, `TaskProgress`, chat generation UI, and media generation cards.

## Random Values And Grid Issues

- Frequent direct values: `rounded-2xl`, `rounded-3xl`, `p-5`, `p-6`, `md:p-12`, `bg-[#050505]`, `bg-[#080808]`, `border-white/10`.
- Sidebar uses `md:w-64` instead of the required 272px expanded width.
- Workspace content margins are tied to `md:ml-64` instead of shell tokens.
- Right panels are sometimes draggable floating panels rather than a contextual inspector.
- Public global language switch occupies fixed top-right space and can conflict with page headers.

## Missing Or Weak States

- Some primary actions have hover/disabled but no loading or success state.
- Composer focus state is not unified by a signal halo.
- Active generation state is route-specific; there is no global Task Dock.
- Empty states explain what is missing but rarely show a concrete next step with a branded visual.
- Mobile drawers and panels need consistent focus/escape handling.

## Pages That Feel Unfinished

- `/workspace`: too empty and indirect.
- `/workspace/apps`: useful tools exist, but preview area can look like missing content when no generation is running.
- `/workspace/media`: generation works, but the route is not yet a studio layout.
- `/workspace/history`: mostly list/empty state, not a timeline.
- `/workspace/settings`: lacks local settings navigation and consistent save states.

## Reusable Elements

- API clients and backend workflows should be preserved.
- `CommandPalette`, `MobileNavigation`, `EmptyState`, `TaskProgress`, `ModelReason`, `useGenerationJobRunner`, and `GenerationJobCard` can be adapted.
- Radix UI primitives should remain the accessibility foundation.
- Lucide remains the single icon system.

## Components To Replace Or Create

- Replace the monolithic workspace shell with `WorkspaceSidebar`, `WorkspaceTopbar`, `UsageMeter`, and shell dialogs.
- Create design-system components for `Button`, `IconButton`, `Surface`, `Card`, `Panel`, `Badge`, `StatusBadge`, `PromptComposer`, `SignalHalo`, `TaskDock`, and `ProcessTrail`.
- Introduce page layout helpers: `WorkspacePage`, `PageHeader`, `SectionHeader`, `InspectorPanel`.

## Implementation Direction

Proceed in phases:

1. Foundation: tokens, typography, motion, surfaces, buttons, fields, badges.
2. Shell: sidebar groups, topbar, locale, usage, mobile behavior.
3. Core workflow: `/workspace` and `/workspace/chat`.
4. Organization: projects and history.
5. Creation: apps, media, avatar.
6. Business/billing/settings.
7. Public landing.
8. QA and screenshots.

