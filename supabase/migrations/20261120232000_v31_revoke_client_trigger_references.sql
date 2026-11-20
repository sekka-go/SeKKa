-- seKKa / staging least-privilege continuation.
-- Browser roles are never database schema administrators. REFERENCES permits
-- creation of FK constraints and TRIGGER permits DDL triggers, neither is
-- needed for Rider/Captain API usage or booking RPCs.
-- Unlike INSERT/UPDATE/SELECT, these are not application data permissions.
revoke references, trigger on all tables in schema public from anon,authenticated;

-- Preserve least privilege for future tables owned by the migration role.
alter default privileges for role postgres in schema public
 revoke references, trigger on tables from anon,authenticated;
