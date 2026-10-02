-- Process the documented 72-hour pool waiting deadline and missed-captain service dates.
-- The function is invoked by pg_cron in PostgreSQL; it does not expose a public API.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  cairo_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
  waiting_group record;
  failed_day record;
  group_row public.pool_groups%ROWTYPE;
  member_row record;
  trip_row record;
  open_legs integer;
  refunded_legs integer;
  member_refund numeric;
  daily_value numeric;
  discount numeric;
  notices integer := 0;
  expired_count integer := 0;
  missed_count integer := 0;
BEGIN
  -- Notify once after 72 hours. The unique (user_id,event_key) key makes this idempotent.
  INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
  SELECT m.rider_user_id, g.id, 'pool-wait-72h:' || g.id,
         jsonb_build_object('options', jsonb_build_array('wait','book_remaining_seats','cancel_free'))
  FROM public.pool_groups g
  JOIN public.pool_members m ON m.group_id=g.id AND m.status='active'
  WHERE g.status='waiting'
    AND g.waiting_since <= now() - interval '72 hours'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(g.service_dates) AS d(value)
      WHERE d.value >= cairo_today::text
    )
  ON CONFLICT (user_id,event_key) DO NOTHING;
  GET DIAGNOSTICS notices = ROW_COUNT;

  -- A waiting request whose selected service dates all passed is cancelled free.
  FOR waiting_group IN
    SELECT g.id FROM public.pool_groups g
    WHERE g.status='waiting'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(g.service_dates) AS d(value)
        WHERE d.value >= cairo_today::text
      )
    FOR UPDATE
  LOOP
    UPDATE public.pool_groups SET status='cancelled', updated_at=now()
    WHERE id=waiting_group.id AND status='waiting';
    INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
    SELECT m.rider_user_id, waiting_group.id, 'pool-dates-expired:' || waiting_group.id,
           jsonb_build_object('cancelled_free',true,'create_new_group',true)
    FROM public.pool_members m
    WHERE m.group_id=waiting_group.id AND m.status='active'
    ON CONFLICT (user_id,event_key) DO NOTHING;
    expired_count := expired_count + 1;
  END LOOP;

  -- A service date is missed only after an unstaffed leg's scheduled departure.
  FOR failed_day IN
    SELECT DISTINCT t.group_id,t.service_date
    FROM public.pool_trips t
    WHERE t.status='needs_captain' AND t.captain_user_id IS NULL AND t.departure_at <= now()
    ORDER BY t.group_id,t.service_date
  LOOP
    SELECT * INTO group_row FROM public.pool_groups WHERE id=failed_day.group_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT count(*) INTO open_legs
    FROM public.pool_trips t
    WHERE t.group_id=failed_day.group_id AND t.service_date=failed_day.service_date
      AND t.status IN ('scheduled','assigned','needs_captain');

    IF open_legs=0 THEN CONTINUE; END IF;

    discount := CASE group_row.package_type WHEN 'weekly' THEN 0.05 WHEN 'monthly' THEN 0.10 ELSE 0 END;

    FOR member_row IN
      SELECT m.id,m.rider_user_id,m.seats_reserved,s.id AS subscription_id,
             COALESCE(s.seat_day_fare,group_row.seat_day_fare,0) AS seat_day_fare,
             COALESCE(s.discount_rate,discount) AS discount_rate,
             COALESCE(s.amount_due,0) AS amount_due,
             COALESCE(s.refund_amount,0) AS refund_amount
      FROM public.pool_members m
      LEFT JOIN public.pool_subscriptions s ON s.member_id=m.id
      WHERE m.group_id=failed_day.group_id AND m.status='active'
    LOOP
      member_refund := 0;
      FOR trip_row IN
        SELECT t.id FROM public.pool_trips t
        WHERE t.group_id=failed_day.group_id AND t.service_date=failed_day.service_date
          AND t.status IN ('scheduled','assigned','needs_captain')
        ORDER BY t.direction
      LOOP
        daily_value := round(member_row.seat_day_fare * member_row.seats_reserved *
                             (1-member_row.discount_rate)::numeric / 2, 2);
        INSERT INTO public.pool_trip_cancellations(trip_id,member_id,charge_amount,refund_amount)
        VALUES(trip_row.id,member_row.id,0,daily_value)
        ON CONFLICT (trip_id,member_id) DO NOTHING;
        IF FOUND THEN member_refund := member_refund + daily_value; END IF;
      END LOOP;

      IF member_row.subscription_id IS NOT NULL AND member_refund > 0 THEN
        UPDATE public.pool_subscriptions
        SET amount_due=GREATEST(0,amount_due-member_refund),
            refund_amount=refund_amount+member_refund
        WHERE id=member_row.subscription_id;
      END IF;
    END LOOP;

    UPDATE public.pool_trips
    SET status='cancelled',captain_user_id=NULL
    WHERE group_id=failed_day.group_id AND service_date=failed_day.service_date
      AND status IN ('scheduled','assigned','needs_captain');

    SELECT count(*) INTO refunded_legs
    FROM public.pool_trips t
    WHERE t.group_id=failed_day.group_id
      AND t.status IN ('scheduled','assigned','needs_captain','in_progress');

    UPDATE public.pool_groups
    SET status=CASE WHEN refunded_legs=0 THEN 'cancelled'
                    WHEN fixed_captain_user_id IS NULL THEN 'needs_captain'
                    ELSE 'active' END,
        updated_at=now()
    WHERE id=failed_day.group_id;

    INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
    SELECT m.rider_user_id,failed_day.group_id,
           'pool-no-replacement:' || failed_day.group_id || ':' || failed_day.service_date,
           jsonb_build_object('service_date',failed_day.service_date,'charge',0,'refund','service_day')
    FROM public.pool_members m
    WHERE m.group_id=failed_day.group_id AND m.status='active'
    ON CONFLICT (user_id,event_key) DO NOTHING;

    IF refunded_legs=0 THEN
      UPDATE public.pool_captain_escrows
      SET released_amount=GREATEST(0,reserved_amount-used_amount),
          status='released',closed_at=now()
      WHERE group_id=failed_day.group_id AND status='reserved';
    END IF;
    missed_count := missed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('notices',notices,'expired_groups',expired_count,'missed_service_days',missed_count);
END
$fn$;

REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;

-- Replace only this named job. All other project cron jobs remain untouched.
DO $schedule$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname='sekka-process-pool-deadlines'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'sekka-process-pool-deadlines',
    '* * * * *',
    'SELECT public.sekka_process_pool_deadlines()'
  );
END
$schedule$;
