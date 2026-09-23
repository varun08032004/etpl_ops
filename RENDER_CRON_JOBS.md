# Render Cron Jobs Setup for Compliance Alerts

This document describes how to set up the daily compliance cron job on Render.

## Option 1: Render Cron Job (Recommended for Render deployments)

### 1. Create a Cron Job in Render Dashboard

1. Go to your Render dashboard
2. Click "New" → "Cron Job"
3. Configure:
   - **Name**: `etpl-ops-compliance-cron`
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm ci`
   - **Start Command**: `cd backend && npm run compliance:cron`
   - **Schedule**: `0 6 * * *` (Daily at 06:00 UTC = 11:30 AM IST)
   - **Timezone**: UTC

### 2. Environment Variables (add in Render Cron Job settings)

| Variable | Value | Source |
|----------|-------|--------|
| `INTERNAL_OPS_DATABASE_URL` | Your Supabase connection string | Secret |
| `RESEND_API_KEY` | `re_...` | Secret |
| `RESEND_FROM_EMAIL` | `founder@ethertrack.in` | Secret |
| `INTERNAL_OPS_JWT_SECRET` | Your JWT secret | Secret |
| `INTERNAL_OPS_REFRESH_SECRET` | Your refresh secret | Secret |
| `INTERNAL_OPS_ALLOWED_ORIGIN` | `https://ops.ethertrack.in,https://your-frontend-domain` | Secret |
| `APP_BASE_URL` | `https://ops.ethertrack.in` | Secret |
| `COMPLIANCE_CRON_SECRET` | Generate a random string (e.g., `openssl rand -hex 32`) | Secret |
| `NODE_ENV` | `production` | Plain text |

### 3. Deploy and Test

1. Save the cron job
2. Click "Run" to test manually
3. Check logs for output

---

## Option 2: GitHub Actions (Already configured)

The `.github/workflows/compliance-cron.yml` workflow runs daily at 06:00 UTC via GitHub Actions.

### Required GitHub Secrets

Add these in GitHub repository Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `INTERNAL_OPS_DATABASE_URL` | Supabase connection string |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | `founder@ethertrack.in` |
| `INTERNAL_OPS_JWT_SECRET` | JWT secret |
| `INTERNAL_OPS_REFRESH_SECRET` | Refresh token secret |
| `INTERNAL_OPS_ALLOWED_ORIGIN` | Comma-separated allowed origins |
| `APP_BASE_URL` | `https://ops.ethertrack.in` |
| `COMPLIANCE_CRON_SECRET` | Random string for cron auth |
| `SLACK_WEBHOOK_URL` | (Optional) Slack webhook for failure alerts |

---

## What the Cron Job Does

The cron job (`scripts/run-compliance-cron.js`) calls three endpoints:

1. **`POST /api/v1/compliance/run-reminders`**
   - Checks all compliance items not filed
   - Sends reminders at 30, 15, 7, 1 days before due date
   - Escalates to admin@ethertrack.in if 48h after final reminder with no action

2. **`POST /api/v1/one-time-registrations/check-thresholds`**
   - Re-evaluates statutory thresholds (EPFO, ESIC, GST, Professional Tax)
   - Alerts if new registrations become legally required

3. **`POST /api/v1/data-governance/scan`** (optional)
   - Scans for records past retention period
   - Flags for human review

---

## Email Alerts Configuration

The system uses automation rules to send emails. Ensure these rules exist in the database:

```sql
-- Run db/seed_compliance_automation_rules.sql after migrations
```

The rules send emails to `admin@ethertrack.in` for:
- **Due Soon**: 30, 15, 7, 1 days before due date
- **Escalated**: 48 hours after final (1-day) reminder if not filed

---

## Testing Locally

```bash
cd backend
npm run compliance:cron
```

---

## Monitoring

- Check Render Cron Job logs for execution history
- Check GitHub Actions workflow runs
- Monitor `admin@ethertrack.in` for compliance alert emails
- Check in-app notifications in the EtherTrack Ops dashboard