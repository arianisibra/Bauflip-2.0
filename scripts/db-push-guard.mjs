/**
 * Schutz vor `supabase db push` gegen die Produktionsdatenbank.
 *
 * Der Migrations-Tracker in Supabase deckt sich nicht mit supabase/migrations:
 * Mehrere von Hand im SQL-Editor eingespielte Migrationen sind dort nicht
 * eingetragen. Ein `db push` würde sie erneut ausführen. Die meisten sind
 * idempotent geschrieben — darauf verlassen möchte man sich nicht, wenn am
 * anderen Ende die Daten echter Kunden hängen.
 *
 * Deshalb bricht dieses Skript ab und nennt die sicheren Wege.
 */
console.error(`
db:push ist absichtlich gesperrt.

Der Supabase-Migrationstracker deckt sich nicht mit den Dateien in
supabase/migrations. Ein Push würde bereits angewandte Migrationen erneut
ausführen — gegen die Produktionsdatenbank.

Stattdessen:
  - Migration im Supabase-SQL-Editor einspielen (bisheriger Weg), oder
  - npm run db:push:dry-run   zeigt nur, was passieren würde, oder
  - Tracker zuerst geraderücken: npm run db:login, danach
    npx supabase migration repair --status applied <version>

Wenn du sicher bist und die Folgen kennst: npm run db:push:unsafe
`);

process.exit(1);
