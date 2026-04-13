do $$
declare
  fk record;
  cols_sql text;
begin
  for fk in
    select
      con.conname as constraint_name,
      con.conrelid::regclass as table_regclass,
      array_agg(att.attname order by key_cols.ordinality) as column_names
    from pg_constraint con
    join pg_namespace nsp on nsp.oid = con.connamespace
    join unnest(con.conkey) with ordinality as key_cols(attnum, ordinality) on true
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key_cols.attnum
    where con.contype = 'f'
      and nsp.nspname = 'public'
    group by con.conname, con.conrelid
  loop
    select string_agg(format('%I', col), ', ')
      into cols_sql
    from unnest(fk.column_names) as col;

    execute format(
      'create index if not exists %I on %s (%s)',
      fk.constraint_name || '_idx',
      fk.table_regclass,
      cols_sql
    );
  end loop;
end
$$;
