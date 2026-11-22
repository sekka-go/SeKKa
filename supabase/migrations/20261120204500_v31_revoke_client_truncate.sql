-- seKKa Staging security: TRUNCATE bypasses Row Level Security.
-- The API's anon/authenticated roles should NEVER have this bulk-destruction
-- privilege on any public table, regardless of that table's RLS policies.
-- Revoking it changes no data, SELECTs, RPCs, or legitimate booking operations.
revoke truncate on all tables in schema public from anon,authenticated;

-- Harden future public tables created by the migration owner as well.
-- This is a privilege revoke only; no changes to database contents.
alter default privileges for role postgres in schema public
 revoke truncate on tables from anon,authenticated;
