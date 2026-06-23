# Migration history repair (Supabase)

When `npm run db:push` fails with:

```text
Remote migration versions not found in local migrations directory.
```

the remote `supabase_migrations.schema_migrations` table has version IDs that **do not match** local filenames (e.g. migrations applied from another machine or SQL editor with different timestamps).

## Diagnose

```bash
npx supabase migration list
```

- **Remote only** (right column, empty local): orphan history entries
- **Local only** (left column, empty remote): pending or already applied outside CLI

## Fix pattern (2026-06-23 prod)

Same SQL was deployed under **different version numbers** on remote vs repo:

| Remote (orphan) | Local (repo) |
|-----------------|--------------|
| `20260420114105` | `20260420120000` fix_assign_project_reference |
| `20260427113343` | `20260420140000` project_number_counters |
| `20260427113538` + `20260427113608` | `20260420160000` security_advisor + revoke |
| `20260427114822` | `20260420180000` attachments RLS |
| `20260427115206` | `20260420190000` technician_reports RLS |
| `20260622221004` | `20260627120000` mitarbeiter bootstrap |

**Steps:**

1. Remove orphan remote IDs (does **not** undo SQL):

```bash
npx supabase migration repair --status reverted \
  20260420114105 20260427113343 20260427113538 20260427113608 \
  20260427114822 20260427115206 20260622221004
```

2. Mark local versions as applied when SQL is already in the database:

```bash
npx supabase migration repair --status applied <local-version-ids...>
```

3. Push remaining migrations:

```bash
npm run db:push
```

## Rules

- `repair --status reverted` only edits the history table — **no schema rollback**.
- `repair --status applied` marks a local migration file as done — **does not run SQL**. Only use when the change is already live.
- Prefer keeping **one canonical timestamp** in git; avoid applying ad-hoc SQL without adding a matching migration file.

## Verify after push

```bash
npx supabase migration list   # local | remote columns aligned
psql "$DATABASE_URL" -f scripts/perf/verify-drop-duplicate-fk-indexes.sql
```
