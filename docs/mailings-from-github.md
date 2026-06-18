# Running nomduchat Mailings From GitHub

nomduchat mailings can be started from the repository through a manual GitHub Actions workflow.

The workflow does not send email directly. It calls the production nomduchat API, and the API sends through SMTP.BZ. This keeps permissions, audit data, campaign state and recipient statuses inside the nomduchat database.

## Required Production Setup

The API server must have:

```env
NODE_ENV=production
SMTP_BZ_API_KEY=...
SMTP_BZ_BASE_URL=https://api.smtp.bz/v1
ADMIN_EMAILS=admin@example.com
MAILINGS_API_TOKEN=<long random token for GitHub Actions>
MAILINGS_API_USER_ID=local-user
```

`MAILINGS_API_USER_ID` controls which nomduchat user owns campaigns created from GitHub. Use `local-user` for a shared system mailbox, or set it to a real admin user id if you want GitHub-created campaigns visible under that account.

## GitHub Secrets

Add these in GitHub:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Required:

```text
NOMDUCHAT_API_URL=https://api.your-domain.com
NOMDUCHAT_MAILINGS_API_TOKEN=<same value as API MAILINGS_API_TOKEN>
```

Optional, useful when you do not want to commit mailing content or contacts:

```text
NOMDUCHAT_MAILING_HTML=<html body>
NOMDUCHAT_MAILING_TEXT=<plain text body>
NOMDUCHAT_MAILING_CONTACTS=<csv or newline-separated contacts>
```

Do not commit real customer contact lists into a public repository. Use secrets or a private repository with restricted access.

## Workflow

The workflow is:

```text
.github/workflows/mailings.yml
```

Run it from:

```text
GitHub -> Actions -> nomduchat Mailings -> Run workflow
```

Default `dry_run` is `true`. Keep it true for the first run. It prints the payload and does not call write/send endpoints.

## Common Runs

### Sync Existing Campaign

Inputs:

```text
action=sync_campaign
dry_run=false
campaign_id=<campaign id>
```

### Send Existing Campaign

Inputs:

```text
action=send_campaign
dry_run=false
campaign_id=<campaign id>
```

The API blocks sending the same campaign twice. Create a new campaign for another send.

### Create Audience

Inputs:

```text
action=create_audience
dry_run=false
audience_name=Учебный центр
```

### Import Contacts

Contacts can come from `NOMDUCHAT_MAILING_CONTACTS` secret or a repo file path.

Inputs:

```text
action=import_contacts
dry_run=false
audience_id=<audience id>
contacts_file=mailings/contacts/students.csv
```

### Create And Send

Inputs:

```text
action=create_and_send
dry_run=false
audience_id=<audience id>
campaign_name=June course update
from_email=info@example.com
from_name=nomduchat
reply_to=support@example.com
subject=Course update
html_file=mailings/templates/course-update.html
text_file=mailings/templates/course-update.txt
contacts_file=mailings/contacts/students.csv
```

If `contacts_file` is empty and `NOMDUCHAT_MAILING_CONTACTS` is not set, the workflow creates the campaign and sends it to the already active contacts in the audience.

## Local Run

The same script can run locally:

```bash
NOMDUCHAT_API_URL=https://api.your-domain.com \
NOMDUCHAT_MAILINGS_API_TOKEN=... \
NOMDUCHAT_MAILING_ACTION=sync_campaign \
NOMDUCHAT_MAILING_CAMPAIGN_ID=... \
npm run mailings:api
```

Dry run locally:

```bash
NOMDUCHAT_API_URL=https://api.your-domain.com \
NOMDUCHAT_MAILINGS_API_TOKEN=... \
NOMDUCHAT_MAILING_ACTION=create_campaign \
NOMDUCHAT_MAILING_DRY_RUN=true \
NOMDUCHAT_MAILING_AUDIENCE_ID=... \
NOMDUCHAT_MAILING_CAMPAIGN_NAME="Test campaign" \
NOMDUCHAT_MAILING_FROM_EMAIL=info@example.com \
NOMDUCHAT_MAILING_SUBJECT="Test" \
NOMDUCHAT_MAILING_HTML_FILE=mailings/templates/test.html \
npm run mailings:api
```

## Safety Rules

- Use `dry_run=true` first.
- Use GitHub Environment protection for the `production` environment.
- Rotate `NOMDUCHAT_MAILINGS_API_TOKEN` if it was exposed.
- Do not store real recipient lists in public Git.
- Verify the sender domain in SMTP.BZ before sending.
