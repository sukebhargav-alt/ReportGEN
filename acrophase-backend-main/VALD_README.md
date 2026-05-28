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

Recommended cron schedule: every 6 hours. The sync is idempotent and has a
4-minute runtime budget. Scheduled synchronization refreshes active profiles and
indexes the latest 30 days of DynaMo and ForceDecks assessment dates promptly.
When an athlete and assessment date are requested, that selected date's detailed
metrics are hydrated directly from VALD if stored data is missing, so historical
reports do not depend on a bulk detail backfill completing first.

## Lookup

```bash
curl "https://your-backend.onrender.com/athlete-report?name=Jane%20Doe"
```

Optional filters:

```bash
curl "https://your-backend.onrender.com/athlete-report?name=Jane%20Doe&from=2026-01-01&to=2026-05-01&test_type=CMJ&latest_only=true"
```

To fetch only the report surface being displayed:

```bash
curl "https://your-backend.onrender.com/athlete-report?name=Jane%20Doe&device=dynamometer&assessment_date=2026-05-01&sport=Badminton&latest_only=true"
```

`assessment_date` scopes the result to tests recorded on that UTC calendar day.
`sport` is retained in report context for sport-specific interpretation and PDF output.

Athlete typeahead:

```bash
curl "https://your-backend.onrender.com/vald/athletes?q=Sidd"
```

This refreshes the active VALD profile directory periodically and returns matching
athletes with their stable VALD IDs. Pass the selected `athlete_id` to
`/athlete-report` to avoid ambiguous names.

Available assessment dates for the selected athlete and surface:

```bash
curl "https://your-backend.onrender.com/vald/athletes/ATHLETE_ID/assessment-dates?device=dynamometer"
```

Response shape:

```json
{
  "athlete": {
    "vald_id": "...",
    "name": "Jane Doe",
    "date_of_birth": "2000-01-01T00:00:00",
    "age_years": 26,
    "height_cm": null,
    "weight_kg": null
  },
  "dynamometer": { "tests": [], "joints": [] },
  "forcedecks": { "tests": [], "joints": [] }
}
```

The External Profiles `GET /profiles` response currently supplies date of birth,
which is used to calculate age. It does not return Hub-entered height or weight,
so those fields stay empty unless VALD expands that API response.

Legacy Dynamo records with empty metric lists are self-healed on the first report
lookup by re-reading their VALD detail response and extracting
`repetitionTypeSummaries` and asymmetry values.

## Joint interpretations

```bash
curl -X POST https://your-backend.onrender.com/vald/joint-interpretations \
  -H "Content-Type: application/json" \
  -d '{"athlete":{"name":"Jane Doe"},"sport":"Badminton","assessment_date":"2026-05-01","report_type":"Dynamometer Report","joints":[]}'
```

Send the joint groups returned from `/athlete-report`. The endpoint returns one
technical interpretation per joint that contains populated metrics.

Each test response and exported report displays up to five bilateral rows. Paired
right and left readings are displayed on the same row, and only average
measurements are selected (with no maximum or minimum measurement rows). Available
asymmetry is shown on the matching bilateral row together with the higher side.
Every displayed bilateral row includes compact asymmetry output such as `12.2%R`;
unpaired measurements are excluded from the bilateral report.
For ForceDecks, bilateral `Mean` measures are treated as the average-only report
surface; for DynaMo, bilateral `Avg` measures are used. Maximum rows are never
used in the final report.
Asymmetry percentages are screened with a visible operational `<=10%` band;
this is marked clearly as a screening aid, not as a VALD Norms result.
Official VALD Norms are age/sex-matched percentile comparisons in VALD Hub;
numerical percentile outputs are not supplied by the External API response used
by this report flow.

## Final PDF

POST the selected athlete, date-scoped `joints`, sport, and generated
`interpretations` to `/vald/final-pdf`. The returned PDF uses the clinical
assessment visual system with an athlete overview followed by joint-specific
interpretation and key-metric pages.
