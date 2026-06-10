# Acrophase Report Generator Handover

## System Overview

- GitHub repository: `https://github.com/sukebhargav-alt/ReportGEN`
- Frontend: React/Vite in `acrophase-frontend-main`
- Backend: FastAPI/Python in `acrophase-backend-main`
- Deployment: Render Blueprint defined in `render.yaml`
- Database: Supabase Postgres
- External services: OpenAI API and VALD API

The application generates DynaMo, ForceDecks, CPET, and profiling reports.

## Access To Transfer

Invite the new owner or developer separately to:

1. GitHub repository with Admin or Maintain access.
2. Render workspace with access to both services:
   - `acrophase-backend`
   - `acrophase-frontend`
3. Supabase organization/project with Developer or Owner access.
4. OpenAI project with permission to manage the API key used by the backend.
5. VALD developer/API account with access to the configured tenant.

Do not send service-role keys, API keys, or passwords through email or chat.
Transfer access through each provider, then rotate secrets during handover.

## Required Render Environment Variables

Backend:

```text
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FRONTEND_ORIGINS
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_FULL_NAME
VALD_CLIENT_ID
VALD_CLIENT_SECRET
VALD_AUTH_URL
VALD_AUDIENCE
VALD_REGION
VALD_SUPABASE_URL
VALD_SUPABASE_SERVICE_ROLE_KEY
```

Frontend:

```text
VITE_BACKEND_URL
```

The Render Blueprint automatically connects `VITE_BACKEND_URL` and
`FRONTEND_ORIGINS` when both services are deployed from `render.yaml`.

## Local Development

Backend:

```powershell
cd acrophase-backend-main
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 9002
```

Frontend:

```powershell
cd acrophase-frontend-main
npm install
npm run dev
```

Create local `Backend.env` and `Frontend.env` files from the corresponding
`.env.example` files. These files contain secrets and must not be committed.

## Database Setup

Expected application tables are defined in:

- `acrophase-backend-main/supabase_schema.sql`
- `acrophase-backend-main/vald_schema.sql`
- `supabase/migrations/20260610090000_initialize_acrophase_database.sql`

Database status verified on June 10, 2026:

- All expected application and VALD tables are available.
- 241 VALD athletes, 810 tests, and 13,429 metrics are stored.
- DynaMo and ForceDecks sync cursors are current.
- A deployable migration is available for rebuilding or cloning the schema.
- Historical data is part of the existing Supabase project transfer. Creating
  a fresh project from the migration alone creates the schema but does not copy
  the existing rows.

Verify the configured project at any time:

```powershell
cd acrophase-backend-main
.\.venv\Scripts\python.exe scripts\verify_supabase.py
```

After the schema exists, run a full VALD sync:

```text
POST /vald/sync
```

Then verify:

- Athlete autocomplete returns VALD athletes.
- Assessment dates appear for DynaMo and ForceDecks.
- Reports can load data for multiple athletes and dates.

## Current Deployment State

At the last handover check on June 10, 2026:

- Git branch `main` was clean and matched `origin/main`.
- The Supabase database schema and VALD data were verified successfully.
- A full VALD sync completed without warnings or errors.
- The assumed Render backend URL returned HTTP 503.

Review Render deployment logs and Supabase migration/deployment logs before
considering production operational.

## Verification Checklist

1. Frontend loads without console errors.
2. Backend root health check returns HTTP 200.
3. Login/admin access works.
4. Supabase contains all expected application and VALD tables.
5. `POST /vald/sync` completes successfully.
6. VALD athlete search and assessment-date filtering work.
7. DynaMo draft Word and final PDF generation work.
8. ForceDecks draft Word and final PDF generation work.
9. CPET file processing, ACSM insights, draft Word, and final PDF work.
10. Render environment variables contain valid newly rotated secrets.

## Security Handover

Rotate these credentials after the new owner has access:

- Supabase service-role keys
- OpenAI API key
- VALD client secret
- Admin password

Remove the previous owner's access only after the new owner completes the
verification checklist.
