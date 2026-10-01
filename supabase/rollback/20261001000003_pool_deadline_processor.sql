-- Roll back only the SeKKa deadline processor. Keep pg_cron enabled because other project jobs may use it.
DO $rollback$
DECLARE job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname='sekka-process-pool-deadlines'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END
$rollback$;
DROP FUNCTION IF EXISTS public.sekka_process_pool_deadlines();
