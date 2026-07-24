# Component Inventory

## Shell

| Component | Current State | Action |
| --- | --- | --- |
| `WorkspaceLayout` | Monolithic desktop shell, dialogs, role switcher, usage, mobile nav mount. | Split into shell components. |
| `MobileNavigation` | Good base, already has bottom nav and create sheet. | Re-tokenize and align with Nomdu Signal. |
| `CommandPalette` | Existing command layer. | Keep; update visual tokens later. |
| `LanguageSwitch` | Fixed globally from `App.tsx`. | Move into workspace topbar and public header contexts. |

## Feedback And Process

| Component | Current State | Action |
| --- | --- | --- |
| `EmptyState` | Reusable but framed like a card. | Update with signal illustration and less nested border. |
| `TaskProgress` | Has steps and aria-live. | Adapt into `ProcessTrail`/generation progress. |
| `ModelReason` | Useful compact model explanation. | Keep and restyle. |
| `GenerationJobCard` | Used by chat/apps/media generation jobs. | Keep; eventually integrate with `TaskDock`. |

## Base UI

| Component | Current State | Action |
| --- | --- | --- |
| `components/Button.tsx` | Custom button with old shadow/radius. | Replace with design-system Button or update variants. |
| `components/ui/*` | Radix/shadcn-like primitives. | Keep behavior; override visual variants. |
| `GlassPanel` | Heavy glass panel style. | Limit use; replace generic surfaces. |
| `DraggablePanel` | Works but visually not aligned with inspector spec. | Keep short-term, later replace with `InspectorPanel`. |

## Route Components

| Component | Size | Risk |
| --- | ---: | --- |
| `WorkspaceHome.tsx` | 68 lines | Low risk; good first route. |
| `Chat.tsx` | 2105 lines | High risk; phase changes carefully. |
| `Projects.tsx` | 484 lines | Medium risk. |
| `Apps.tsx` | 782 lines | Medium risk; contains generation logic to preserve. |
| `Media.tsx` | 271 lines | Medium risk; contains generation logic to preserve. |
| `AvatarStudio.tsx` | 3607 lines | High risk; visual changes only after shell/foundation. |
| `History.tsx` | 161 lines | Low/medium risk. |
| `BusinessCabinet.tsx` | 473 lines | Medium risk; preserve business data loading. |
| `Balance.tsx` | 797 lines | Medium/high risk; preserve payment logic. |
| `Settings.tsx` | 260 lines | Low/medium risk. |
| `Home.tsx` | 495 lines | Medium risk; public landing later. |

## New Components Needed

- `WorkspaceSidebar`
- `WorkspaceTopbar`
- `WorkspaceNavItem`
- `UsageMeter`
- `WorkspacePage`
- `PageHeader`
- `SectionHeader`
- `Surface`
- `Button`
- `IconButton`
- `Badge`
- `StatusBadge`
- `PromptComposer`
- `SignalHalo`
- `ProcessTrail`
- `TaskDock`
- `InspectorPanel`

