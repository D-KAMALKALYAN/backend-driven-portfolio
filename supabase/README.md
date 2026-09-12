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

## The baseline (done 2026-09-12)

`20260912091438_remote_schema.sql` was pulled from production with
`supabase db pull` and is the source of truth. `npm run db:reset` from it
reproduces production; the residual `db:diff` is formatting noise on function
bodies, verified byte-for-byte on the one policy it flagged.

**The hand-written `001`–`007` are in `migrations-archive/`.** They no longer run.
They are kept because their comments document *why* each change was made — the
resume bug, the fail-open `is_admin()` incident, the policy-name lesson — and
because git history alone does not preserve reasoning. Do not move them back.

**What the baseline revealed.** Diffing the archived migrations against production
showed that `001` had only ever been partially applied: production had **no
`updated_at` triggers and no rate-limit triggers**, and still carried the
`trg_single_active_resume` trigger that `002` was supposed to drop (that DROP was
added to `002` after `002` had already been run). `20260912100000_production_gaps`
closes those. Every migration file we had described a schema that did not exist.

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
| `20260912091438_remote_schema.sql` | **Baseline** pulled from production. Source of truth. | yes (by definition) |
| `20260912100000_production_gaps.sql` | `updated_at` + rate-limit triggers production never had; drop the superseded resume trigger; two missing indexes | **pending** |
| `20260912100100_content_population.sql` | Fix crossed CodeGuardian/Skillverse sections; populate `profiles.meta`, `project_storytelling`, real `og_image` | **pending** |

Archived (do not run): `migrations-archive/001`–`007`. Background on each in
`developer-notes/discussions/` and `developer-notes/decisions.md`.

## Testing a data migration

A migration that references production rows by id will fail on a fresh
`db:reset`, because the rows are not there. Guard it — `INSERT … SELECT … WHERE
EXISTS`, `ON CONFLICT DO UPDATE` — so it inserts on production and no-ops on an
empty database. Then test it against real rows: seed the local database with the
referenced ids and apply the file directly:

```bash
docker exec -i supabase_db_elite-portfolio psql -U postgres -d postgres < supabase/migrations/<file>.sql
```

Run it twice. The second run must produce zero errors and change nothing.
