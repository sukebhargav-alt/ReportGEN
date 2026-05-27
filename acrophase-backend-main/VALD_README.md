# VALD Performance Data Service

This backend mirrors VALD Dynamo and ForceDecks data into Supabase Postgres and exposes a name-based lookup API.

NordBord is intentionally not included.

## Environment Variables

```env
VALD_CLIENT_ID=your-vald-client-id
VALD_CLIENT_SECRET=your-vald-client-secret
VALD_AUTH_URL=https://auth.prd.vald.com/oauth/token
VALD_AUDIENCE=vald-api-external
VALD_REGION=aue

VALD_SUPABASE_URL=https://xkskhkroosddxmyufxsw.supabase.co
VALD_SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

If `VALD_SUPABASE_URL` and `VALD_SUPABASE_SERVICE_ROLE_KEY` are omitted, the service falls back to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Database

Run `vald_schema.sql` in the Supabase SQL editor before syncing.

## Sync

Trigger a full Dynamo + ForceDecks sync:

```bash
curl -X POST https://your-backend.onrender.com/vald/sync
```

Recommended cron schedule: every 6 hours. The sync is idempotent and has a 4-minute runtime budget.

## Lookup

```bash
curl "https://your-backend.onrender.com/athlete-report?name=Jane%20Doe"
```

Optional filters:

```bash
curl "https://your-backend.onrender.com/athlete-report?name=Jane%20Doe&from=2026-01-01&to=2026-05-01&test_type=CMJ&latest_only=true"
```

Response shape:

```json
{
  "athlete": { "vald_id": "...", "name": "Jane Doe" },
  "dynamometer": { "tests": [] },
  "forcedecks": { "tests": [] }
}
```
