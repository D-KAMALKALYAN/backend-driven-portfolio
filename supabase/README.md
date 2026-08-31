# Database workflow

The production schema drifted from this folder once already, and an untested
migration opened an anonymous-access hole. This is the process that prevents both.

## Rules

1. **Never edit production in the Supabase dashboard SQL editor.** Every schema
   change is a migration file, reviewed in a diff.
2. **Test every migration against a local database before applying it.**
3. **Verify from outside after applying.** Applied is not the same as working.
4. **Authorization changes get their own migration**, never bundled with anything
   else, and always end with an anon-role denial check.

## One-time setup

Requires Docker Desktop running.

```bash
npx supabase login
npx supabase link --project-ref eegljreugdcjlfbtsfml
```

## Day-to-day

```bash
npm run db:start          # local Postgres + Studio (needs Docker)
npm run db:reset          # rebuild local DB from supabase/migrations/ - THE test
npm run db:diff           # what differs between local and linked production
npm run db:lint           # static checks on the schema
npm run db:push           # apply pending migrations to production
npm run db:stop
```

**`db:reset` is the important one.** It drops the local database and replays every
migration from scratch. If that succeeds, the repo can rebuild the database — which
is exactly what could not be said before.

## Adding a change

```bash
npx supabase migration new describe_the_change
# edit supabase/migrations/<timestamp>_describe_the_change.sql
npm run db:reset          # must succeed from empty
npm run db:diff           # confirm it produces the intended difference
npm run db:push
```

## Capturing production into the repo (still outstanding)

`001_initial_schema.sql` does not describe production. `002`–`005` are corrective
migrations layered on top, not a baseline. The durable fix:

```bash
npm run db:pull           # writes a baseline migration from live production
npm run db:reset          # prove the repo can rebuild it
```

Until that runs, the repo still cannot recreate the database from scratch.

## After ANY change to RLS or an authorization function

Non-negotiable, because reading the SQL is not sufficient — a fail-open predicate
looks symmetric and harmless:

```sql
SET LOCAL ROLE anon;
SELECT is_admin();                      -- expect FALSE
SELECT count(*) FROM contact_messages;  -- expect 0
SELECT count(*) FROM activity_logs;     -- expect 0
RESET ROLE;
```

Then from outside, with the anon key:

```bash
curl -s -H "apikey: $ANON" "$URL/rest/v1/contact_messages?select=id"   # expect []
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "apikey: $ANON" \
  -H 'Content-Type: application/json' -d '{"name":"x","category":"tool"}' \
  "$URL/rest/v1/skills"                                                # expect 401
```

Note that `PATCH`/`DELETE` return **204 whether they updated rows or matched none**
under RLS. A 204 is not proof of denial — re-read the row and confirm it is unchanged.

## Migration history

| File | Purpose | Applied |
|---|---|---|
| `001_initial_schema.sql` | Original design. **Does not match production.** Kept for history. | partially, by hand |
| `002_reconcile_drift.sql` | Resume storage_path, soft-delete in RLS, constraints, zero-filled view | yes |
| `003_analytics_integrity.sql` | Idempotency index, event/meta/size constraints, contact CHECKs | yes |
| `004_fix_policy_gaps.sql` | Enumerate-and-replace policies rather than dropping by assumed name | yes |
| `005_fix_is_admin_fail_open.sql` | **Critical.** `is_admin()` returned TRUE for anon | yes |

Background on each: `developer-notes/discussions/` and `developer-notes/decisions.md`
(ADR-014, ADR-015, ADR-016).
