-- Refresh PostgREST after deploying RPCs through externally applied migrations.
NOTIFY pgrst, 'reload schema';
