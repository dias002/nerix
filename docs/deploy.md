# Deployment Notes

## What is now ready in the repo

- API host and port are environment-driven.
- CORS is allowlist-based through `CORS_ORIGINS`.
- Database migrations can run as a separate release step.
- A production env template exists in `.env.production.example`.
- Render and Vercel deployment manifests exist in `render.yaml` and `vercel.json`.
- A Docker image for the API can be built from `Dockerfile`.

## Recommended split

- `apps/web`: deploy as a static site.
- `apps/api`: deploy as a Node service.
- PostgreSQL: managed external database.
- Object storage: S3-compatible external bucket.

## Vercel

Use the repo root as the project root and set:

- Build command: `npm run web:build`
- Output directory: `apps/web/dist`
- Install command: `npm install`

Set `VITE_API_URL` to the public API URL.

## Render

Use `render.yaml` as the Blueprint entrypoint.

Before the first successful deploy, fill these environment variables in Render:

- `DATABASE_URL`
- `API_PUBLIC_URL`
- `WEB_APP_URL`
- `CORS_ORIGINS`
- `OPENAI_API_KEY` if real AI responses are required
- OAuth provider secrets if social login is required
- payment secrets if paid plans are required
- storage secrets if file uploads are required

## Release flow

The recommended API release flow is:

1. Build the API.
2. Run `npm --prefix apps/api run migrate:build`.
3. Start the API with `DATABASE_RUN_MIGRATIONS=false`.

## Remaining manual work

These items are outside the repo and are not auto-fixable here:

- create production PostgreSQL;
- create object storage bucket and credentials;
- issue real domain/DNS records and TLS;
- provide OAuth, payment, SMTP, and AI provider secrets;
- finish real payment contracts and webhook validation with the chosen providers;
- finish a real storage service in code for binary uploads;
- replace the remaining mock payment and non-OpenAI completion paths if they must be live on day one.

## Direct VPS deployment for Russia

Use this path when the site must open without VPN for users in Russia and when payment providers need to verify the public website directly.

This profile serves the web app from the VPS and proxies API requests through the same domain:

- Web: `https://nomduchat.com`
- API in browser: `https://nomduchat.com/api`
- Optional direct API health check: `https://api.nomduchat.com/health`

Files:

- `apps/web/Dockerfile` builds the static frontend and serves it with Caddy.
- `apps/web/Caddyfile` terminates HTTPS and proxies `/api/*` to the API container.
- `infra/russia-vps/docker-compose.yml` starts PostgreSQL, API, and web gateway.
- `infra/russia-vps/.env.example` contains the required production variables.

Server setup:

1. Point DNS records to the VPS IP:

   - `A @ -> VPS_IP`
   - `A www -> VPS_IP`
   - `A api -> VPS_IP`

2. Install Docker and Docker Compose on the VPS.

3. Copy `.env.example`:

   ```bash
   cp infra/russia-vps/.env.example infra/russia-vps/.env
   ```

4. Fill real secrets in `infra/russia-vps/.env`. At minimum:

   - `POSTGRES_PASSWORD`
   - `DATABASE_URL` with the same PostgreSQL password
   - `JWT_SECRET`
   - `ABUSE_HASH_SECRET`
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`
   - YooKassa/Kaspi credentials
   - SMTP credentials if password reset and mailings are required

5. Start the stack:

   ```bash
   npm run infra:ru:up
   ```

6. Check:

   ```bash
   curl -I https://nomduchat.com
   curl -I https://nomduchat.com/api/health
   curl -I https://api.nomduchat.com/health
   ```

Production values for OAuth and payments:

- `API_PUBLIC_URL=https://nomduchat.com/api`
- `WEB_APP_URL=https://nomduchat.com`
- `YOOKASSA_RETURN_URL=https://nomduchat.com/workspace/balance`
- VK redirect URL: `https://nomduchat.com/api/auth/oauth/vk/callback`
- Google redirect URL, if enabled outside Russia: `https://nomduchat.com/api/auth/oauth/google/callback`

After the first successful API start, set `DATABASE_RUN_MIGRATIONS=false` in `.env` and restart with `npm run infra:ru:up`. This avoids running migrations on every restart.
