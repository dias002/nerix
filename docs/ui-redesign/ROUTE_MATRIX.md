# Route Matrix

## Public Routes

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `Home` | Public landing; should use Nomdu Signal but be more expressive than workspace. |
| `/about` | `About` | Public informational page. |
| `/faq` | `Faq` | Public FAQ. |
| `/contacts` | `Contacts` | Public contacts. |
| `/translate` | `Translate` | Public tool that opens workspace chat. |
| `/models` | `Models` | Public model catalog. |
| `/business` | `Business` | Public business landing. |
| `/support` | `Support` | Public support page. |
| `/auth` | `Auth` | Login/register. |
| `/auth/reset` | `PasswordReset` | Password reset flow. |
| `/ai/flux-2` | `PublicAiTool` | Public image tool page. |
| `/tools/dizajn-interyera` | `PublicAiTool` | Public interior design tool page. |
| `/tools/humanizer` | `PublicAiTool` | Public humanizer page. |
| `/seo/articles` | `SeoArticles` | SEO/blog list. |
| `/seo/articles/:slug` | `SeoArticles` | SEO/blog detail. |
| `/chat` | redirect | Redirects to `/workspace/chat`. |
| `/chat/apps` | redirect | Redirects to `/workspace/apps`. |
| `/chat/projects` | redirect | Redirects to `/workspace/projects`. |
| `/chat/media` | redirect | Redirects to `/workspace/media`. |

## Workspace Routes

| Route | Component | Target Layout |
| --- | --- | --- |
| `/workspace` | `WorkspaceHome` | Composer-first workspace home. |
| `/workspace/home` | `WorkspaceHome` | Same as index. |
| `/workspace/chat` | `Chat` | Conversation plus optional inspector. |
| `/workspace/projects` | `Projects` | Project grid/list, creation in modal/drawer. |
| `/workspace/apps` | `Apps` | Tool catalog with featured tool and filters. |
| `/workspace/media` | `Media` | Media Studio: setup, canvas, inspector. |
| `/workspace/avatar` | `AvatarStudio` | Immersive avatar editor. |
| `/workspace/history` | `History` | Timeline/list with filters. |
| `/workspace/agents` | `Agents` | Agent catalog; later merge with tools/assistants direction. |
| `/workspace/memory` | `Memory` | Memory management. |
| `/workspace/mailings` | `Mailings` | Admin/business mailing flow. |
| `/workspace/business` | `BusinessCabinet` | Operational dashboard. |
| `/workspace/business/dialogs` | `BusinessDialogs` | Customer dialogs. |
| `/workspace/business/ideas` | `BusinessIdeas` | Growth ideas. |
| `/workspace/business/analytics` | `BusinessEmployeeAnalytics` | Employee analytics. |
| `/workspace/business/telegram-bot` | `BusinessTelegramBot` | Telegram bot setup. |
| `/workspace/business/website` | `BusinessWebsiteBuilder` | Business website builder. |
| `/workspace/balance` | `Balance` | Usage, current plan, pricing, token history. |
| `/workspace/settings` | `Settings` | Settings hub with local nav. |
| `/workspace/settings/profile` | `SettingsProfile` | Profile form. |
| `/workspace/settings/appearance` | `SettingsAppearance` | Appearance. |
| `/workspace/settings/notifications` | `SettingsNotifications` | Notifications. |
| `/workspace/settings/memory` | `Memory` | Memory settings alias. |
| `/workspace/admin/*` | `Admin` | Admin workspace; keep separate but align shell where safe. |

## Access Notes

- Workspace access is controlled by `roleAccess.ts`.
- Business routes depend on `access.canUseBusiness*`.
- Admin routes have a separate navigation mode in `WorkspaceLayout`.
- Redesign must preserve these route semantics.

