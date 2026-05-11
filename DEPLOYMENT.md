# Acrophase Free Deployment Guide

## Long-term fit

This free setup is a good long-term architecture, but not a good long-term production tier.

Use it for prototypes, demos, low-traffic internal use, and early client validation. Upgrade the same architecture later when you need reliability:

- Render Free web services sleep after inactivity.
- Supabase Free has storage and inactivity limits.
- Render local filesystem is ephemeral, so generated files must be returned to the user or stored externally.

## Recommended stack

- Frontend: Vercel Hobby or Render Static Site
- Backend: Render Web Service using Docker
- Database: Supabase Postgres

## Supabase setup

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `acrophase-backend-main/supabase_schema.sql`.
4. Copy these values from Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Keep the service role key backend-only.

## Backend environment variables

Set these on Render:

```env
OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
FRONTEND_ORIGINS=https://your-frontend-domain.com
ADMIN_EMAIL=admin@acrophase.com
ADMIN_PASSWORD=change-this-before-deploying
ADMIN_FULL_NAME=System Admin
```

## Seed the admin user

After the Supabase tables exist and env vars are configured locally:

```bash
python scripts/seed_admin_supabase.py
```

## Render backend

Create a Web Service:

- Root directory: `acrophase-backend-main`
- Runtime: Docker
- Dockerfile path: `dockerfile`
- Health check path: `/`

The Dockerfile starts FastAPI on port `9002`.

## Frontend

For Vercel or Render Static Site:

- Root directory: `acrophase-frontend-main`
- Build command: `npm run build`
- Output directory: `dist`

Set:

```env
VITE_BACKEND_URL=https://your-render-backend.onrender.com
```

For local development, create `acrophase-frontend-main/.env` from `.env.example`.

## Required security cleanup

Rotate any secrets that were ever stored in local env files before deploying.
