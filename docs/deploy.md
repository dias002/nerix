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
