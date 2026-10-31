


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_ledger_adjustments" (
    "id" bigint NOT NULL,
    "trip_kind" "text" NOT NULL,
    "trip_id" integer NOT NULL,
    "member_id" integer,
    "amount" numeric(12,2) NOT NULL,
    "reason" "text" NOT NULL,
    "actor_user_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_ledger_adjustments_amount_check" CHECK ((("amount" <> (0)::numeric) AND ("abs"("amount") <= (1000000)::numeric))),
    CONSTRAINT "admin_ledger_adjustments_reason_check" CHECK ((("char_length"("btrim"("reason")) >= 1) AND ("char_length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "admin_ledger_adjustments_trip_kind_check" CHECK (("trip_kind" = ANY (ARRAY['daily'::"text", 'pool'::"text"])))
);


ALTER TABLE "public"."admin_ledger_adjustments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_add_ledger_adjustment"("p_actor_user_id" integer, "p_trip_kind" "text", "p_trip_id" integer, "p_member_id" integer, "p_amount" numeric, "p_reason" "text") RETURNS "public"."admin_ledger_adjustments"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE result public.admin_ledger_adjustments;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_trip_kind NOT IN ('daily','pool') OR p_trip_id<=0 OR p_amount=0 OR abs(p_amount)>1000000
      OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid ledger adjustment' USING ERRCODE='22023';
  END IF;
  IF p_trip_kind='daily' AND NOT EXISTS (SELECT 1 FROM public.trips WHERE id=p_trip_id) THEN
    RAISE EXCEPTION 'trip not found' USING ERRCODE='P0002';
  ELSIF p_trip_kind='pool' AND NOT EXISTS (SELECT 1 FROM public.pool_trips WHERE id=p_trip_id) THEN
    RAISE EXCEPTION 'pool trip not found' USING ERRCODE='P0002';
  END IF;
  IF p_trip_kind='daily' AND p_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'daily trips do not use pool members' USING ERRCODE='22023';
  ELSIF p_trip_kind='pool' AND p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pool_trips t JOIN public.pool_members m ON m.group_id=t.group_id
    WHERE t.id=p_trip_id AND m.id=p_member_id
  ) THEN
    RAISE EXCEPTION 'member is not part of this trip' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.admin_ledger_adjustments(trip_kind,trip_id,member_id,amount,reason,actor_user_id)
  VALUES(p_trip_kind,p_trip_id,p_member_id,p_amount,btrim(p_reason),p_actor_user_id) RETURNING * INTO result;
  PERFORM public.admin_write_audit(p_actor_user_id,'ledger.adjusted','trip',p_trip_kind||':'||p_trip_id,p_reason,
    '{}'::jsonb,jsonb_build_object('amount',p_amount,'member_id',p_member_id));
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."admin_add_ledger_adjustment"("p_actor_user_id" integer, "p_trip_kind" "text", "p_trip_id" integer, "p_member_id" integer, "p_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_audit_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME USING ERRCODE='55000'; END;
$$;


ALTER FUNCTION "public"."admin_audit_append_only"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_verifications" (
    "id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "document_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "object_path" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "file_size_bytes" integer NOT NULL,
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" integer,
    CONSTRAINT "user_verifications_check" CHECK (((("status" = 'rejected'::"text") AND ("rejection_reason" IS NOT NULL)) OR ("status" <> 'rejected'::"text"))),
    CONSTRAINT "user_verifications_content_type_check" CHECK (("content_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'application/pdf'::"text"]))),
    CONSTRAINT "user_verifications_document_type_check" CHECK (("document_type" = ANY (ARRAY['national_id_front'::"text", 'national_id_back'::"text", 'driving_license_front'::"text", 'driving_license_back'::"text", 'vehicle_license_front'::"text", 'vehicle_license_back'::"text", 'criminal_record'::"text", 'drug_test'::"text"]))),
    CONSTRAINT "user_verifications_file_size_bytes_check" CHECK ((("file_size_bytes" >= 1) AND ("file_size_bytes" <= 8388608))),
    CONSTRAINT "user_verifications_object_path_check" CHECK ((("char_length"("object_path") >= 1) AND ("char_length"("object_path") <= 512))),
    CONSTRAINT "user_verifications_rejection_reason_check" CHECK ((("rejection_reason" IS NULL) OR ("char_length"("rejection_reason") <= 1000))),
    CONSTRAINT "user_verifications_status_check" CHECK (("status" = ANY (ARRAY['awaiting_upload'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."user_verifications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_user_verification"("p_actor_user_id" integer, "p_verification_id" bigint, "p_status" "text", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "public"."user_verifications"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  result public.user_verifications;
  old_row public.user_verifications;
  target_role text;
  required_approved integer;
  deferred_approved integer;
  next_verification_status text;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') OR
     (p_status = 'rejected' AND char_length(btrim(coalesce(p_rejection_reason, ''))) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'invalid verification decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO old_row
  FROM public.user_verifications
  WHERE id = p_verification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification not found' USING ERRCODE = 'P0002';
  END IF;
  IF old_row.status <> 'pending' THEN
    RAISE EXCEPTION 'verification already reviewed' USING ERRCODE = '40001';
  END IF;

  SELECT role INTO target_role
  FROM public.users
  WHERE id = old_row.user_id;

  UPDATE public.user_verifications
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      reviewed_by = p_actor_user_id,
      reviewed_at = now()
  WHERE id = p_verification_id
  RETURNING * INTO result;

  IF target_role = 'captain' THEN
    SELECT count(*) INTO required_approved
    FROM public.user_verifications
    WHERE user_id = old_row.user_id
      AND status = 'approved'
      AND document_type IN (
        'national_id_front', 'national_id_back', 'driving_license_front',
        'driving_license_back', 'vehicle_license_front', 'vehicle_license_back'
      );

    SELECT count(*) INTO deferred_approved
    FROM public.user_verifications
    WHERE user_id = old_row.user_id
      AND status = 'approved'
      AND document_type IN ('criminal_record', 'drug_test');

    SELECT CASE
      WHEN required_approved = 6 AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = old_row.user_id AND u.verified_at IS NOT NULL
      ) THEN 'approved'
      WHEN EXISTS (
        SELECT 1 FROM public.user_verifications v
        WHERE v.user_id = old_row.user_id AND v.status = 'rejected'
          AND v.document_type IN (
            'national_id_front', 'national_id_back', 'driving_license_front',
            'driving_license_back', 'vehicle_license_front', 'vehicle_license_back'
          )
      ) THEN 'rejected'
      ELSE 'pending'
    END INTO next_verification_status;

    -- The captain_profiles trigger rejects no-op verification_status updates.
    -- An approved document often leaves the overall captain status pending, so
    -- only write the aggregate status when it actually changes.
    UPDATE public.captain_profiles
    SET verification_status = next_verification_status
    WHERE user_id = old_row.user_id
      AND verification_status IS DISTINCT FROM next_verification_status;

    IF required_approved = 6 AND EXISTS (
      SELECT 1 FROM public.captain_profiles cp
      WHERE cp.user_id = old_row.user_id
        AND (cp.grace_period_expires_at > now() OR deferred_approved = 2)
        AND cp.status IS DISTINCT FROM 'active'
    ) THEN
      UPDATE public.captain_profiles
      SET status = 'active'
      WHERE user_id = old_row.user_id
        AND status IS DISTINCT FROM 'active';
    END IF;
  END IF;
  PERFORM public.admin_write_audit(
    p_actor_user_id,
    'verification.document_reviewed',
    'user_verification',
    p_verification_id::text,
    p_rejection_reason,
    jsonb_build_object('status', old_row.status, 'document_type', old_row.document_type),
    jsonb_build_object('status', result.status, 'user_id', result.user_id)
  );

  INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
  VALUES (
    result.user_id,
    NULL,
    'verification-reviewed:' || result.id || ':' || result.reviewed_at::text,
    jsonb_build_object(
      'title', 'تحديث توثيق المستندات',
      'message', CASE WHEN p_status = 'approved'
        THEN 'تم قبول المستند. يمكنك مراجعة حالة التوثيق من حسابك.'
        ELSE 'يحتاج المستند إلى إعادة رفع. راجع سبب الرفض في صفحة التوثيق.'
      END
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."admin_review_user_verification"("p_actor_user_id" integer, "p_verification_id" bigint, "p_status" "text", "p_rejection_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_system_settings" (
    "setting_key" "text" NOT NULL,
    "numeric_value" numeric(7,6) NOT NULL,
    "updated_by_user_id" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_system_settings_numeric_value_check" CHECK ((("numeric_value" >= (0)::numeric) AND ("numeric_value" <= (1)::numeric))),
    CONSTRAINT "admin_system_settings_setting_key_check" CHECK (("setting_key" = 'company_commission_rate'::"text"))
);


ALTER TABLE "public"."admin_system_settings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_commission_rate"("p_actor_user_id" integer, "p_rate" numeric, "p_reason" "text") RETURNS "public"."admin_system_settings"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE old_rate numeric; result public.admin_system_settings;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_rate IS DISTINCT FROM 0 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'MVP commission is fixed at zero; a new plan must be explicitly activated' USING ERRCODE='22023';
  END IF;
  SELECT numeric_value INTO old_rate FROM public.admin_system_settings WHERE setting_key='company_commission_rate';
  INSERT INTO public.admin_system_settings(setting_key,numeric_value,updated_by_user_id)
  VALUES('company_commission_rate',0,p_actor_user_id)
  ON CONFLICT (setting_key) DO UPDATE SET numeric_value=0,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
  RETURNING * INTO result;
  PERFORM public.admin_write_audit(p_actor_user_id,'config.commission_changed','system_setting','company_commission_rate',p_reason,
    jsonb_build_object('rate',old_rate),jsonb_build_object('rate',0));
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."admin_set_commission_rate"("p_actor_user_id" integer, "p_rate" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_user_controls" (
    "user_id" integer NOT NULL,
    "status" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "updated_by_user_id" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_user_controls_reason_check" CHECK ((("char_length"("btrim"("reason")) >= 1) AND ("char_length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "admin_user_controls_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'banned'::"text"])))
);


ALTER TABLE "public"."admin_user_controls" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_status"("p_actor_user_id" integer, "p_target_user_id" integer, "p_status" "text", "p_reason" "text") RETURNS "public"."admin_user_controls"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE old_status text; result public.admin_user_controls;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_status IS NULL OR p_status NOT IN ('active','suspended','banned') OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid status or reason' USING ERRCODE='22023';
  END IF;
  IF p_target_user_id=p_actor_user_id OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id=p_target_user_id) THEN
    RAISE EXCEPTION 'cannot change a super administrator account' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_target_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE='P0002';
  END IF;
  SELECT status INTO old_status FROM public.admin_user_controls WHERE user_id=p_target_user_id;
  INSERT INTO public.admin_user_controls(user_id,status,reason,updated_by_user_id)
  VALUES(p_target_user_id,p_status,btrim(p_reason),p_actor_user_id)
  ON CONFLICT (user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,
    updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
  RETURNING * INTO result;
  INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
  VALUES(p_target_user_id,NULL,'admin-account-status:'||result.updated_at::text,
    jsonb_build_object('title','تحديث حالة الحساب','message',CASE p_status WHEN 'active' THEN 'تمت إعادة تفعيل حسابك.' WHEN 'suspended' THEN 'تم إيقاف حسابك مؤقتًا. تواصل مع خدمة العملاء للمساعدة.' ELSE 'تم إيقاف حسابك. تواصل مع خدمة العملاء للمساعدة.' END))
  ON CONFLICT (user_id,event_key) DO NOTHING;
  PERFORM public.admin_write_audit(p_actor_user_id,'user.status_changed','user',p_target_user_id::text,p_reason,
    jsonb_build_object('status',coalesce(old_status,'active')),
    jsonb_build_object('status',p_status));
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."admin_set_user_status"("p_actor_user_id" integer, "p_target_user_id" integer, "p_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_write_audit"("p_actor_user_id" integer, "p_action" "text", "p_resource_type" "text", "p_resource_id" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text", "p_before" "jsonb" DEFAULT '{}'::"jsonb", "p_after" "jsonb" DEFAULT '{}'::"jsonb", "p_request_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE audit_id bigint;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  INSERT INTO public.admin_audit_logs(actor_user_id,action,resource_type,resource_id,reason,before_state,after_state,request_id)
  VALUES(p_actor_user_id,left(p_action,100),left(p_resource_type,80),p_resource_id,left(p_reason,1000),coalesce(p_before,'{}'::jsonb),coalesce(p_after,'{}'::jsonb),p_request_id)
  RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$;


ALTER FUNCTION "public"."admin_write_audit"("p_actor_user_id" integer, "p_action" "text", "p_resource_type" "text", "p_resource_id" "text", "p_reason" "text", "p_before" "jsonb", "p_after" "jsonb", "p_request_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "amount" double precision NOT NULL,
    "reported_by_user_id" integer NOT NULL,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" >= (0)::double precision))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_trip_payment"("actor_id" integer, "trip_id" integer, "actual_amount" numeric) RETURNS "public"."payments"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE created public.payments%ROWTYPE;
BEGIN
  IF actual_amount IS NULL OR actual_amount <= 0 THEN
    RAISE EXCEPTION 'actual payment amount must be positive' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.matches m ON m.id=t.match_id
    JOIN public.users u ON u.id=m.captain_user_id AND u.role='captain'
    WHERE t.id=trip_id AND t.status='completed' AND m.captain_user_id=actor_id
  ) THEN
    RAISE EXCEPTION 'assigned captain of a completed trip required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.payments(trip_id,amount,reported_by_user_id)
  VALUES(trip_id,actual_amount,actor_id)
  RETURNING * INTO created;
  RETURN created;
END;
$$;


ALTER FUNCTION "public"."confirm_trip_payment"("actor_id" integer, "trip_id" integer, "actual_amount" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demand_requests" (
    "id" integer NOT NULL,
    "rider_user_id" integer NOT NULL,
    "demand_group_id" integer,
    "vehicle_type_id" "text" NOT NULL,
    "trip_date" "date" NOT NULL,
    "arrival_time" time without time zone NOT NULL,
    "pickup_label" "text",
    "pickup_lat" double precision,
    "pickup_lng" double precision,
    "dropoff_label" "text",
    "dropoff_lat" double precision,
    "dropoff_lng" double precision,
    "seats" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "return_arrival_time" time without time zone,
    CONSTRAINT "demand_requests_dropoff_label_check" CHECK ((("length"("btrim"("dropoff_label")) >= 2) AND ("length"("btrim"("dropoff_label")) <= 240))),
    CONSTRAINT "demand_requests_dropoff_lat_check" CHECK ((("dropoff_lat" >= ('-90'::integer)::double precision) AND ("dropoff_lat" <= (90)::double precision))),
    CONSTRAINT "demand_requests_dropoff_lng_check" CHECK ((("dropoff_lng" >= ('-180'::integer)::double precision) AND ("dropoff_lng" <= (180)::double precision))),
    CONSTRAINT "demand_requests_pickup_label_check" CHECK ((("length"("btrim"("pickup_label")) >= 2) AND ("length"("btrim"("pickup_label")) <= 240))),
    CONSTRAINT "demand_requests_pickup_lat_check" CHECK ((("pickup_lat" >= ('-90'::integer)::double precision) AND ("pickup_lat" <= (90)::double precision))),
    CONSTRAINT "demand_requests_pickup_lng_check" CHECK ((("pickup_lng" >= ('-180'::integer)::double precision) AND ("pickup_lng" <= (180)::double precision))),
    CONSTRAINT "demand_requests_seats_check" CHECK ((("seats" >= 1) AND ("seats" <= 14))),
    CONSTRAINT "demand_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."demand_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_demand_request"("actor_id" integer, "vehicle_id" "text", "trip_on" "date", "arrives" time without time zone, "pickup_name" "text", "pickup_y" double precision, "pickup_x" double precision, "dropoff_name" "text", "dropoff_y" double precision, "dropoff_x" double precision, "seat_count" integer DEFAULT 1, "return_arrives" time without time zone DEFAULT NULL::time without time zone) RETURNS "public"."demand_requests"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE created public.demand_requests%ROWTYPE;
BEGIN
  IF trip_on < (now() AT TIME ZONE 'Africa/Cairo')::date THEN
    RAISE EXCEPTION 'trip date must be today or later' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'rider' AND verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'verified rider required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.demand_requests(rider_user_id, vehicle_type_id, trip_date, arrival_time, return_arrival_time, pickup_label, pickup_lat, pickup_lng, dropoff_label, dropoff_lat, dropoff_lng, seats)
  VALUES(actor_id, vehicle_id, trip_on, arrives, return_arrives, pickup_name, pickup_y, pickup_x, dropoff_name, dropoff_y, dropoff_x, seat_count)
  RETURNING * INTO created;
  RETURN created;
END $$;


ALTER FUNCTION "public"."create_demand_request"("actor_id" integer, "vehicle_id" "text", "trip_on" "date", "arrives" time without time zone, "pickup_name" "text", "pickup_y" double precision, "pickup_x" double precision, "dropoff_name" "text", "dropoff_y" double precision, "dropoff_x" double precision, "seat_count" integer, "return_arrives" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."direct_message_contact_ids"("p_user_id" integer) RETURNS TABLE("contact_user_id" integer)
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  WITH contacts AS (
    -- Riders can contact captains assigned to one of their pool groups.
    SELECT trip.captain_user_id AS user_id
    FROM public.pool_members member
    JOIN public.pool_trips trip ON trip.group_id = member.group_id
    WHERE member.rider_user_id = p_user_id
      AND member.status <> 'cancelled'
      AND trip.captain_user_id IS NOT NULL
    UNION
    SELECT group_row.fixed_captain_user_id
    FROM public.pool_members member
    JOIN public.pool_groups group_row ON group_row.id = member.group_id
    WHERE member.rider_user_id = p_user_id
      AND member.status <> 'cancelled'
      AND group_row.fixed_captain_user_id IS NOT NULL
    UNION
    -- Captains can contact riders on the groups they serve.
    SELECT member.rider_user_id
    FROM public.pool_trips trip
    JOIN public.pool_members member ON member.group_id = trip.group_id
    WHERE trip.captain_user_id = p_user_id
      AND member.status <> 'cancelled'
    UNION
    -- A matched daily ride links its rider and captain.
    SELECT matched_ride.captain_user_id
    FROM public.daily_commute_requests request
    JOIN public.matches matched_ride ON matched_ride.daily_commute_request_id = request.id
    WHERE request.rider_user_id = p_user_id
    UNION
    SELECT request.rider_user_id
    FROM public.matches matched_ride
    JOIN public.daily_commute_requests request ON request.id = matched_ride.daily_commute_request_id
    WHERE matched_ride.captain_user_id = p_user_id
  )
  SELECT DISTINCT contacts.user_id
  FROM contacts
  JOIN public.users contact ON contact.id = contacts.user_id
  WHERE contacts.user_id <> p_user_id
    AND contact.role IN ('rider', 'captain');
$$;


ALTER FUNCTION "public"."direct_message_contact_ids"("p_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_captain_line_pricing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE allowed_seats integer; configured_rate numeric;
BEGIN
  SELECT capacity_max INTO allowed_seats
  FROM public.vehicle_types WHERE id = NEW.vehicle_type_id;
  IF allowed_seats IS NULL OR NEW.seats < 1 OR NEW.seats > allowed_seats THEN
    RAISE EXCEPTION 'seat count exceeds vehicle class capacity' USING ERRCODE = '22023';
  END IF;
  SELECT numeric_value INTO configured_rate FROM public.app_config WHERE config_key='captain_line_price_per_km';
  IF configured_rate IS NULL OR configured_rate NOT BETWEEN 7 AND 11 THEN
    RAISE EXCEPTION 'captain line price configuration is invalid' USING ERRCODE = '22023';
  END IF;
  IF NEW.route_distance_km IS NULL OR NEW.route_distance_km <= 0 THEN
    RAISE EXCEPTION 'captain line route distance must be positive' USING ERRCODE = '22023';
  END IF;
  NEW.price_per_km := configured_rate;
  IF NEW.price_per_seat IS NULL OR NEW.price_per_seat <= 0 THEN
    NEW.price_per_seat := ROUND(NEW.route_distance_km * configured_rate, 2);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_captain_line_pricing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_direct_messages_read"("p_user_id" integer, "p_conversation_id" bigint) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  conversation_row public.message_conversations;
  updated_count integer;
BEGIN
  SELECT * INTO conversation_row
  FROM public.message_conversations
  WHERE id = p_conversation_id
    AND p_user_id IN (participant_low_id, participant_high_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.direct_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_user_id <> p_user_id
    AND read_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE public.message_conversations
  SET unread_low = CASE WHEN p_user_id = participant_low_id THEN 0 ELSE unread_low END,
      unread_high = CASE WHEN p_user_id = participant_high_id THEN 0 ELSE unread_high END
  WHERE id = p_conversation_id;

  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_direct_messages_read"("p_user_id" integer, "p_conversation_id" bigint) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."captain_lines" (
    "id" integer NOT NULL,
    "captain_user_id" integer NOT NULL,
    "vehicle_type_id" "text" NOT NULL,
    "origin_label" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "destination_label" "text",
    "destination_lat" double precision,
    "destination_lng" double precision,
    "intermediate_stops" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "arrival_time" time without time zone NOT NULL,
    "service_days" smallint[] NOT NULL,
    "seats" integer NOT NULL,
    "price_per_seat" numeric(10,2) NOT NULL,
    "payment_methods" "text"[] DEFAULT ARRAY['cash'::"text"] NOT NULL,
    "women_only" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "return_arrival_time" time without time zone,
    "route_distance_km" numeric(10,2) NOT NULL,
    "price_per_km" numeric(4,2) NOT NULL,
    CONSTRAINT "captain_lines_destination_label_check" CHECK ((("length"("btrim"("destination_label")) >= 2) AND ("length"("btrim"("destination_label")) <= 240))),
    CONSTRAINT "captain_lines_destination_lat_check" CHECK ((("destination_lat" >= ('-90'::integer)::double precision) AND ("destination_lat" <= (90)::double precision))),
    CONSTRAINT "captain_lines_destination_lng_check" CHECK ((("destination_lng" >= ('-180'::integer)::double precision) AND ("destination_lng" <= (180)::double precision))),
    CONSTRAINT "captain_lines_intermediate_stops_check" CHECK (("jsonb_typeof"("intermediate_stops") = 'array'::"text")),
    CONSTRAINT "captain_lines_origin_label_check" CHECK ((("length"("btrim"("origin_label")) >= 2) AND ("length"("btrim"("origin_label")) <= 240))),
    CONSTRAINT "captain_lines_origin_lat_check" CHECK ((("origin_lat" >= ('-90'::integer)::double precision) AND ("origin_lat" <= (90)::double precision))),
    CONSTRAINT "captain_lines_origin_lng_check" CHECK ((("origin_lng" >= ('-180'::integer)::double precision) AND ("origin_lng" <= (180)::double precision))),
    CONSTRAINT "captain_lines_payment_methods_check" CHECK ((("cardinality"("payment_methods") > 0) AND ("payment_methods" <@ ARRAY['cash'::"text", 'instapay'::"text", 'wallet'::"text"]))),
    CONSTRAINT "captain_lines_price_per_km_check" CHECK ((("price_per_km" >= (7)::numeric) AND ("price_per_km" <= (11)::numeric))),
    CONSTRAINT "captain_lines_price_per_seat_check" CHECK (("price_per_seat" >= (0)::numeric)),
    CONSTRAINT "captain_lines_route_distance_check" CHECK (("route_distance_km" > (0)::numeric)),
    CONSTRAINT "captain_lines_seats_legacy_safe_check" CHECK ((("seats" >= 1) AND ("seats" <= 14))),
    CONSTRAINT "captain_lines_service_days_check" CHECK (((("cardinality"("service_days") >= 1) AND ("cardinality"("service_days") <= 7)) AND ("service_days" <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]))),
    CONSTRAINT "captain_lines_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."captain_lines" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "methods" "text"[], "return_arrives" time without time zone DEFAULT NULL::time without time zone) RETURNS "public"."captain_lines"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  created public.captain_lines%ROWTYPE;
  allowed_seats integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = actor_id AND role = 'captain' AND verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'verified captain required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.captain_profiles
    WHERE user_id = actor_id AND verification_status = 'approved'
      AND vehicle_type_id = vehicle_id
  ) THEN
    RAISE EXCEPTION 'approved vehicle profile required' USING ERRCODE = '42501';
  END IF;
  allowed_seats := CASE vehicle_id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END;
  IF allowed_seats = 0 OR seat_count < 1 OR seat_count > allowed_seats THEN
    RAISE EXCEPTION 'captain line seats exceed vehicle capacity' USING ERRCODE = '22023';
  END IF;
  IF route_km IS NULL OR route_km <= 0 OR route_km > 1000 THEN
    RAISE EXCEPTION 'captain line route distance is invalid' USING ERRCODE = '22023';
  END IF;
  IF cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS day_value(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[])
     OR jsonb_typeof(coalesce(stops, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.captain_lines(
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km,
    9, 0, methods
  )
  RETURNING * INTO created;
  RETURN created;
END $$;


ALTER FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "methods" "text"[], "return_arrives" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone DEFAULT NULL::time without time zone) RETURNS "public"."captain_lines"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  created public.captain_lines%ROWTYPE;
  route_km numeric;
  allowed_seats integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'captain' AND verified_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id = actor_id AND verification_status = 'approved' AND vehicle_type_id = vehicle_id) THEN
    RAISE EXCEPTION 'verified captain and approved vehicle required' USING ERRCODE = '42501';
  END IF;
  allowed_seats := CASE vehicle_id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END;
  IF allowed_seats = 0 OR seat_count < 1 OR seat_count > allowed_seats THEN
    RAISE EXCEPTION 'captain line seats exceed vehicle capacity' USING ERRCODE = '22023';
  END IF;
  route_km := GREATEST(0.01, public.sekka_geo_km(origin_y, origin_x, destination_y, destination_x));
  INSERT INTO public.captain_lines(
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km, 9, 0, methods
  )
  RETURNING * INTO created;
  RETURN created;
END $$;


ALTER FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone DEFAULT NULL::time without time zone) RETURNS "public"."captain_lines"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE created public.captain_lines%ROWTYPE; allowed_seats integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=actor_id AND role='captain' AND verified_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id=actor_id AND verification_status='approved' AND vehicle_type_id=vehicle_id) THEN
    RAISE EXCEPTION 'approved verified captain profile required' USING ERRCODE='42501';
  END IF;
  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7 OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) OR cardinality(methods)=0 OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.captain_lines(captain_user_id,vehicle_type_id,origin_label,origin_lat,origin_lng,destination_label,destination_lat,destination_lng,intermediate_stops,arrival_time,return_arrival_time,service_days,seats,route_distance_km,price_per_km,price_per_seat,payment_methods)
  VALUES(actor_id,vehicle_id,origin_name,origin_y,origin_x,destination_name,destination_y,destination_x,coalesce(stops,'[]'::jsonb),arrival,return_arrives,days,seat_count,route_km,9,seat_price,methods)
  RETURNING * INTO created;
  RETURN created;
END $$;


ALTER FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE='55000'; END $$;


ALTER FUNCTION "public"."sekka_append_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_audit_log_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '55000';
END;
$$;


ALTER FUNCTION "public"."sekka_audit_log_append_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_begin_location_search"("p_user_id" integer, "p_normalized_query" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'Africa/Cairo')::date;
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_daily_used integer;
  v_monthly_used integer;
  v_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_suggestions jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id < 1 OR p_normalized_query IS NULL OR char_length(p_normalized_query) NOT BETWEEN 3 AND 160 THEN
    RAISE EXCEPTION 'invalid location search request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(73101, p_user_id);

  SELECT id, status, created_at, suggestions
    INTO v_id, v_status, v_created_at, v_suggestions
  FROM public.user_location_searches
  WHERE user_id = p_user_id AND normalized_query = p_normalized_query;

  IF FOUND THEN
    SELECT count(*) INTO v_daily_used
    FROM public.user_location_searches
    WHERE user_id = p_user_id AND search_day = v_day;
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate',
      'search_id', v_id,
      'status', v_status,
      'suggestions', CASE WHEN v_created_at >= clock_timestamp() - interval '30 days' THEN v_suggestions ELSE '[]'::jsonb END,
      'daily_remaining', GREATEST(0, 2 - v_daily_used)
    );
  END IF;

  SELECT count(*) INTO v_daily_used
  FROM public.user_location_searches
  WHERE user_id = p_user_id AND search_day = v_day;

  IF v_daily_used >= 2 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'daily_remaining', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);

  SELECT count(*) INTO v_monthly_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_monthly_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES ('autocomplete');
  INSERT INTO public.user_location_searches (user_id, normalized_query, search_day)
  VALUES (p_user_id, p_normalized_query, v_day)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'search_id', v_id,
    'daily_remaining', GREATEST(0, 1 - v_daily_used),
    'monthly_remaining', GREATEST(0, 9999 - v_monthly_used)
  );
END;
$$;


ALTER FUNCTION "public"."sekka_begin_location_search"("p_user_id" integer, "p_normalized_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_captain_verification_noop"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.verification_status=OLD.verification_status THEN
    RAISE EXCEPTION 'verification status must change' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_captain_verification_noop"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_capture_lifecycle_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb;
  actor_id integer;
  event_name text;
  resource_name text;
  before_payload jsonb := '{}'::jsonb;
  after_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'captain_lines' THEN
      resource_name := 'captain_line';
      actor_id := (new_row->>'captain_user_id')::integer;
      after_payload := jsonb_build_object('status', new_row->'status');
      IF TG_OP = 'INSERT' THEN
        event_name := 'captain_line.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status' THEN RETURN NEW; END IF;
        event_name := 'captain_line.lifecycle_changed';
        before_payload := jsonb_build_object('status', old_row->'status');
      END IF;

    WHEN 'demand_groups' THEN
      resource_name := 'demand_group';
      after_payload := jsonb_build_object(
        'status', new_row->'status',
        'captain_line_id', new_row->'captain_line_id'
      );
      IF TG_OP = 'INSERT' THEN
        event_name := 'demand_group.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status'
           AND old_row->'captain_line_id' IS NOT DISTINCT FROM new_row->'captain_line_id' THEN
          RETURN NEW;
        END IF;
        event_name := 'demand_group.lifecycle_changed';
        before_payload := jsonb_build_object(
          'status', old_row->'status',
          'captain_line_id', old_row->'captain_line_id'
        );
      END IF;

    WHEN 'demand_requests' THEN
      resource_name := 'demand_request';
      actor_id := (new_row->>'rider_user_id')::integer;
      after_payload := jsonb_build_object(
        'status', new_row->'status',
        'demand_group_id', new_row->'demand_group_id',
        'seats', new_row->'seats'
      );
      IF TG_OP = 'INSERT' THEN
        event_name := 'demand_request.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status'
           AND old_row->'demand_group_id' IS NOT DISTINCT FROM new_row->'demand_group_id' THEN
          RETURN NEW;
        END IF;
        event_name := 'demand_request.lifecycle_changed';
        before_payload := jsonb_build_object(
          'status', old_row->'status',
          'demand_group_id', old_row->'demand_group_id',
          'seats', old_row->'seats'
        );
      END IF;

    ELSE
      RAISE EXCEPTION 'unsupported audit source table: %', TG_TABLE_NAME USING ERRCODE = '22023';
  END CASE;

  INSERT INTO public.audit_log(actor_user_id, event_type, resource_type, resource_id, before_state, after_state)
  VALUES (actor_id, event_name, resource_name, (new_row->>'id')::integer, before_payload, after_payload);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sekka_capture_lifecycle_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_claim_location_resolution"("p_user_id" integer, "p_search_id" "uuid", "p_place_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_search public.user_location_searches%ROWTYPE;
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id < 1 OR p_search_id IS NULL OR p_place_id IS NULL OR char_length(p_place_id) NOT BETWEEN 5 AND 300 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_search
  FROM public.user_location_searches
  WHERE id = p_search_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_search.status <> 'complete' OR NOT (p_place_id = ANY(v_search.provider_place_ids)) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'place_not_found');
  END IF;

  IF v_search.selected_place_id = p_place_id
     AND v_search.selected_lat IS NOT NULL
     AND v_search.coordinates_updated_at >= clock_timestamp() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'cached', true,
      'place_id', p_place_id,
      'lat', v_search.selected_lat,
      'lng', v_search.selected_lng,
      'label', COALESCE((SELECT item->>'label' FROM jsonb_array_elements(v_search.suggestions) item WHERE item->>'place_id' = p_place_id LIMIT 1), '')
    );
  END IF;

  IF v_search.details_calls >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'resolution_limit');
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);

  SELECT count(*) INTO v_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES ('place_details');
  UPDATE public.user_location_searches
  SET details_calls = details_calls + 1
  WHERE id = p_search_id AND user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'cached', false, 'place_id', p_place_id, 'monthly_remaining', GREATEST(0, 9999 - v_used));
END;
$$;


ALTER FUNCTION "public"."sekka_claim_location_resolution"("p_user_id" integer, "p_search_id" "uuid", "p_place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_cluster_demand_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  selected_group integer;
  radius_km numeric;
  time_window numeric;
  group_status text;
  matched_line_id integer;
  matched_direction text;
  line_capacity integer;
  occupied_outbound integer;
  occupied_return integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.vehicle_type_id), NEW.trip_date - DATE '2000-01-01');
  SELECT numeric_value INTO radius_km FROM public.app_config WHERE config_key = 'demand_route_radius_km';
  SELECT numeric_value INTO time_window FROM public.app_config WHERE config_key = 'demand_arrival_window_minutes';
  SELECT g.id INTO selected_group
  FROM public.demand_groups g
  WHERE g.status IN ('open', 'matched')
    AND g.vehicle_type_id = NEW.vehicle_type_id
    AND g.trip_date = NEW.trip_date
    AND least(abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60), 1440 - abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60)) <= time_window
    AND ((g.return_arrival_time IS NULL AND NEW.return_arrival_time IS NULL)
      OR (g.return_arrival_time IS NOT NULL AND NEW.return_arrival_time IS NOT NULL
        AND least(abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60), 1440 - abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60)) <= time_window))
    AND public.sekka_geo_km(g.origin_lat, g.origin_lng, NEW.pickup_lat, NEW.pickup_lng) <= radius_km
    AND public.sekka_geo_km(g.destination_lat, g.destination_lng, NEW.dropoff_lat, NEW.dropoff_lng) <= radius_km
    AND (g.status = 'open' OR EXISTS (
      SELECT 1 FROM public.captain_lines l WHERE l.id = g.captain_line_id AND l.status = 'active'
    ))
  ORDER BY g.created_at, g.id LIMIT 1 FOR UPDATE OF g;

  IF selected_group IS NOT NULL THEN
    SELECT status, captain_line_id, matched_direction INTO group_status, matched_line_id, matched_direction FROM public.demand_groups WHERE id = selected_group;
    IF group_status = 'matched' THEN
      SELECT seats INTO line_capacity FROM public.captain_lines WHERE id = matched_line_id AND status = 'active';
      SELECT coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('outbound', 'roundtrip')), 0)::integer,
             coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('return', 'roundtrip')), 0)::integer
        INTO occupied_outbound, occupied_return
        FROM public.demand_groups g JOIN public.demand_requests r ON r.demand_group_id = g.id
        WHERE g.captain_line_id = matched_line_id AND g.trip_date = NEW.trip_date AND g.status = 'matched';
      IF (matched_direction IN ('outbound', 'roundtrip') AND occupied_outbound + NEW.seats > coalesce(line_capacity, 0))
        OR (matched_direction IN ('return', 'roundtrip') AND occupied_return + NEW.seats > coalesce(line_capacity, 0)) THEN
        selected_group := NULL;
      END IF;
    END IF;
  END IF;

  IF selected_group IS NULL THEN
    INSERT INTO public.demand_groups(vehicle_type_id, origin_lat, origin_lng, destination_lat, destination_lng, trip_date, arrival_time, return_arrival_time)
    VALUES(NEW.vehicle_type_id, NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng, NEW.trip_date, NEW.arrival_time, NEW.return_arrival_time)
    RETURNING id INTO selected_group;
  END IF;
  NEW.demand_group_id := selected_group;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_cluster_demand_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_delete_account_v1"("p_actor_user_id" integer, "p_target_user_id" integer, "p_reason" "text" DEFAULT NULL::"text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  actor_role text;
  deleted_on timestamptz := now();
  is_admin_deletion boolean := p_actor_user_id <> p_target_user_id;
BEGIN
  IF p_actor_user_id IS NULL OR p_target_user_id IS NULL OR p_actor_user_id < 1 OR p_target_user_id < 1 THEN
    RAISE EXCEPTION 'invalid account identifier' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NOT NULL AND char_length(btrim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'deletion reason is too long' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO actor_role FROM public.users WHERE id = p_actor_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'actor account not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.users WHERE id = p_target_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target account not found or already deleted' USING ERRCODE = 'P0002'; END IF;

  IF is_admin_deletion THEN
    IF actor_role <> 'admin' THEN RAISE EXCEPTION 'administrator role required' USING ERRCODE = '42501'; END IF;
    PERFORM public.sekka_require_super_admin(p_actor_user_id);
    IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'admin deletion reason is required' USING ERRCODE = '22023';
    END IF;
  ELSIF p_reason IS NOT NULL THEN
    RAISE EXCEPTION 'self deletion does not accept an admin reason' USING ERRCODE = '22023';
  ELSIF actor_role = 'admin' THEN
    PERFORM public.sekka_require_super_admin(p_actor_user_id);
  END IF;

  -- Keep at least one active Super Admin so privileged recovery remains possible.
  IF EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = p_target_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.super_admins sa
      JOIN public.users active_admin ON active_admin.id = sa.user_id
      WHERE sa.user_id <> p_target_user_id AND active_admin.deleted_at IS NULL AND active_admin.role = 'admin'
    ) THEN
    RAISE EXCEPTION 'protected super administrator account' USING ERRCODE = '42501';
  END IF;

  -- Do not erase a location while the service is actively in progress.
  IF EXISTS (
    SELECT 1 FROM public.pool_trips t
    WHERE t.status IN ('scheduled','assigned','in_progress') AND t.departure_at >= now() AND (
      t.captain_user_id = p_target_user_id OR EXISTS (
        SELECT 1 FROM public.pool_members m WHERE m.group_id = t.group_id AND m.rider_user_id = p_target_user_id
      )
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trips t JOIN public.matches m ON m.id = t.match_id
    JOIN public.daily_commute_requests r ON r.id = m.daily_commute_request_id
    WHERE t.status = 'in_progress' AND (r.rider_user_id = p_target_user_id OR m.captain_user_id = p_target_user_id)
  ) THEN
    RAISE EXCEPTION 'finish or cancel active trips before deleting this account' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.sessions WHERE user_id = p_target_user_id;
  DELETE FROM public.otp_challenges WHERE user_id = p_target_user_id;
  DELETE FROM public.telegram_phone_verification_challenges WHERE user_id = p_target_user_id;
  DELETE FROM public.user_verifications WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_saved_places WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_preferred_routes WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_commuter_preferences WHERE user_id = p_target_user_id;
  DELETE FROM public.user_location_searches WHERE user_id = p_target_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_target_user_id;
  DELETE FROM public.pool_notification_mutes WHERE user_id = p_target_user_id;
  DELETE FROM public.pool_notifications WHERE user_id = p_target_user_id OR actor_id = p_target_user_id;
  DELETE FROM public.direct_messages WHERE sender_user_id = p_target_user_id;
  DELETE FROM public.message_conversations
    WHERE participant_low_id = p_target_user_id OR participant_high_id = p_target_user_id;
  DELETE FROM public.admin_user_controls WHERE user_id = p_target_user_id;

  UPDATE public.daily_commute_requests SET
    pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.pool_members SET
    pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = 'cancelled', cancelled_at = coalesce(cancelled_at, deleted_on)
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.pool_groups g SET route_geometry = NULL
    WHERE EXISTS (SELECT 1 FROM public.pool_members m WHERE m.group_id = g.id AND m.rider_user_id = p_target_user_id);
  UPDATE public.pool_trip_stops s SET lat = NULL, lng = NULL
    FROM public.pool_members m WHERE s.member_id = m.id AND m.rider_user_id = p_target_user_id;
  UPDATE public.demand_requests SET
    pickup_label = NULL, pickup_lat = NULL, pickup_lng = NULL,
    dropoff_label = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.demand_groups g SET
    origin_lat = NULL, origin_lng = NULL, destination_lat = NULL, destination_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE EXISTS (SELECT 1 FROM public.demand_requests r WHERE r.demand_group_id = g.id AND r.rider_user_id = p_target_user_id);
  UPDATE public.captain_lines SET
    origin_label = NULL, origin_lat = NULL, origin_lng = NULL,
    destination_label = NULL, destination_lat = NULL, destination_lng = NULL,
    intermediate_stops = '[]'::jsonb, status = 'cancelled', updated_at = deleted_on
    WHERE captain_user_id = p_target_user_id;
  -- The legacy guard rejects no-op verification updates, so move an already
  -- rejected profile through pending before its final redacted state.
  UPDATE public.captain_profiles SET verification_status = 'pending'
    WHERE user_id = p_target_user_id AND verification_status = 'rejected';
  UPDATE public.captain_profiles SET
    license_number = 'REDACTED', vehicle_plate = 'REDACTED',
    current_lat = NULL, current_lng = NULL,
    verification_status = 'rejected', status = 'suspended_grace_expired'
    WHERE user_id = p_target_user_id;
  UPDATE public.trip_stops s SET lat = NULL, lng = NULL
    FROM public.trips t JOIN public.matches m ON m.id = t.match_id
    JOIN public.daily_commute_requests r ON r.id = m.daily_commute_request_id
    WHERE s.trip_id = t.id AND (r.rider_user_id = p_target_user_id OR m.captain_user_id = p_target_user_id);
  UPDATE public.users SET
    full_name = 'حساب محذوف',
    phone_number = 'deleted:' || id::text || '@account.invalid',
    password_hash = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    avatar_path = NULL, verified_at = NULL, deleted_at = deleted_on
    WHERE id = p_target_user_id;

  INSERT INTO public.account_deletion_events(actor_user_id, target_user_id, deletion_type, reason)
  VALUES (p_actor_user_id, p_target_user_id, CASE WHEN is_admin_deletion THEN 'admin' ELSE 'self_service' END,
    CASE WHEN is_admin_deletion THEN btrim(p_reason) ELSE NULL END);
  IF is_admin_deletion THEN
    PERFORM public.admin_write_audit(
      p_actor_user_id, 'user.account_deleted', 'user', p_target_user_id::text, btrim(p_reason),
      jsonb_build_object('deleted', false), jsonb_build_object('deleted', true)
    );
  END IF;
  DELETE FROM public.super_admins WHERE user_id = p_target_user_id;
  RETURN deleted_on;
END;
$$;


ALTER FUNCTION "public"."sekka_delete_account_v1"("p_actor_user_id" integer, "p_target_user_id" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_geo_km"("lat_a" double precision, "lng_a" double precision, "lat_b" double precision, "lng_b" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat_b-lat_a)/2),2) +
    cos(radians(lat_a))*cos(radians(lat_b))*power(sin(radians(lng_b-lng_a)/2),2)
  ))
$$;


ALTER FUNCTION "public"."sekka_geo_km"("lat_a" double precision, "lng_a" double precision, "lat_b" double precision, "lng_b" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_is_super_admin"("p_user_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins sa
    JOIN public.users u ON u.id=sa.user_id
    WHERE sa.user_id=p_user_id AND u.role='admin'
  );
$$;


ALTER FUNCTION "public"."sekka_is_super_admin"("p_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_match_after_demand_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  PERFORM public.sekka_match_demand_group(NEW.demand_group_id);
  UPDATE public.demand_requests r
     SET status = 'matched'
   WHERE r.id = NEW.id
     AND r.status = 'open'
     AND EXISTS (
       SELECT 1 FROM public.demand_groups g
        WHERE g.id = r.demand_group_id AND g.status = 'matched'
     );
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_match_after_demand_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_match_after_line_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE demand_row record;
BEGIN
  IF NEW.status = 'active' THEN
    FOR demand_row IN
      SELECT id FROM public.demand_groups
      WHERE status = 'open' AND vehicle_type_id = NEW.vehicle_type_id
        AND extract(dow FROM trip_date)::smallint = ANY(NEW.service_days)
    LOOP
      PERFORM public.sekka_match_demand_group(demand_row.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_match_after_line_publish"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_match_creates_trip"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE new_trip_id integer;
BEGIN
  INSERT INTO public.trips(match_id) VALUES(NEW.id) RETURNING id INTO new_trip_id;
  INSERT INTO public.trip_stops(trip_id,sequence,lat,lng)
  SELECT new_trip_id,1,pickup_lat,pickup_lng FROM public.daily_commute_requests WHERE id=NEW.daily_commute_request_id;
  INSERT INTO public.trip_stops(trip_id,sequence,lat,lng)
  SELECT new_trip_id,2,dropoff_lat,dropoff_lng FROM public.daily_commute_requests WHERE id=NEW.daily_commute_request_id;
  UPDATE public.daily_commute_requests SET status='matched' WHERE id=NEW.daily_commute_request_id;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_match_creates_trip"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_match_demand_group"("group_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN;
END;
$$;


ALTER FUNCTION "public"."sekka_match_demand_group"("group_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_match_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id=NEW.captain_user_id AND u.role='captain') THEN
    RAISE EXCEPTION 'match captain must have captain role' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_commute_requests r WHERE r.id=NEW.daily_commute_request_id AND r.status='open') THEN
    RAISE EXCEPTION 'only open requests can be matched' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_match_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_payment_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE trip_status text; reporter integer; actor_role text;
BEGIN
  IF TG_TABLE_NAME='payments' THEN
    SELECT status INTO trip_status FROM public.trips WHERE id=NEW.trip_id;
    IF trip_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'payments require a completed trip' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.to_status IN ('resolved','adjusted','voided') THEN
      IF NEW.from_status<>'disputed' THEN RAISE EXCEPTION 'admin transitions require disputed status' USING ERRCODE='23514'; END IF;
      SELECT role INTO actor_role FROM public.users WHERE id=NEW.actor_user_id;
      IF actor_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admin actor required' USING ERRCODE='23514'; END IF;
    END IF;
    IF NEW.to_status='adjusted' AND NEW.adjusted_amount IS NULL THEN
      RAISE EXCEPTION 'adjusted amount is required' USING ERRCODE='23514';
    END IF;
    IF NEW.to_status='confirmed' AND NEW.actor_user_id IS NOT NULL THEN
      SELECT reported_by_user_id INTO reporter FROM public.payments WHERE id=NEW.payment_id;
      IF reporter=NEW.actor_user_id THEN RAISE EXCEPTION 'reporter cannot confirm own payment' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_payment_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_process_pool_deadlines"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
    WHERE t.status IN ('needs_captain','scheduled') AND t.captain_user_id IS NULL AND t.departure_at <= now()
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
$$;


ALTER FUNCTION "public"."sekka_process_pool_deadlines"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_purge_expired_location_data"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer := 0;
  v_rows integer;
  v_cutoff timestamptz := clock_timestamp() - interval '30 days';
BEGIN
  UPDATE public.user_location_searches
  SET suggestions = '[]'::jsonb
  WHERE created_at < v_cutoff AND suggestions <> '[]'::jsonb;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.user_location_searches
  SET selected_lat = NULL,
      selected_lng = NULL,
      coordinates_updated_at = NULL
  WHERE coordinates_updated_at < v_cutoff
    AND (selected_lat IS NOT NULL OR selected_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_members
  SET pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff
    AND (pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_groups
  SET route_geometry = NULL, route_geometry_updated_at = NULL
  WHERE route_geometry_updated_at < v_cutoff AND route_geometry IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_trip_stops
  SET lat = NULL, lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff AND (lat IS NOT NULL OR lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.daily_commute_requests
  SET pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff
    AND (pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.trip_stops
  SET lat = NULL, lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff AND (lat IS NOT NULL OR lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.captain_profiles
  SET current_lat = NULL, current_lng = NULL, current_location_updated_at = NULL
  WHERE current_location_updated_at < v_cutoff AND (current_lat IS NOT NULL OR current_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  DELETE FROM public.google_maps_api_usage
  WHERE created_at < clock_timestamp() - interval '90 days';

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."sekka_purge_expired_location_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_register_with_policy_acceptance_v1"("p_full_name" "text", "p_phone_number" "text", "p_password_hash" "text", "p_role" "text", "p_policy_locale" "text") RETURNS TABLE("id" integer, "full_name" "text", "phone_number" "text", "role" "text", "verified_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  IF p_role NOT IN ('rider', 'captain') OR p_policy_locale NOT IN ('ar', 'en') THEN
    RAISE EXCEPTION 'invalid signup data' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(p_full_name)) NOT BETWEEN 1 AND 100
     OR length(btrim(p_phone_number)) NOT BETWEEN 1 AND 32
     OR length(p_password_hash) < 1 THEN
    RAISE EXCEPTION 'invalid signup data' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.users (
    full_name, phone_number, password_hash, role,
    terms_accepted_at, terms_version, privacy_version
  ) VALUES (
    btrim(p_full_name), btrim(p_phone_number), p_password_hash, p_role,
    clock_timestamp(), '2026-10-24', '2026-10-24'
  ) RETURNING * INTO v_user;

  INSERT INTO public.policy_acceptances (user_id, policy_type, policy_version, locale)
  VALUES
    (v_user.id, 'terms', '2026-10-24', p_policy_locale),
    (v_user.id, 'privacy', '2026-10-24', p_policy_locale);

  RETURN QUERY SELECT v_user.id, v_user.full_name, v_user.phone_number, v_user.role,
    v_user.verified_at, v_user.created_at;
END;
$$;


ALTER FUNCTION "public"."sekka_register_with_policy_acceptance_v1"("p_full_name" "text", "p_phone_number" "text", "p_password_hash" "text", "p_role" "text", "p_policy_locale" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_require_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  referenced_user integer;
BEGIN
  referenced_user := (to_jsonb(NEW)->>TG_ARGV[0])::integer;
  IF referenced_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id=referenced_user AND u.role=ANY(string_to_array(TG_ARGV[1],','))
  ) THEN
    RAISE EXCEPTION '% must reference a user with role %', TG_TABLE_NAME, TG_ARGV[1]
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_require_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_require_super_admin"("p_actor_user_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.sekka_is_super_admin(p_actor_user_id) THEN
    RAISE EXCEPTION 'super admin required' USING ERRCODE='42501';
  END IF;
END;
$$;


ALTER FUNCTION "public"."sekka_require_super_admin"("p_actor_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_reserve_google_maps_request"("p_service" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used integer;
BEGIN
  IF p_service NOT IN ('autocomplete', 'place_details', 'compute_route') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_service');
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);
  SELECT count(*) INTO v_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES (p_service);
  RETURN jsonb_build_object('allowed', true, 'monthly_remaining', GREATEST(0, 9999 - v_used));
END;
$$;


ALTER FUNCTION "public"."sekka_reserve_google_maps_request"("p_service" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_suspend_captains_with_expired_document_grace"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE suspended_count integer;
BEGIN
  WITH suspended AS (
    UPDATE public.captain_profiles cp SET status='suspended_grace_expired'
    WHERE cp.status='active' AND cp.grace_period_expires_at<=now()
      AND NOT EXISTS (
        SELECT 1 FROM public.user_verifications v
        WHERE v.user_id=cp.user_id
          AND v.document_type IN ('criminal_record','drug_test')
        GROUP BY v.user_id
        HAVING count(*) FILTER (WHERE v.status='approved')=2
      )
    RETURNING cp.user_id
  )
  INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
  SELECT user_id,NULL,'captain-verification-grace-expired:'||user_id,
    jsonb_build_object('title','تم إيقاف استقبال الرحلات مؤقتًا',
      'message','انتهت مهلة رفع واعتماد الفيش والتشبيه وتحليل المخدرات. أكمل المستندات وتواصل مع الدعم لإعادة التفعيل.')
  FROM suspended ON CONFLICT (user_id,event_key) DO NOTHING;
  GET DIAGNOSTICS suspended_count = ROW_COUNT;
  RETURN suspended_count;
END;
$$;


ALTER FUNCTION "public"."sekka_suspend_captains_with_expired_document_grace"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_sync_captain_verification_after_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL AND NEW.role='captain' THEN
    UPDATE public.captain_profiles cp SET verification_status='approved'
    WHERE cp.user_id=NEW.id
      AND EXISTS (
        SELECT 1 FROM public.user_verifications v WHERE v.user_id=NEW.id
          AND v.status='approved'
          AND v.document_type IN ('national_id_front','national_id_back','driving_license_front',
            'driving_license_back','vehicle_license_front','vehicle_license_back')
        GROUP BY v.user_id HAVING count(*)=6
      );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sekka_sync_captain_verification_after_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_take_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE allowed boolean;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR length(p_key) > 512 THEN
    RAISE EXCEPTION 'invalid rate limit parameters' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.api_rate_limits(key,window_started_at,hit_count,updated_at)
    VALUES(p_key,now(),1,now())
  ON CONFLICT(key) DO UPDATE SET
    window_started_at=CASE
      WHEN public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE public.api_rate_limits.window_started_at END,
    hit_count=CASE
      WHEN public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE public.api_rate_limits.hit_count+1 END,
    updated_at=now()
  RETURNING hit_count <= p_limit INTO allowed;
  RETURN allowed;
END
$$;


ALTER FUNCTION "public"."sekka_take_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_track_route_geometry_age"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.route_geometry IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.route_geometry IS NOT NULL THEN
      NEW.route_geometry_updated_at := NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.route_geometry IS DISTINCT FROM OLD.route_geometry THEN
    NEW.route_geometry_updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sekka_track_route_geometry_age"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_trip_complete_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.status='completed' AND OLD.status<>'completed' AND EXISTS (
    SELECT 1 FROM public.trip_stops s WHERE s.trip_id=NEW.id AND s.reached_at IS NULL
  ) THEN
    RAISE EXCEPTION 'all trip stops must be reached before completion' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_trip_complete_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_trip_stop_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.reached_at IS NOT NULL AND NEW.sequence>1 AND EXISTS (
    SELECT 1 FROM public.trip_stops s WHERE s.trip_id=NEW.trip_id AND s.sequence=NEW.sequence-1 AND s.reached_at IS NULL
  ) THEN
    RAISE EXCEPTION 'trip stops must be reached in sequence order' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_trip_stop_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sekka_validate_vehicle_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  current_capacity integer;
BEGIN
  IF TG_TABLE_NAME='service_categories' THEN
    SELECT capacity_max INTO current_capacity FROM public.vehicle_types WHERE id=NEW.vehicle_type_id;
    IF NEW.max_seats > current_capacity THEN
      RAISE EXCEPTION 'service category max_seats exceeds vehicle capacity' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.service_categories c WHERE c.vehicle_type_id=NEW.id AND c.max_seats>NEW.capacity_max) THEN
      RAISE EXCEPTION 'vehicle capacity would violate service category capacity' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sekka_validate_vehicle_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_direct_message"("p_sender_user_id" integer, "p_conversation_id" bigint, "p_body" "text") RETURNS TABLE("id" bigint, "conversation_id" bigint, "sender_user_id" integer, "body" "text", "created_at" timestamp with time zone, "read_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  conversation_row public.message_conversations;
  inserted_message public.direct_messages;
  recipient_user_id integer;
BEGIN
  IF p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'invalid message body' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO conversation_row
  FROM public.message_conversations
  WHERE id = p_conversation_id
    AND p_sender_user_id IN (participant_low_id, participant_high_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  recipient_user_id := CASE
    WHEN p_sender_user_id = conversation_row.participant_low_id THEN conversation_row.participant_high_id
    ELSE conversation_row.participant_low_id
  END;

  INSERT INTO public.direct_messages (conversation_id, sender_user_id, body)
  VALUES (p_conversation_id, p_sender_user_id, btrim(p_body))
  RETURNING * INTO inserted_message;

  UPDATE public.message_conversations
  SET last_message_at = inserted_message.created_at,
      last_message_body = inserted_message.body,
      last_message_sender_id = p_sender_user_id,
      unread_low = unread_low + CASE WHEN recipient_user_id = participant_low_id THEN 1 ELSE 0 END,
      unread_high = unread_high + CASE WHEN recipient_user_id = participant_high_id THEN 1 ELSE 0 END
  WHERE id = p_conversation_id;

  RETURN QUERY SELECT inserted_message.id, inserted_message.conversation_id,
    inserted_message.sender_user_id, inserted_message.body,
    inserted_message.created_at, inserted_message.read_at;
END;
$$;


ALTER FUNCTION "public"."send_direct_message"("p_sender_user_id" integer, "p_conversation_id" bigint, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_captain_line_status"("actor_id" integer, "line_id" integer, "next_status" "text") RETURNS "public"."captain_lines"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE updated public.captain_lines%ROWTYPE;
BEGIN
  IF next_status NOT IN ('active','paused','cancelled') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE='22023';
  END IF;

  PERFORM 1 FROM public.captain_lines
    WHERE id=line_id AND captain_user_id=actor_id
    FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id
    WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL
      AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired'
  ) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;

  IF next_status='cancelled' AND EXISTS (
    SELECT 1 FROM public.demand_groups g
    JOIN public.demand_requests r ON r.demand_group_id=g.id
    WHERE g.captain_line_id=line_id AND g.status='matched'
      AND r.status IN ('open','matched')
  ) THEN
    RAISE EXCEPTION 'a rider has joined this line' USING ERRCODE='55000';
  END IF;

  UPDATE public.captain_lines SET status=next_status, updated_at=now()
    WHERE id=line_id AND captain_user_id=actor_id
    RETURNING * INTO updated;
  RETURN updated;
END $$;


ALTER FUNCTION "public"."set_captain_line_status"("actor_id" integer, "line_id" integer, "next_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_captain_line"("actor_id" integer, "line_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "return_arrives" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[]) RETURNS "public"."captain_lines"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE updated public.captain_lines%ROWTYPE; allowed_seats integer;
BEGIN
  PERFORM 1 FROM public.captain_lines WHERE id=line_id AND captain_user_id=actor_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired' AND c.vehicle_type_id=vehicle_id) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.demand_groups g JOIN public.demand_requests r ON r.demand_group_id=g.id WHERE g.captain_line_id=line_id AND g.status='matched' AND r.status IN ('open','matched')) THEN
    RAISE EXCEPTION 'a rider has joined this line' USING ERRCODE='55000';
  END IF;
  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7 OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) OR cardinality(methods)=0 OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;
  UPDATE public.captain_lines SET vehicle_type_id=vehicle_id,origin_label=origin_name,origin_lat=origin_y,origin_lng=origin_x,
    destination_label=destination_name,destination_lat=destination_y,destination_lng=destination_x,intermediate_stops=coalesce(stops,'[]'::jsonb),
    arrival_time=arrival,return_arrival_time=return_arrives,service_days=days,seats=seat_count,route_distance_km=route_km,
    price_per_seat=seat_price,payment_methods=methods,updated_at=now() WHERE id=line_id AND captain_user_id=actor_id RETURNING * INTO updated;
  RETURN updated;
END $$;


ALTER FUNCTION "public"."update_captain_line"("actor_id" integer, "line_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "return_arrives" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_deletion_events" (
    "id" bigint NOT NULL,
    "actor_user_id" integer NOT NULL,
    "target_user_id" integer NOT NULL,
    "deletion_type" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_deletion_events_deletion_type_check" CHECK (("deletion_type" = ANY (ARRAY['self_service'::"text", 'admin'::"text"]))),
    CONSTRAINT "account_deletion_events_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 1000)))
);


ALTER TABLE "public"."account_deletion_events" OWNER TO "postgres";


ALTER TABLE "public"."account_deletion_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."account_deletion_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" bigint NOT NULL,
    "actor_user_id" integer NOT NULL,
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "reason" "text",
    "before_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "after_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "request_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_logs_action_check" CHECK ((("char_length"("action") >= 1) AND ("char_length"("action") <= 100))),
    CONSTRAINT "admin_audit_logs_after_state_check" CHECK (("jsonb_typeof"("after_state") = 'object'::"text")),
    CONSTRAINT "admin_audit_logs_before_state_check" CHECK (("jsonb_typeof"("before_state") = 'object'::"text")),
    CONSTRAINT "admin_audit_logs_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 1000))),
    CONSTRAINT "admin_audit_logs_resource_type_check" CHECK ((("char_length"("resource_type") >= 1) AND ("char_length"("resource_type") <= 80)))
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."admin_audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."admin_ledger_adjustments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_ledger_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."admin_trip_actions" (
    "id" bigint NOT NULL,
    "trip_kind" "text" NOT NULL,
    "trip_id" integer NOT NULL,
    "action" "text" NOT NULL,
    "reason_tag" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "actor_user_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_trip_actions_action_check" CHECK (("action" = ANY (ARRAY['cancelled'::"text", 'captain_reassigned'::"text"]))),
    CONSTRAINT "admin_trip_actions_reason_check" CHECK ((("char_length"("btrim"("reason")) >= 1) AND ("char_length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "admin_trip_actions_reason_tag_check" CHECK ((("char_length"("btrim"("reason_tag")) >= 1) AND ("char_length"("btrim"("reason_tag")) <= 80))),
    CONSTRAINT "admin_trip_actions_trip_kind_check" CHECK (("trip_kind" = ANY (ARRAY['daily'::"text", 'pool'::"text"])))
);


ALTER TABLE "public"."admin_trip_actions" OWNER TO "postgres";


ALTER TABLE "public"."admin_trip_actions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_trip_actions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."api_rate_limits" (
    "key" "text" NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "hit_count" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "api_rate_limits_hit_count_check" CHECK (("hit_count" > 0))
);


ALTER TABLE "public"."api_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "config_key" "text" NOT NULL,
    "numeric_value" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_config_captain_line_rate_check" CHECK ((("config_key" <> 'captain_line_price_per_km'::"text") OR (("numeric_value" >= (7)::numeric) AND ("numeric_value" <= (11)::numeric)))),
    CONSTRAINT "app_config_numeric_value_check" CHECK (("numeric_value" > (0)::numeric))
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_feature_flags" (
    "flag_name" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "updated_by_user_id" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_feature_flags_flag_name_check" CHECK (("flag_name" = 'captain_phone_otp'::"text"))
);


ALTER TABLE "public"."app_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "actor_user_id" integer,
    "event_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" integer NOT NULL,
    "before_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "after_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_log_after_state_check" CHECK ((("jsonb_typeof"("after_state") = 'object'::"text") AND (("after_state" - ARRAY['status'::"text", 'captain_line_id'::"text", 'demand_group_id'::"text", 'seats'::"text"]) = '{}'::"jsonb"))),
    CONSTRAINT "audit_log_before_state_check" CHECK ((("jsonb_typeof"("before_state") = 'object'::"text") AND (("before_state" - ARRAY['status'::"text", 'captain_line_id'::"text", 'demand_group_id'::"text", 'seats'::"text"]) = '{}'::"jsonb"))),
    CONSTRAINT "audit_log_event_type_check" CHECK (("event_type" = ANY (ARRAY['captain_line.created'::"text", 'captain_line.lifecycle_changed'::"text", 'demand_group.created'::"text", 'demand_group.lifecycle_changed'::"text", 'demand_request.created'::"text", 'demand_request.lifecycle_changed'::"text"]))),
    CONSTRAINT "audit_log_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['captain_line'::"text", 'demand_group'::"text", 'demand_request'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."captain_lines" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."captain_lines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."captain_profiles" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "vehicle_type_id" "text" NOT NULL,
    "license_number" "text" NOT NULL,
    "vehicle_plate" "text" NOT NULL,
    "verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "current_lat" double precision,
    "current_lng" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_location_updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "grace_period_expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    CONSTRAINT "captain_profiles_current_lat_check" CHECK ((("current_lat" IS NULL) OR (("current_lat" >= ('-90'::integer)::double precision) AND ("current_lat" <= (90)::double precision)))),
    CONSTRAINT "captain_profiles_current_lng_check" CHECK ((("current_lng" IS NULL) OR (("current_lng" >= ('-180'::integer)::double precision) AND ("current_lng" <= (180)::double precision)))),
    CONSTRAINT "captain_profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended_grace_expired'::"text"]))),
    CONSTRAINT "captain_profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."captain_profiles" OWNER TO "postgres";


ALTER TABLE "public"."captain_profiles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."captain_profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."commuter_board_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'campaign'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" DEFAULT '⌖'::"text" NOT NULL,
    "cta_text" "text" NOT NULL,
    "cta_action" "text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "targeting_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "display_duration" integer DEFAULT 10 NOT NULL,
    "created_by_admin" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commuter_board_campaigns_cta_action_check" CHECK (("cta_action" = ANY (ARRAY['open-booking'::"text", 'open-trips'::"text", 'invite-friends'::"text", 'manage-preferences'::"text"]))),
    CONSTRAINT "commuter_board_campaigns_cta_text_check" CHECK ((("char_length"("btrim"("cta_text")) >= 1) AND ("char_length"("btrim"("cta_text")) <= 60))),
    CONSTRAINT "commuter_board_campaigns_date_range_check" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" > "start_date"))),
    CONSTRAINT "commuter_board_campaigns_description_check" CHECK ((("char_length"("btrim"("description")) >= 1) AND ("char_length"("btrim"("description")) <= 500))),
    CONSTRAINT "commuter_board_campaigns_display_duration_check" CHECK ((("display_duration" >= 5) AND ("display_duration" <= 30))),
    CONSTRAINT "commuter_board_campaigns_icon_check" CHECK (("char_length"("icon") <= 16)),
    CONSTRAINT "commuter_board_campaigns_priority_check" CHECK ((("priority" >= 0) AND ("priority" <= 100))),
    CONSTRAINT "commuter_board_campaigns_targeting_rules_check" CHECK (("jsonb_typeof"("targeting_rules") = 'object'::"text")),
    CONSTRAINT "commuter_board_campaigns_title_check" CHECK ((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 120))),
    CONSTRAINT "commuter_board_campaigns_type_check" CHECK (("type" = ANY (ARRAY['weekly_reminder'::"text", 'monthly_reminder'::"text", 'invite_friends'::"text", 'campaign'::"text"])))
);


ALTER TABLE "public"."commuter_board_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_commute_requests" (
    "id" integer NOT NULL,
    "rider_user_id" integer NOT NULL,
    "service_category_id" "text" NOT NULL,
    "pickup_lat" double precision,
    "pickup_lng" double precision,
    "dropoff_lat" double precision,
    "dropoff_lng" double precision,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_data_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "daily_commute_requests_dropoff_lat_check" CHECK ((("dropoff_lat" >= ('-90'::integer)::double precision) AND ("dropoff_lat" <= (90)::double precision))),
    CONSTRAINT "daily_commute_requests_dropoff_lng_check" CHECK ((("dropoff_lng" >= ('-180'::integer)::double precision) AND ("dropoff_lng" <= (180)::double precision))),
    CONSTRAINT "daily_commute_requests_pickup_lat_check" CHECK ((("pickup_lat" >= ('-90'::integer)::double precision) AND ("pickup_lat" <= (90)::double precision))),
    CONSTRAINT "daily_commute_requests_pickup_lng_check" CHECK ((("pickup_lng" >= ('-180'::integer)::double precision) AND ("pickup_lng" <= (180)::double precision))),
    CONSTRAINT "daily_commute_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."daily_commute_requests" OWNER TO "postgres";


ALTER TABLE "public"."daily_commute_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."daily_commute_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."demand_groups" (
    "id" integer NOT NULL,
    "vehicle_type_id" "text" NOT NULL,
    "origin_lat" double precision,
    "origin_lng" double precision,
    "destination_lat" double precision,
    "destination_lng" double precision,
    "trip_date" "date" NOT NULL,
    "arrival_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "captain_line_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "return_arrival_time" time without time zone,
    "matched_direction" "text",
    CONSTRAINT "demand_groups_destination_lat_check" CHECK ((("destination_lat" >= ('-90'::integer)::double precision) AND ("destination_lat" <= (90)::double precision))),
    CONSTRAINT "demand_groups_destination_lng_check" CHECK ((("destination_lng" >= ('-180'::integer)::double precision) AND ("destination_lng" <= (180)::double precision))),
    CONSTRAINT "demand_groups_matched_direction_check" CHECK (("matched_direction" = ANY (ARRAY['outbound'::"text", 'return'::"text", 'roundtrip'::"text"]))),
    CONSTRAINT "demand_groups_origin_lat_check" CHECK ((("origin_lat" >= ('-90'::integer)::double precision) AND ("origin_lat" <= (90)::double precision))),
    CONSTRAINT "demand_groups_origin_lng_check" CHECK ((("origin_lng" >= ('-180'::integer)::double precision) AND ("origin_lng" <= (180)::double precision))),
    CONSTRAINT "demand_groups_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'matched'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."demand_groups" OWNER TO "postgres";


ALTER TABLE "public"."demand_groups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."demand_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."demand_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."demand_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" bigint NOT NULL,
    "conversation_id" bigint NOT NULL,
    "sender_user_id" integer NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "direct_messages_body_check" CHECK ((("length"("btrim"("body")) >= 1) AND ("length"("btrim"("body")) <= 2000)))
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


ALTER TABLE "public"."direct_messages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."direct_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."google_maps_api_usage" (
    "id" bigint NOT NULL,
    "service" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_maps_api_usage_service_check" CHECK (("service" = ANY (ARRAY['autocomplete'::"text", 'place_details'::"text", 'compute_route'::"text"])))
);


ALTER TABLE "public"."google_maps_api_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."google_maps_api_usage" IS 'Anonymous service counters enforcing the application-wide 10,000 Google Places and Routes request cap per UTC month.';



ALTER TABLE "public"."google_maps_api_usage" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."google_maps_api_usage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" integer NOT NULL,
    "daily_commute_request_id" integer NOT NULL,
    "captain_user_id" integer NOT NULL,
    "distance_km" double precision NOT NULL,
    "matched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matches_distance_km_check" CHECK (("distance_km" >= (0)::double precision))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


ALTER TABLE "public"."matches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."message_conversations" (
    "id" bigint NOT NULL,
    "participant_low_id" integer NOT NULL,
    "participant_high_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "last_message_body" "text",
    "last_message_sender_id" integer,
    "unread_low" integer DEFAULT 0 NOT NULL,
    "unread_high" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "message_conversations_sorted_participants" CHECK (("participant_low_id" < "participant_high_id")),
    CONSTRAINT "message_conversations_unread_high_check" CHECK (("unread_high" >= 0)),
    CONSTRAINT "message_conversations_unread_low_check" CHECK (("unread_low" >= 0))
);


ALTER TABLE "public"."message_conversations" OWNER TO "postgres";


ALTER TABLE "public"."message_conversations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."message_conversations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."otp_challenges" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "otp_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "purpose" "text" NOT NULL,
    CONSTRAINT "otp_challenges_purpose_check" CHECK (("purpose" = 'phone_verification'::"text"))
);


ALTER TABLE "public"."otp_challenges" OWNER TO "postgres";


ALTER TABLE "public"."otp_challenges" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."otp_challenges_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payment_status_events" (
    "id" integer NOT NULL,
    "payment_id" integer NOT NULL,
    "from_status" "text" NOT NULL,
    "to_status" "text" NOT NULL,
    "actor_user_id" integer,
    "reason" "text",
    "adjusted_amount" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_status_events_adjusted_amount_check" CHECK ((("adjusted_amount" IS NULL) OR ("adjusted_amount" >= (0)::double precision))),
    CONSTRAINT "payment_status_events_from_status_check" CHECK (("from_status" = ANY (ARRAY['confirmed'::"text", 'disputed'::"text", 'resolved'::"text", 'adjusted'::"text", 'voided'::"text"]))),
    CONSTRAINT "payment_status_events_to_status_check" CHECK (("to_status" = ANY (ARRAY['confirmed'::"text", 'disputed'::"text", 'resolved'::"text", 'adjusted'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."payment_status_events" OWNER TO "postgres";


ALTER TABLE "public"."payment_status_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."payment_status_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."policy_acceptances" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "policy_type" "text" NOT NULL,
    "policy_version" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "policy_acceptances_locale_check" CHECK (("locale" = ANY (ARRAY['ar'::"text", 'en'::"text"]))),
    CONSTRAINT "policy_acceptances_policy_type_check" CHECK (("policy_type" = ANY (ARRAY['terms'::"text", 'privacy'::"text"]))),
    CONSTRAINT "policy_acceptances_policy_version_check" CHECK (("policy_version" ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'::"text"))
);


ALTER TABLE "public"."policy_acceptances" OWNER TO "postgres";


ALTER TABLE "public"."policy_acceptances" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."policy_acceptances_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_captain_capabilities" (
    "captain_user_id" integer NOT NULL,
    "has_ac" smallint NOT NULL,
    "accepts_faster" smallint DEFAULT 1 NOT NULL,
    "accepts_saver" smallint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_captain_capabilities_accepts_faster_check" CHECK (("accepts_faster" = ANY (ARRAY[0, 1]))),
    CONSTRAINT "pool_captain_capabilities_accepts_saver_check" CHECK (("accepts_saver" = ANY (ARRAY[0, 1]))),
    CONSTRAINT "pool_captain_capabilities_check" CHECK ((("accepts_faster" = 1) OR ("accepts_saver" = 1))),
    CONSTRAINT "pool_captain_capabilities_has_ac_check" CHECK (("has_ac" = ANY (ARRAY[0, 1])))
);


ALTER TABLE "public"."pool_captain_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pool_captain_escrow_transfers" (
    "id" integer NOT NULL,
    "escrow_id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "original_captain_user_id" integer NOT NULL,
    "replacement_captain_user_id" integer NOT NULL,
    "amount_due" double precision NOT NULL,
    "escrow_funded_amount" double precision NOT NULL,
    "unfunded_amount" double precision NOT NULL,
    "transfer_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_captain_escrow_transfers_amount_due_check" CHECK (("amount_due" >= (0)::double precision)),
    CONSTRAINT "pool_captain_escrow_transfers_check" CHECK ((("escrow_funded_amount" >= (0)::double precision) AND ("escrow_funded_amount" <= "amount_due"))),
    CONSTRAINT "pool_captain_escrow_transfers_check1" CHECK (("abs"((("amount_due" - "escrow_funded_amount") - "unfunded_amount")) < (0.01)::double precision)),
    CONSTRAINT "pool_captain_escrow_transfers_transfer_status_check" CHECK (("transfer_status" = ANY (ARRAY['pending'::"text", 'transferred'::"text"]))),
    CONSTRAINT "pool_captain_escrow_transfers_unfunded_amount_check" CHECK (("unfunded_amount" >= (0)::double precision))
);


ALTER TABLE "public"."pool_captain_escrow_transfers" OWNER TO "postgres";


ALTER TABLE "public"."pool_captain_escrow_transfers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_captain_escrow_transfers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_captain_escrows" (
    "id" integer NOT NULL,
    "group_id" integer NOT NULL,
    "original_captain_user_id" integer NOT NULL,
    "package_type" "text" NOT NULL,
    "service_days" integer NOT NULL,
    "daily_captain_share_amount" double precision NOT NULL,
    "reserved_amount" double precision NOT NULL,
    "used_amount" double precision DEFAULT 0 NOT NULL,
    "released_amount" double precision DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "pool_captain_escrows_check" CHECK ((("used_amount" >= (0)::double precision) AND ("used_amount" <= "reserved_amount"))),
    CONSTRAINT "pool_captain_escrows_daily_captain_share_amount_check" CHECK (("daily_captain_share_amount" >= (0)::double precision)),
    CONSTRAINT "pool_captain_escrows_package_type_check" CHECK (("package_type" = ANY (ARRAY['weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "pool_captain_escrows_released_amount_check" CHECK (("released_amount" >= (0)::double precision)),
    CONSTRAINT "pool_captain_escrows_reserved_amount_check" CHECK (("reserved_amount" >= (0)::double precision)),
    CONSTRAINT "pool_captain_escrows_service_days_check" CHECK ((("service_days" >= 1) AND ("service_days" <= 22))),
    CONSTRAINT "pool_captain_escrows_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'released'::"text"])))
);


ALTER TABLE "public"."pool_captain_escrows" OWNER TO "postgres";


ALTER TABLE "public"."pool_captain_escrows" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_captain_escrows_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_captain_stats" (
    "captain_user_id" integer NOT NULL,
    "absences" integer DEFAULT 0 NOT NULL,
    "search_radius_km" double precision DEFAULT 4 NOT NULL,
    CONSTRAINT "pool_captain_stats_absences_check" CHECK (("absences" >= 0)),
    CONSTRAINT "pool_captain_stats_search_radius_km_check" CHECK ((("search_radius_km" >= (4)::double precision) AND ("search_radius_km" <= (10)::double precision)))
);


ALTER TABLE "public"."pool_captain_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pool_categories" (
    "id" "text" NOT NULL,
    "speed_tier" "text" NOT NULL,
    "has_ac" smallint NOT NULL,
    "seats" integer NOT NULL,
    "base_fee" double precision NOT NULL,
    "rate_per_km" double precision NOT NULL,
    "rate_per_min" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_categories_base_fee_check" CHECK (("base_fee" >= (0)::double precision)),
    CONSTRAINT "pool_categories_has_ac_check" CHECK (("has_ac" = ANY (ARRAY[0, 1]))),
    CONSTRAINT "pool_categories_rate_per_km_check" CHECK (("rate_per_km" >= (0)::double precision)),
    CONSTRAINT "pool_categories_rate_per_min_check" CHECK (("rate_per_min" >= (0)::double precision)),
    CONSTRAINT "pool_categories_seats_check" CHECK (("seats" >= 1)),
    CONSTRAINT "pool_categories_speed_tier_check" CHECK (("speed_tier" = ANY (ARRAY['faster'::"text", 'saver'::"text"])))
);


ALTER TABLE "public"."pool_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pool_groups" (
    "id" integer NOT NULL,
    "created_by_user_id" integer NOT NULL,
    "category_id" "text" NOT NULL,
    "package_type" "text" NOT NULL,
    "service_dates" "jsonb" NOT NULL,
    "morning_departure" time without time zone NOT NULL,
    "return_departure" time without time zone NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "route_distance_km" double precision,
    "route_duration_min" double precision,
    "seat_day_fare" double precision,
    "route_geometry" "jsonb",
    "route_version" integer DEFAULT 0 NOT NULL,
    "fixed_captain_user_id" integer,
    "waiting_since" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "route_geometry_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pool_groups_package_type_check" CHECK (("package_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "pool_groups_route_distance_km_check" CHECK ((("route_distance_km" IS NULL) OR ("route_distance_km" >= (0)::double precision))),
    CONSTRAINT "pool_groups_route_duration_min_check" CHECK ((("route_duration_min" IS NULL) OR ("route_duration_min" >= (0)::double precision))),
    CONSTRAINT "pool_groups_seat_day_fare_check" CHECK ((("seat_day_fare" IS NULL) OR ("seat_day_fare" >= (0)::double precision))),
    CONSTRAINT "pool_groups_service_dates_check" CHECK (("jsonb_typeof"("service_dates") = 'array'::"text")),
    CONSTRAINT "pool_groups_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'minimum_met'::"text", 'active'::"text", 'price_review'::"text", 'needs_captain'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."pool_groups" OWNER TO "postgres";


ALTER TABLE "public"."pool_groups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_ledger" (
    "id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "list_amount" double precision NOT NULL,
    "rider_amount" double precision NOT NULL,
    "discount_amount" double precision DEFAULT 0 NOT NULL,
    "company_share_amount" double precision DEFAULT 0 NOT NULL,
    "captain_share_amount" double precision DEFAULT 0 NOT NULL,
    "company_commission_rate" double precision DEFAULT 0 NOT NULL,
    "settlement_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_ledger_captain_share_amount_check" CHECK (("captain_share_amount" >= (0)::double precision)),
    CONSTRAINT "pool_ledger_company_commission_rate_check" CHECK ((("company_commission_rate" >= (0)::double precision) AND ("company_commission_rate" <= (1)::double precision))),
    CONSTRAINT "pool_ledger_company_share_amount_check" CHECK (("company_share_amount" >= (0)::double precision)),
    CONSTRAINT "pool_ledger_discount_amount_check" CHECK (("discount_amount" >= (0)::double precision)),
    CONSTRAINT "pool_ledger_list_amount_check" CHECK (("list_amount" >= (0)::double precision)),
    CONSTRAINT "pool_ledger_rider_amount_check" CHECK (("rider_amount" >= (0)::double precision)),
    CONSTRAINT "pool_ledger_settlement_status_check" CHECK (("settlement_status" = ANY (ARRAY['pending'::"text", 'settled'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."pool_ledger" OWNER TO "postgres";


ALTER TABLE "public"."pool_ledger" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_members" (
    "id" integer NOT NULL,
    "group_id" integer NOT NULL,
    "rider_user_id" integer NOT NULL,
    "pickup_lat" double precision,
    "pickup_lng" double precision,
    "dropoff_lat" double precision,
    "dropoff_lng" double precision,
    "seats_reserved" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "price_decision" "text" DEFAULT 'pending'::"text" NOT NULL,
    "pickup_order" integer DEFAULT 0 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    "pickup_place_id" "text",
    "dropoff_place_id" "text",
    "location_data_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pool_members_dropoff_lat_check" CHECK ((("dropoff_lat" >= ('-90'::integer)::double precision) AND ("dropoff_lat" <= (90)::double precision))),
    CONSTRAINT "pool_members_dropoff_lng_check" CHECK ((("dropoff_lng" >= ('-180'::integer)::double precision) AND ("dropoff_lng" <= (180)::double precision))),
    CONSTRAINT "pool_members_pickup_lat_check" CHECK ((("pickup_lat" >= ('-90'::integer)::double precision) AND ("pickup_lat" <= (90)::double precision))),
    CONSTRAINT "pool_members_pickup_lng_check" CHECK ((("pickup_lng" >= ('-180'::integer)::double precision) AND ("pickup_lng" <= (180)::double precision))),
    CONSTRAINT "pool_members_pickup_order_check" CHECK (("pickup_order" >= 0)),
    CONSTRAINT "pool_members_price_decision_check" CHECK (("price_decision" = ANY (ARRAY['pending'::"text", 'accepted'::"text"]))),
    CONSTRAINT "pool_members_seats_reserved_check" CHECK (("seats_reserved" >= 1)),
    CONSTRAINT "pool_members_status_check" CHECK (("status" = ANY (ARRAY['awaiting_confirmation'::"text", 'active'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pool_members" OWNER TO "postgres";


ALTER TABLE "public"."pool_members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_notification_mutes" (
    "user_id" integer NOT NULL,
    "group_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pool_notification_mutes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pool_notifications" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "group_id" integer,
    "event_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "actor_id" integer,
    "type" "text" DEFAULT 'ride'::"text" NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "pool_notifications_type_check" CHECK (("type" = ANY (ARRAY['ride'::"text", 'chat'::"text", 'rating'::"text", 'alert'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."pool_notifications" OWNER TO "postgres";


ALTER TABLE "public"."pool_notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_subscriptions" (
    "id" integer NOT NULL,
    "group_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "package_type" "text" NOT NULL,
    "seat_day_fare" double precision NOT NULL,
    "discount_rate" double precision NOT NULL,
    "service_days" integer NOT NULL,
    "seats_reserved" integer NOT NULL,
    "amount_due" double precision NOT NULL,
    "cancelled_at" timestamp with time zone,
    "refund_amount" double precision DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_subscriptions_amount_due_check" CHECK (("amount_due" >= (0)::double precision)),
    CONSTRAINT "pool_subscriptions_discount_rate_check" CHECK ((("discount_rate" >= (0)::double precision) AND ("discount_rate" <= (0.10)::double precision))),
    CONSTRAINT "pool_subscriptions_package_type_check" CHECK (("package_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "pool_subscriptions_refund_amount_check" CHECK (("refund_amount" >= (0)::double precision)),
    CONSTRAINT "pool_subscriptions_seat_day_fare_check" CHECK (("seat_day_fare" >= (0)::double precision)),
    CONSTRAINT "pool_subscriptions_seats_reserved_check" CHECK (("seats_reserved" >= 1)),
    CONSTRAINT "pool_subscriptions_service_days_check" CHECK (("service_days" >= 1))
);


ALTER TABLE "public"."pool_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."pool_subscriptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_trip_cancellations" (
    "id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "charge_amount" double precision NOT NULL,
    "refund_amount" double precision NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pool_trip_cancellations_charge_amount_check" CHECK (("charge_amount" >= (0)::double precision)),
    CONSTRAINT "pool_trip_cancellations_refund_amount_check" CHECK (("refund_amount" >= (0)::double precision))
);


ALTER TABLE "public"."pool_trip_cancellations" OWNER TO "postgres";


ALTER TABLE "public"."pool_trip_cancellations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_trip_cancellations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_trip_stops" (
    "id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "stop_type" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "reached_at" timestamp with time zone,
    "location_data_updated_at" timestamp with time zone DEFAULT "now"(),
    "place_id" "text",
    CONSTRAINT "pool_trip_stops_lat_check" CHECK ((("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision))),
    CONSTRAINT "pool_trip_stops_lng_check" CHECK ((("lng" >= ('-180'::integer)::double precision) AND ("lng" <= (180)::double precision))),
    CONSTRAINT "pool_trip_stops_sequence_check" CHECK (("sequence" >= 1)),
    CONSTRAINT "pool_trip_stops_stop_type_check" CHECK (("stop_type" = ANY (ARRAY['pickup'::"text", 'dropoff'::"text"])))
);


ALTER TABLE "public"."pool_trip_stops" OWNER TO "postgres";


ALTER TABLE "public"."pool_trip_stops" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_trip_stops_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pool_trips" (
    "id" integer NOT NULL,
    "group_id" integer NOT NULL,
    "service_date" "date" NOT NULL,
    "direction" "text" NOT NULL,
    "departure_at" timestamp with time zone NOT NULL,
    "estimated_arrival_at" timestamp with time zone,
    "captain_user_id" integer,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "pool_trips_direction_check" CHECK (("direction" = ANY (ARRAY['outbound'::"text", 'return'::"text"]))),
    CONSTRAINT "pool_trips_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'assigned'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'needs_captain'::"text"])))
);


ALTER TABLE "public"."pool_trips" OWNER TO "postgres";


ALTER TABLE "public"."pool_trips" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pool_trips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pricing_config" (
    "vehicle_type_id" "text" NOT NULL,
    "base_fee" double precision NOT NULL,
    "rate_per_km" double precision NOT NULL,
    "rate_per_min" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_config_base_fee_check" CHECK (("base_fee" >= (0)::double precision)),
    CONSTRAINT "pricing_config_rate_per_km_check" CHECK (("rate_per_km" >= (0)::double precision)),
    CONSTRAINT "pricing_config_rate_per_min_check" CHECK (("rate_per_min" >= (0)::double precision))
);


ALTER TABLE "public"."pricing_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_subscriptions_auth_check" CHECK ((("length"("auth") >= 8) AND ("length"("auth") <= 128))),
    CONSTRAINT "push_subscriptions_endpoint_check" CHECK ((("length"("endpoint") >= 12) AND ("length"("endpoint") <= 4096))),
    CONSTRAINT "push_subscriptions_p256dh_check" CHECK ((("length"("p256dh") >= 16) AND ("length"("p256dh") <= 256)))
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."push_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rider_commuter_preferences" (
    "user_id" integer NOT NULL,
    "usual_days" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4] NOT NULL,
    "usual_departure_time" time without time zone DEFAULT '07:30:00'::time without time zone NOT NULL,
    "usual_return_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "frequent_places" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rider_commuter_preferences_days_check" CHECK (((("cardinality"("usual_days") >= 1) AND ("cardinality"("usual_days") <= 7)) AND ("usual_days" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]))),
    CONSTRAINT "rider_commuter_preferences_frequent_places_check" CHECK (("jsonb_typeof"("frequent_places") = 'array'::"text"))
);


ALTER TABLE "public"."rider_commuter_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rider_preferred_routes" (
    "user_id" integer NOT NULL,
    "pickup_label" "text",
    "pickup_lat" double precision,
    "pickup_lng" double precision,
    "dropoff_label" "text",
    "dropoff_lat" double precision,
    "dropoff_lng" double precision,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rider_preferred_routes_dropoff_valid" CHECK (((("dropoff_label" IS NULL) AND ("dropoff_lat" IS NULL) AND ("dropoff_lng" IS NULL)) OR (("dropoff_label" IS NOT NULL) AND (("char_length"("btrim"("dropoff_label")) >= 1) AND ("char_length"("btrim"("dropoff_label")) <= 240)) AND ("dropoff_lat" IS NOT NULL) AND ("dropoff_lng" IS NOT NULL) AND (("dropoff_lat" >= (29.65)::double precision) AND ("dropoff_lat" <= (30.45)::double precision)) AND (("dropoff_lng" >= (30.55)::double precision) AND ("dropoff_lng" <= (31.85)::double precision))))),
    CONSTRAINT "rider_preferred_routes_has_location" CHECK ((("pickup_label" IS NOT NULL) OR ("dropoff_label" IS NOT NULL))),
    CONSTRAINT "rider_preferred_routes_pickup_valid" CHECK (((("pickup_label" IS NULL) AND ("pickup_lat" IS NULL) AND ("pickup_lng" IS NULL)) OR (("pickup_label" IS NOT NULL) AND (("char_length"("btrim"("pickup_label")) >= 1) AND ("char_length"("btrim"("pickup_label")) <= 240)) AND ("pickup_lat" IS NOT NULL) AND ("pickup_lng" IS NOT NULL) AND (("pickup_lat" >= (29.65)::double precision) AND ("pickup_lat" <= (30.45)::double precision)) AND (("pickup_lng" >= (30.55)::double precision) AND ("pickup_lng" <= (31.85)::double precision)))))
);


ALTER TABLE "public"."rider_preferred_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rider_saved_places" (
    "user_id" integer NOT NULL,
    "place_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rider_saved_places_label_check" CHECK ((("char_length"("btrim"("label")) >= 1) AND ("char_length"("btrim"("label")) <= 240))),
    CONSTRAINT "rider_saved_places_lat_check" CHECK ((("lat" >= (29.65)::double precision) AND ("lat" <= (30.45)::double precision))),
    CONSTRAINT "rider_saved_places_lng_check" CHECK ((("lng" >= (30.55)::double precision) AND ("lng" <= (31.85)::double precision))),
    CONSTRAINT "rider_saved_places_place_type_check" CHECK (("place_type" = ANY (ARRAY['home'::"text", 'work'::"text"])))
);


ALTER TABLE "public"."rider_saved_places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "text" NOT NULL,
    "vehicle_type_id" "text" NOT NULL,
    "name_ar" "text" NOT NULL,
    "max_seats" integer NOT NULL,
    "ac_rule" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_categories_ac_rule_check" CHECK (("ac_rule" = ANY (ARRAY['none'::"text", 'required'::"text", 'optional'::"text"]))),
    CONSTRAINT "service_categories_id_check" CHECK (("lower"("id") <> 'elite'::"text")),
    CONSTRAINT "service_categories_max_seats_check" CHECK (("max_seats" > 0)),
    CONSTRAINT "service_categories_name_ar_check" CHECK (("lower"("name_ar") !~~ '%elite%'::"text"))
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "token_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


ALTER TABLE "public"."sessions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."super_admins" (
    "user_id" integer NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by_user_id" integer,
    "note" "text" DEFAULT 'Bootstrap super administrator'::"text" NOT NULL
);


ALTER TABLE "public"."super_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_password_reset_challenges" (
    "token_hash" "text" NOT NULL,
    "phone_hash" "text" NOT NULL,
    "telegram_user_id" bigint,
    "status" "text" DEFAULT 'waiting_start'::"text" NOT NULL,
    "code_hash" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    CONSTRAINT "telegram_password_reset_challenges_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 5))),
    CONSTRAINT "telegram_password_reset_challenges_code_hash_check" CHECK ((("code_hash" IS NULL) OR ("length"("code_hash") = 64))),
    CONSTRAINT "telegram_password_reset_challenges_phone_hash_check" CHECK (("length"("phone_hash") = 64)),
    CONSTRAINT "telegram_password_reset_challenges_status_check" CHECK (("status" = ANY (ARRAY['waiting_start'::"text", 'waiting_contact'::"text", 'code_sent'::"text", 'used'::"text", 'locked'::"text", 'expired'::"text"]))),
    CONSTRAINT "telegram_password_reset_challenges_token_hash_check" CHECK (("length"("token_hash") = 64))
);


ALTER TABLE "public"."telegram_password_reset_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_phone_verification_challenges" (
    "token_hash" "text" NOT NULL,
    "user_id" integer NOT NULL,
    "telegram_user_id" bigint,
    "status" "text" DEFAULT 'waiting_start'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "verified_at" timestamp with time zone,
    CONSTRAINT "telegram_phone_verification_challenges_status_check" CHECK (("status" = ANY (ARRAY['waiting_start'::"text", 'waiting_contact'::"text", 'verified'::"text", 'expired'::"text"]))),
    CONSTRAINT "telegram_phone_verification_challenges_token_hash_check" CHECK (("length"("token_hash") = 64))
);


ALTER TABLE "public"."telegram_phone_verification_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_stops" (
    "id" integer NOT NULL,
    "trip_id" integer NOT NULL,
    "sequence" integer NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "reached_at" timestamp with time zone,
    "fare_at_stop" double precision,
    "location_data_updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trip_stops_fare_at_stop_check" CHECK ((("fare_at_stop" IS NULL) OR ("fare_at_stop" >= (0)::double precision))),
    CONSTRAINT "trip_stops_lat_check" CHECK ((("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision))),
    CONSTRAINT "trip_stops_lng_check" CHECK ((("lng" >= ('-180'::integer)::double precision) AND ("lng" <= (180)::double precision))),
    CONSTRAINT "trip_stops_sequence_check" CHECK (("sequence" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."trip_stops" OWNER TO "postgres";


ALTER TABLE "public"."trip_stops" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."trip_stops_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" integer NOT NULL,
    "match_id" integer NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "total_distance_km" double precision,
    "total_amount" double precision,
    CONSTRAINT "trips_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "trips_total_amount_check" CHECK ((("total_amount" IS NULL) OR ("total_amount" >= (0)::double precision))),
    CONSTRAINT "trips_total_distance_km_check" CHECK ((("total_distance_km" IS NULL) OR ("total_distance_km" >= (0)::double precision)))
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


ALTER TABLE "public"."trips" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."trips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_location_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" integer NOT NULL,
    "normalized_query" "text" NOT NULL,
    "search_day" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_place_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "selected_place_id" "text",
    "selected_lat" double precision,
    "selected_lng" double precision,
    "details_calls" smallint DEFAULT 0 NOT NULL,
    "coordinates_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_location_searches_coordinate_pair" CHECK ((("selected_lat" IS NULL) = ("selected_lng" IS NULL))),
    CONSTRAINT "user_location_searches_details_calls_check" CHECK ((("details_calls" >= 0) AND ("details_calls" <= 5))),
    CONSTRAINT "user_location_searches_normalized_query_check" CHECK ((("char_length"("normalized_query") >= 3) AND ("char_length"("normalized_query") <= 160))),
    CONSTRAINT "user_location_searches_selected_place_valid" CHECK ((("selected_place_id" IS NULL) OR ("selected_place_id" = ANY ("provider_place_ids")))),
    CONSTRAINT "user_location_searches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'complete'::"text", 'failed'::"text"]))),
    CONSTRAINT "user_location_searches_suggestions_check" CHECK (("jsonb_typeof"("suggestions") = 'array'::"text"))
);


ALTER TABLE "public"."user_location_searches" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_location_searches" IS 'Per-user Google Places searches; normalized queries and Place IDs are retained to enforce duplicate prevention, while Google result labels and coordinates are purged after 30 days.';



ALTER TABLE "public"."user_verifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."user_verifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" NOT NULL,
    "verified_at" timestamp with time zone,
    "password_changed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "terms_accepted_at" timestamp with time zone,
    "terms_version" "text",
    "privacy_version" "text",
    "avatar_path" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "users_full_name_check" CHECK (("length"("btrim"("full_name")) > 0)),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['rider'::"text", 'captain'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vehicle_types" (
    "id" "text" NOT NULL,
    "name_ar" "text" NOT NULL,
    "capacity_max" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicle_types_capacity_max_check" CHECK (("capacity_max" > 0)),
    CONSTRAINT "vehicle_types_id_check" CHECK (("lower"("id") <> 'elite'::"text")),
    CONSTRAINT "vehicle_types_name_ar_check" CHECK (("lower"("name_ar") !~~ '%elite%'::"text"))
);


ALTER TABLE "public"."vehicle_types" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_deletion_events"
    ADD CONSTRAINT "account_deletion_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_ledger_adjustments"
    ADD CONSTRAINT "admin_ledger_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_system_settings"
    ADD CONSTRAINT "admin_system_settings_pkey" PRIMARY KEY ("setting_key");



ALTER TABLE ONLY "public"."admin_trip_actions"
    ADD CONSTRAINT "admin_trip_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_user_controls"
    ADD CONSTRAINT "admin_user_controls_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("config_key");



ALTER TABLE ONLY "public"."app_feature_flags"
    ADD CONSTRAINT "app_feature_flags_pkey" PRIMARY KEY ("flag_name");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."captain_lines"
    ADD CONSTRAINT "captain_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."captain_profiles"
    ADD CONSTRAINT "captain_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."captain_profiles"
    ADD CONSTRAINT "captain_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."commuter_board_campaigns"
    ADD CONSTRAINT "commuter_board_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_commute_requests"
    ADD CONSTRAINT "daily_commute_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demand_groups"
    ADD CONSTRAINT "demand_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demand_requests"
    ADD CONSTRAINT "demand_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demand_requests"
    ADD CONSTRAINT "demand_requests_rider_user_id_demand_group_id_key" UNIQUE ("rider_user_id", "demand_group_id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_maps_api_usage"
    ADD CONSTRAINT "google_maps_api_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_daily_commute_request_id_key" UNIQUE ("daily_commute_request_id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_conversations"
    ADD CONSTRAINT "message_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_conversations"
    ADD CONSTRAINT "message_conversations_unique_pair" UNIQUE ("participant_low_id", "participant_high_id");



ALTER TABLE ONLY "public"."otp_challenges"
    ADD CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_status_events"
    ADD CONSTRAINT "payment_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_trip_id_key" UNIQUE ("trip_id");



ALTER TABLE ONLY "public"."policy_acceptances"
    ADD CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_captain_capabilities"
    ADD CONSTRAINT "pool_captain_capabilities_pkey" PRIMARY KEY ("captain_user_id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_trip_id_key" UNIQUE ("trip_id");



ALTER TABLE ONLY "public"."pool_captain_escrows"
    ADD CONSTRAINT "pool_captain_escrows_group_id_key" UNIQUE ("group_id");



ALTER TABLE ONLY "public"."pool_captain_escrows"
    ADD CONSTRAINT "pool_captain_escrows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_captain_stats"
    ADD CONSTRAINT "pool_captain_stats_pkey" PRIMARY KEY ("captain_user_id");



ALTER TABLE ONLY "public"."pool_categories"
    ADD CONSTRAINT "pool_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_groups"
    ADD CONSTRAINT "pool_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_ledger"
    ADD CONSTRAINT "pool_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_ledger"
    ADD CONSTRAINT "pool_ledger_trip_id_member_id_key" UNIQUE ("trip_id", "member_id");



ALTER TABLE ONLY "public"."pool_members"
    ADD CONSTRAINT "pool_members_group_id_rider_user_id_key" UNIQUE ("group_id", "rider_user_id");



ALTER TABLE ONLY "public"."pool_members"
    ADD CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_notification_mutes"
    ADD CONSTRAINT "pool_notification_mutes_pkey" PRIMARY KEY ("user_id", "group_id");



ALTER TABLE ONLY "public"."pool_notifications"
    ADD CONSTRAINT "pool_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_notifications"
    ADD CONSTRAINT "pool_notifications_user_id_event_key_key" UNIQUE ("user_id", "event_key");



ALTER TABLE ONLY "public"."pool_subscriptions"
    ADD CONSTRAINT "pool_subscriptions_member_id_key" UNIQUE ("member_id");



ALTER TABLE ONLY "public"."pool_subscriptions"
    ADD CONSTRAINT "pool_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_trip_cancellations"
    ADD CONSTRAINT "pool_trip_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_trip_cancellations"
    ADD CONSTRAINT "pool_trip_cancellations_trip_id_member_id_key" UNIQUE ("trip_id", "member_id");



ALTER TABLE ONLY "public"."pool_trip_stops"
    ADD CONSTRAINT "pool_trip_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pool_trip_stops"
    ADD CONSTRAINT "pool_trip_stops_trip_id_member_id_stop_type_key" UNIQUE ("trip_id", "member_id", "stop_type");



ALTER TABLE ONLY "public"."pool_trip_stops"
    ADD CONSTRAINT "pool_trip_stops_trip_id_sequence_key" UNIQUE ("trip_id", "sequence");



ALTER TABLE ONLY "public"."pool_trips"
    ADD CONSTRAINT "pool_trips_group_id_service_date_direction_key" UNIQUE ("group_id", "service_date", "direction");



ALTER TABLE ONLY "public"."pool_trips"
    ADD CONSTRAINT "pool_trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_config"
    ADD CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("vehicle_type_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rider_commuter_preferences"
    ADD CONSTRAINT "rider_commuter_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."rider_preferred_routes"
    ADD CONSTRAINT "rider_preferred_routes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."rider_saved_places"
    ADD CONSTRAINT "rider_saved_places_pkey" PRIMARY KEY ("user_id", "place_type");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."telegram_password_reset_challenges"
    ADD CONSTRAINT "telegram_password_reset_challenges_pkey" PRIMARY KEY ("token_hash");



ALTER TABLE ONLY "public"."telegram_phone_verification_challenges"
    ADD CONSTRAINT "telegram_phone_verification_challenges_pkey" PRIMARY KEY ("token_hash");



ALTER TABLE ONLY "public"."trip_stops"
    ADD CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_stops"
    ADD CONSTRAINT "trip_stops_trip_id_sequence_key" UNIQUE ("trip_id", "sequence");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_match_id_key" UNIQUE ("match_id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_location_searches"
    ADD CONSTRAINT "user_location_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_location_searches"
    ADD CONSTRAINT "user_location_searches_unique_query" UNIQUE ("user_id", "normalized_query");



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_user_id_document_type_key" UNIQUE ("user_id", "document_type");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id");



CREATE INDEX "account_deletion_events_actor_idx" ON "public"."account_deletion_events" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "account_deletion_events_target_idx" ON "public"."account_deletion_events" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "admin_audit_logs_actor_idx" ON "public"."admin_audit_logs" USING "btree" ("actor_user_id");



CREATE INDEX "admin_audit_logs_created_idx" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "admin_audit_logs_resource_idx" ON "public"."admin_audit_logs" USING "btree" ("resource_type", "resource_id", "created_at" DESC);



CREATE INDEX "admin_ledger_adjustments_actor_idx" ON "public"."admin_ledger_adjustments" USING "btree" ("actor_user_id");



CREATE INDEX "admin_ledger_adjustments_member_idx" ON "public"."admin_ledger_adjustments" USING "btree" ("member_id") WHERE ("member_id" IS NOT NULL);



CREATE INDEX "admin_ledger_adjustments_trip_idx" ON "public"."admin_ledger_adjustments" USING "btree" ("trip_kind", "trip_id", "created_at" DESC);



CREATE INDEX "admin_system_settings_updated_by_idx" ON "public"."admin_system_settings" USING "btree" ("updated_by_user_id");



CREATE INDEX "admin_trip_actions_actor_idx" ON "public"."admin_trip_actions" USING "btree" ("actor_user_id");



CREATE INDEX "admin_trip_actions_trip_idx" ON "public"."admin_trip_actions" USING "btree" ("trip_kind", "trip_id", "created_at" DESC);



CREATE INDEX "admin_user_controls_updated_by_idx" ON "public"."admin_user_controls" USING "btree" ("updated_by_user_id");



CREATE INDEX "audit_log_actor_user_id_idx" ON "public"."audit_log" USING "btree" ("actor_user_id");



CREATE INDEX "audit_log_created_idx" ON "public"."audit_log" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "audit_log_resource_idx" ON "public"."audit_log" USING "btree" ("resource_type", "resource_id", "created_at" DESC);



CREATE INDEX "captain_lines_captain_idx" ON "public"."captain_lines" USING "btree" ("captain_user_id", "created_at" DESC);



CREATE INDEX "captain_lines_search_idx" ON "public"."captain_lines" USING "btree" ("vehicle_type_id", "status", "arrival_time");



CREATE INDEX "commuter_board_campaigns_active_window_idx" ON "public"."commuter_board_campaigns" USING "btree" ("active", "priority" DESC, "start_date", "end_date");



CREATE INDEX "commuter_board_campaigns_created_by_admin_idx" ON "public"."commuter_board_campaigns" USING "btree" ("created_by_admin");



CREATE INDEX "demand_groups_captain_line_idx" ON "public"."demand_groups" USING "btree" ("captain_line_id") WHERE ("captain_line_id" IS NOT NULL);



CREATE INDEX "demand_groups_match_idx" ON "public"."demand_groups" USING "btree" ("vehicle_type_id", "trip_date", "arrival_time") WHERE ("status" = 'open'::"text");



CREATE INDEX "demand_groups_return_match_idx" ON "public"."demand_groups" USING "btree" ("vehicle_type_id", "trip_date", "return_arrival_time") WHERE (("status" = 'open'::"text") AND ("return_arrival_time" IS NOT NULL));



CREATE INDEX "demand_requests_group_idx" ON "public"."demand_requests" USING "btree" ("demand_group_id", "status");



CREATE INDEX "demand_requests_rider_idx" ON "public"."demand_requests" USING "btree" ("rider_user_id", "created_at" DESC);



CREATE INDEX "demand_requests_vehicle_type_idx" ON "public"."demand_requests" USING "btree" ("vehicle_type_id");



CREATE INDEX "direct_messages_sender_user_id_idx" ON "public"."direct_messages" USING "btree" ("sender_user_id");



CREATE INDEX "google_maps_api_usage_created_at_idx" ON "public"."google_maps_api_usage" USING "btree" ("created_at");



CREATE INDEX "idx_app_feature_flags_updated_by_user_id" ON "public"."app_feature_flags" USING "btree" ("updated_by_user_id");



CREATE INDEX "idx_captain_profiles_user_id" ON "public"."captain_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_captain_profiles_vehicle_type" ON "public"."captain_profiles" USING "btree" ("vehicle_type_id");



CREATE INDEX "idx_daily_commute_requests_rider_user_id" ON "public"."daily_commute_requests" USING "btree" ("rider_user_id");



CREATE INDEX "idx_daily_commute_requests_status" ON "public"."daily_commute_requests" USING "btree" ("status");



CREATE INDEX "idx_daily_requests_category" ON "public"."daily_commute_requests" USING "btree" ("service_category_id");



CREATE INDEX "idx_direct_messages_history" ON "public"."direct_messages" USING "btree" ("conversation_id", "id" DESC);



CREATE INDEX "idx_direct_messages_unread" ON "public"."direct_messages" USING "btree" ("conversation_id", "sender_user_id") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_escrow_transfers_escrow" ON "public"."pool_captain_escrow_transfers" USING "btree" ("escrow_id");



CREATE INDEX "idx_escrow_transfers_original_captain" ON "public"."pool_captain_escrow_transfers" USING "btree" ("original_captain_user_id");



CREATE INDEX "idx_escrows_original_captain" ON "public"."pool_captain_escrows" USING "btree" ("original_captain_user_id");



CREATE INDEX "idx_matches_captain_user_id" ON "public"."matches" USING "btree" ("captain_user_id");



CREATE INDEX "idx_message_conversations_high_recent" ON "public"."message_conversations" USING "btree" ("participant_high_id", "last_message_at" DESC NULLS LAST, "id" DESC);



CREATE INDEX "idx_message_conversations_low_recent" ON "public"."message_conversations" USING "btree" ("participant_low_id", "last_message_at" DESC NULLS LAST, "id" DESC);



CREATE INDEX "idx_otp_challenges_user_id" ON "public"."otp_challenges" USING "btree" ("user_id");



CREATE INDEX "idx_payment_events_actor" ON "public"."payment_status_events" USING "btree" ("actor_user_id");



CREATE INDEX "idx_payment_status_events_payment_id" ON "public"."payment_status_events" USING "btree" ("payment_id");



CREATE INDEX "idx_payments_reporter" ON "public"."payments" USING "btree" ("reported_by_user_id");



CREATE INDEX "idx_pool_cancellations_member" ON "public"."pool_trip_cancellations" USING "btree" ("member_id");



CREATE INDEX "idx_pool_escrow_transfers_replacement" ON "public"."pool_captain_escrow_transfers" USING "btree" ("replacement_captain_user_id", "transfer_status");



CREATE INDEX "idx_pool_escrows_status" ON "public"."pool_captain_escrows" USING "btree" ("status", "group_id");



CREATE INDEX "idx_pool_groups_category" ON "public"."pool_groups" USING "btree" ("category_id");



CREATE INDEX "idx_pool_groups_creator" ON "public"."pool_groups" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_pool_groups_fixed_captain" ON "public"."pool_groups" USING "btree" ("fixed_captain_user_id");



CREATE INDEX "idx_pool_ledger_member" ON "public"."pool_ledger" USING "btree" ("member_id");



CREATE INDEX "idx_pool_members_group_status" ON "public"."pool_members" USING "btree" ("group_id", "status");



CREATE INDEX "idx_pool_members_rider" ON "public"."pool_members" USING "btree" ("rider_user_id", "status");



CREATE INDEX "idx_pool_notifications_group" ON "public"."pool_notifications" USING "btree" ("group_id");



CREATE INDEX "idx_pool_notifications_user" ON "public"."pool_notifications" USING "btree" ("user_id", "read_at", "id");



CREATE INDEX "idx_pool_notifications_visible" ON "public"."pool_notifications" USING "btree" ("user_id", "deleted_at", "created_at" DESC);



CREATE INDEX "idx_pool_stops_member" ON "public"."pool_trip_stops" USING "btree" ("member_id");



CREATE INDEX "idx_pool_subscriptions_group" ON "public"."pool_subscriptions" USING "btree" ("group_id");



CREATE INDEX "idx_pool_trips_captain_time" ON "public"."pool_trips" USING "btree" ("captain_user_id", "departure_at", "status");



CREATE INDEX "idx_pool_trips_status_time" ON "public"."pool_trips" USING "btree" ("status", "departure_at");



CREATE INDEX "idx_push_subscriptions_user" ON "public"."push_subscriptions" USING "btree" ("user_id", "id");



CREATE INDEX "idx_service_categories_vehicle_type" ON "public"."service_categories" USING "btree" ("vehicle_type_id");



CREATE INDEX "idx_sessions_token_hash" ON "public"."sessions" USING "btree" ("token_hash");



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_trip_stops_trip_id" ON "public"."trip_stops" USING "btree" ("trip_id");



CREATE INDEX "idx_user_verifications_review_queue" ON "public"."user_verifications" USING "btree" ("status", "uploaded_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_user_verifications_reviewed_by" ON "public"."user_verifications" USING "btree" ("reviewed_by");



CREATE INDEX "message_conversations_last_message_sender_id_idx" ON "public"."message_conversations" USING "btree" ("last_message_sender_id");



CREATE INDEX "policy_acceptances_user_history_idx" ON "public"."policy_acceptances" USING "btree" ("user_id", "accepted_at" DESC, "id" DESC);



CREATE INDEX "pool_notification_mutes_group_id_idx" ON "public"."pool_notification_mutes" USING "btree" ("group_id");



CREATE INDEX "pool_notifications_actor_id_idx" ON "public"."pool_notifications" USING "btree" ("actor_id");



CREATE INDEX "super_admins_granted_by_idx" ON "public"."super_admins" USING "btree" ("granted_by_user_id") WHERE ("granted_by_user_id" IS NOT NULL);



CREATE INDEX "telegram_password_reset_phone_idx" ON "public"."telegram_password_reset_challenges" USING "btree" ("phone_hash", "created_at" DESC);



CREATE INDEX "telegram_password_reset_telegram_idx" ON "public"."telegram_password_reset_challenges" USING "btree" ("telegram_user_id", "created_at" DESC) WHERE ("status" = 'waiting_contact'::"text");



CREATE INDEX "telegram_phone_verification_user_idx" ON "public"."telegram_phone_verification_challenges" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "user_location_searches_user_day_idx" ON "public"."user_location_searches" USING "btree" ("user_id", "search_day");



CREATE UNIQUE INDEX "user_verifications_object_path_key" ON "public"."user_verifications" USING "btree" ("object_path");



CREATE INDEX "user_verifications_review_queue_idx" ON "public"."user_verifications" USING "btree" ("status", "uploaded_at" DESC);



CREATE INDEX "user_verifications_user_status_idx" ON "public"."user_verifications" USING "btree" ("user_id", "status");



CREATE INDEX "users_active_created_idx" ON "public"."users" USING "btree" ("created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE OR REPLACE TRIGGER "admin_audit_no_change" BEFORE DELETE OR UPDATE ON "public"."admin_audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_append_only"();



CREATE OR REPLACE TRIGGER "admin_ledger_adjustments_no_change" BEFORE DELETE OR UPDATE ON "public"."admin_ledger_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_append_only"();



CREATE OR REPLACE TRIGGER "admin_trip_actions_no_change" BEFORE DELETE OR UPDATE ON "public"."admin_trip_actions" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_append_only"();



CREATE OR REPLACE TRIGGER "audit_captain_lines_lifecycle" AFTER INSERT OR UPDATE OF "status" ON "public"."captain_lines" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_capture_lifecycle_audit"();



CREATE OR REPLACE TRIGGER "audit_demand_groups_lifecycle" AFTER INSERT OR UPDATE OF "status", "captain_line_id" ON "public"."demand_groups" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_capture_lifecycle_audit"();



CREATE OR REPLACE TRIGGER "audit_demand_requests_lifecycle" AFTER INSERT OR UPDATE OF "status", "demand_group_id" ON "public"."demand_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_capture_lifecycle_audit"();



CREATE OR REPLACE TRIGGER "audit_log_no_change" BEFORE DELETE OR UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_audit_log_append_only"();



CREATE OR REPLACE TRIGGER "pool_groups_track_route_geometry_age" BEFORE INSERT OR UPDATE OF "route_geometry" ON "public"."pool_groups" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_track_route_geometry_age"();



CREATE OR REPLACE TRIGGER "trg_captain_line_match" AFTER INSERT OR UPDATE OF "status", "arrival_time", "return_arrival_time" ON "public"."captain_lines" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_match_after_line_publish"();



CREATE OR REPLACE TRIGGER "trg_captain_line_pricing" BEFORE INSERT OR UPDATE OF "vehicle_type_id", "seats", "route_distance_km", "price_per_km", "price_per_seat" ON "public"."captain_lines" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_captain_line_pricing"();



CREATE OR REPLACE TRIGGER "trg_captain_profiles_role" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."captain_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('user_id', 'captain');



CREATE OR REPLACE TRIGGER "trg_captain_verification_noop" BEFORE UPDATE OF "verification_status" ON "public"."captain_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_captain_verification_noop"();



CREATE OR REPLACE TRIGGER "trg_daily_requests_role" BEFORE INSERT OR UPDATE OF "rider_user_id" ON "public"."daily_commute_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('rider_user_id', 'rider');



CREATE OR REPLACE TRIGGER "trg_demand_requests_cluster" BEFORE INSERT ON "public"."demand_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_cluster_demand_request"();



CREATE OR REPLACE TRIGGER "trg_demand_requests_match" AFTER INSERT ON "public"."demand_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_match_after_demand_insert"();



CREATE OR REPLACE TRIGGER "trg_demand_requests_rider_role" BEFORE INSERT OR UPDATE OF "rider_user_id" ON "public"."demand_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('rider_user_id', 'rider');



CREATE OR REPLACE TRIGGER "trg_escrow_transfers_no_update" BEFORE DELETE OR UPDATE ON "public"."pool_captain_escrow_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_append_only"();



CREATE OR REPLACE TRIGGER "trg_match_guard" BEFORE INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_match_guard"();



CREATE OR REPLACE TRIGGER "trg_matches_captain_role" BEFORE INSERT OR UPDATE OF "captain_user_id" ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('captain_user_id', 'captain');



CREATE OR REPLACE TRIGGER "trg_matches_create_trip" AFTER INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_match_creates_trip"();



CREATE OR REPLACE TRIGGER "trg_payment_event_guard" BEFORE INSERT ON "public"."payment_status_events" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_payment_guard"();



CREATE OR REPLACE TRIGGER "trg_payment_events_no_update" BEFORE DELETE OR UPDATE ON "public"."payment_status_events" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_append_only"();



CREATE OR REPLACE TRIGGER "trg_payment_trip_guard" BEFORE INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_payment_guard"();



CREATE OR REPLACE TRIGGER "trg_payments_no_update" BEFORE DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_append_only"();



CREATE OR REPLACE TRIGGER "trg_pool_group_creator_role" BEFORE INSERT OR UPDATE OF "created_by_user_id" ON "public"."pool_groups" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('created_by_user_id', 'rider,captain');



CREATE OR REPLACE TRIGGER "trg_pool_ledger_no_update" BEFORE DELETE OR UPDATE ON "public"."pool_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_append_only"();



CREATE OR REPLACE TRIGGER "trg_pool_member_rider_role" BEFORE INSERT OR UPDATE OF "rider_user_id" ON "public"."pool_members" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_require_role"('rider_user_id', 'rider');



CREATE OR REPLACE TRIGGER "trg_pool_trip_captain_role" BEFORE INSERT OR UPDATE OF "captain_user_id" ON "public"."pool_trips" FOR EACH ROW WHEN (("new"."captain_user_id" IS NOT NULL)) EXECUTE FUNCTION "public"."sekka_require_role"('captain_user_id', 'captain');



CREATE OR REPLACE TRIGGER "trg_service_category_capacity" BEFORE INSERT OR UPDATE ON "public"."service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_validate_vehicle_capacity"();



CREATE OR REPLACE TRIGGER "trg_trip_complete_guard" BEFORE UPDATE OF "status" ON "public"."trips" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_trip_complete_guard"();



CREATE OR REPLACE TRIGGER "trg_trip_stop_order" BEFORE UPDATE OF "reached_at" ON "public"."trip_stops" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_trip_stop_order"();



CREATE OR REPLACE TRIGGER "trg_vehicle_capacity_update" BEFORE UPDATE OF "capacity_max" ON "public"."vehicle_types" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_validate_vehicle_capacity"();



CREATE OR REPLACE TRIGGER "users_sync_captain_verification_after_phone" AFTER UPDATE OF "verified_at" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sekka_sync_captain_verification_after_phone"();



ALTER TABLE ONLY "public"."account_deletion_events"
    ADD CONSTRAINT "account_deletion_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."account_deletion_events"
    ADD CONSTRAINT "account_deletion_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_ledger_adjustments"
    ADD CONSTRAINT "admin_ledger_adjustments_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_ledger_adjustments"
    ADD CONSTRAINT "admin_ledger_adjustments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."pool_members"("id");



ALTER TABLE ONLY "public"."admin_system_settings"
    ADD CONSTRAINT "admin_system_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_trip_actions"
    ADD CONSTRAINT "admin_trip_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_user_controls"
    ADD CONSTRAINT "admin_user_controls_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_user_controls"
    ADD CONSTRAINT "admin_user_controls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."app_feature_flags"
    ADD CONSTRAINT "app_feature_flags_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."captain_lines"
    ADD CONSTRAINT "captain_lines_captain_user_id_fkey" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."captain_lines"
    ADD CONSTRAINT "captain_lines_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."captain_profiles"
    ADD CONSTRAINT "captain_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."captain_profiles"
    ADD CONSTRAINT "captain_profiles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."commuter_board_campaigns"
    ADD CONSTRAINT "commuter_board_campaigns_created_by_admin_fkey" FOREIGN KEY ("created_by_admin") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_commute_requests"
    ADD CONSTRAINT "daily_commute_requests_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_commute_requests"
    ADD CONSTRAINT "daily_commute_requests_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id");



ALTER TABLE ONLY "public"."demand_groups"
    ADD CONSTRAINT "demand_groups_captain_line_id_fkey" FOREIGN KEY ("captain_line_id") REFERENCES "public"."captain_lines"("id");



ALTER TABLE ONLY "public"."demand_groups"
    ADD CONSTRAINT "demand_groups_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."demand_requests"
    ADD CONSTRAINT "demand_requests_demand_group_id_fkey" FOREIGN KEY ("demand_group_id") REFERENCES "public"."demand_groups"("id");



ALTER TABLE ONLY "public"."demand_requests"
    ADD CONSTRAINT "demand_requests_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."demand_requests"
    ADD CONSTRAINT "demand_requests_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."message_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_captain_user_id_fkey" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_daily_commute_request_id_fkey" FOREIGN KEY ("daily_commute_request_id") REFERENCES "public"."daily_commute_requests"("id");



ALTER TABLE ONLY "public"."message_conversations"
    ADD CONSTRAINT "message_conversations_last_message_sender_id_fkey" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_conversations"
    ADD CONSTRAINT "message_conversations_participant_high_id_fkey" FOREIGN KEY ("participant_high_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_conversations"
    ADD CONSTRAINT "message_conversations_participant_low_id_fkey" FOREIGN KEY ("participant_low_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otp_challenges"
    ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_status_events"
    ADD CONSTRAINT "payment_status_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payment_status_events"
    ADD CONSTRAINT "payment_status_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id");



ALTER TABLE ONLY "public"."policy_acceptances"
    ADD CONSTRAINT "policy_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pool_captain_capabilities"
    ADD CONSTRAINT "pool_captain_capabilities_captain_user_id_fkey" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "public"."pool_captain_escrows"("id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_original_captain_user_id_fkey" FOREIGN KEY ("original_captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_replacement_captain_user_id_fkey" FOREIGN KEY ("replacement_captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_captain_escrow_transfers"
    ADD CONSTRAINT "pool_captain_escrow_transfers_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."pool_trips"("id");



ALTER TABLE ONLY "public"."pool_captain_escrows"
    ADD CONSTRAINT "pool_captain_escrows_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id");



ALTER TABLE ONLY "public"."pool_captain_escrows"
    ADD CONSTRAINT "pool_captain_escrows_original_captain_user_id_fkey" FOREIGN KEY ("original_captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_captain_stats"
    ADD CONSTRAINT "pool_captain_stats_captain_user_id_fkey" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_groups"
    ADD CONSTRAINT "pool_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."pool_categories"("id");



ALTER TABLE ONLY "public"."pool_groups"
    ADD CONSTRAINT "pool_groups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_groups"
    ADD CONSTRAINT "pool_groups_fixed_captain_user_id_fkey" FOREIGN KEY ("fixed_captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_ledger"
    ADD CONSTRAINT "pool_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."pool_members"("id");



ALTER TABLE ONLY "public"."pool_ledger"
    ADD CONSTRAINT "pool_ledger_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."pool_trips"("id");



ALTER TABLE ONLY "public"."pool_members"
    ADD CONSTRAINT "pool_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id");



ALTER TABLE ONLY "public"."pool_members"
    ADD CONSTRAINT "pool_members_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_notification_mutes"
    ADD CONSTRAINT "pool_notification_mutes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pool_notification_mutes"
    ADD CONSTRAINT "pool_notification_mutes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pool_notifications"
    ADD CONSTRAINT "pool_notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_notifications"
    ADD CONSTRAINT "pool_notifications_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id");



ALTER TABLE ONLY "public"."pool_notifications"
    ADD CONSTRAINT "pool_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_subscriptions"
    ADD CONSTRAINT "pool_subscriptions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id");



ALTER TABLE ONLY "public"."pool_subscriptions"
    ADD CONSTRAINT "pool_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."pool_members"("id");



ALTER TABLE ONLY "public"."pool_trip_cancellations"
    ADD CONSTRAINT "pool_trip_cancellations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."pool_members"("id");



ALTER TABLE ONLY "public"."pool_trip_cancellations"
    ADD CONSTRAINT "pool_trip_cancellations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."pool_trips"("id");



ALTER TABLE ONLY "public"."pool_trip_stops"
    ADD CONSTRAINT "pool_trip_stops_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."pool_members"("id");



ALTER TABLE ONLY "public"."pool_trip_stops"
    ADD CONSTRAINT "pool_trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."pool_trips"("id");



ALTER TABLE ONLY "public"."pool_trips"
    ADD CONSTRAINT "pool_trips_captain_user_id_fkey" FOREIGN KEY ("captain_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pool_trips"
    ADD CONSTRAINT "pool_trips_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pool_groups"("id");



ALTER TABLE ONLY "public"."pricing_config"
    ADD CONSTRAINT "pricing_config_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rider_commuter_preferences"
    ADD CONSTRAINT "rider_commuter_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rider_preferred_routes"
    ADD CONSTRAINT "rider_preferred_routes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rider_saved_places"
    ADD CONSTRAINT "rider_saved_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."telegram_phone_verification_challenges"
    ADD CONSTRAINT "telegram_phone_verification_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_stops"
    ADD CONSTRAINT "trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."user_location_searches"
    ADD CONSTRAINT "user_location_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."account_deletion_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_audit_logs_deny_client_access" ON "public"."admin_audit_logs" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."admin_ledger_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_ledger_adjustments_deny_client_access" ON "public"."admin_ledger_adjustments" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."admin_system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_system_settings_deny_client_access" ON "public"."admin_system_settings" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."admin_trip_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_trip_actions_deny_client_access" ON "public"."admin_trip_actions" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."admin_user_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_user_controls_deny_client_access" ON "public"."admin_user_controls" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."api_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_feature_flags_service_role_all" ON "public"."app_feature_flags" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_deny_client_access" ON "public"."audit_log" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."captain_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."captain_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commuter_board_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_commute_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demand_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demand_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_maps_api_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otp_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_acceptances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "policy_acceptances_deny_client_access" ON "public"."policy_acceptances" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."pool_captain_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_captain_escrow_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_captain_escrows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_captain_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_notification_mutes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_trip_cancellations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_trip_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pool_trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rider_commuter_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rider_preferred_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rider_saved_places" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sekka_backend_only" ON "public"."api_rate_limits" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."captain_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."daily_commute_requests" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."matches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."otp_challenges" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."payment_status_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."payments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_captain_capabilities" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_captain_escrow_transfers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_captain_escrows" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_captain_stats" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_categories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_groups" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_ledger" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_members" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_notifications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_trip_cancellations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_trip_stops" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pool_trips" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."pricing_config" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."push_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."service_categories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."trip_stops" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."trips" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sekka_backend_only" ON "public"."vehicle_types" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."super_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admins_deny_client_access" ON "public"."super_admins" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."telegram_password_reset_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "telegram_password_reset_deny_client_access" ON "public"."telegram_password_reset_challenges" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "telegram_phone_challenges_deny_client_access" ON "public"."telegram_phone_verification_challenges" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."telegram_phone_verification_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trip_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_location_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_verifications_deny_client_access" ON "public"."user_verifications" AS RESTRICTIVE TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_types" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."admin_ledger_adjustments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_add_ledger_adjustment"("p_actor_user_id" integer, "p_trip_kind" "text", "p_trip_id" integer, "p_member_id" integer, "p_amount" numeric, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_add_ledger_adjustment"("p_actor_user_id" integer, "p_trip_kind" "text", "p_trip_id" integer, "p_member_id" integer, "p_amount" numeric, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_audit_append_only"() FROM PUBLIC;



GRANT ALL ON TABLE "public"."user_verifications" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_review_user_verification"("p_actor_user_id" integer, "p_verification_id" bigint, "p_status" "text", "p_rejection_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_review_user_verification"("p_actor_user_id" integer, "p_verification_id" bigint, "p_status" "text", "p_rejection_reason" "text") TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."admin_system_settings" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_commission_rate"("p_actor_user_id" integer, "p_rate" numeric, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_commission_rate"("p_actor_user_id" integer, "p_rate" numeric, "p_reason" "text") TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."admin_user_controls" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_user_status"("p_actor_user_id" integer, "p_target_user_id" integer, "p_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_status"("p_actor_user_id" integer, "p_target_user_id" integer, "p_status" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_write_audit"("p_actor_user_id" integer, "p_action" "text", "p_resource_type" "text", "p_resource_id" "text", "p_reason" "text", "p_before" "jsonb", "p_after" "jsonb", "p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_write_audit"("p_actor_user_id" integer, "p_action" "text", "p_resource_type" "text", "p_resource_id" "text", "p_reason" "text", "p_before" "jsonb", "p_after" "jsonb", "p_request_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_trip_payment"("actor_id" integer, "trip_id" integer, "actual_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_trip_payment"("actor_id" integer, "trip_id" integer, "actual_amount" numeric) TO "service_role";



GRANT ALL ON TABLE "public"."demand_requests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_demand_request"("actor_id" integer, "vehicle_id" "text", "trip_on" "date", "arrives" time without time zone, "pickup_name" "text", "pickup_y" double precision, "pickup_x" double precision, "dropoff_name" "text", "dropoff_y" double precision, "dropoff_x" double precision, "seat_count" integer, "return_arrives" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_demand_request"("actor_id" integer, "vehicle_id" "text", "trip_on" "date", "arrives" time without time zone, "pickup_name" "text", "pickup_y" double precision, "pickup_x" double precision, "dropoff_name" "text", "dropoff_y" double precision, "dropoff_x" double precision, "seat_count" integer, "return_arrives" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."direct_message_contact_ids"("p_user_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."direct_message_contact_ids"("p_user_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_captain_line_pricing"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_captain_line_pricing"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_direct_messages_read"("p_user_id" integer, "p_conversation_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_direct_messages_read"("p_user_id" integer, "p_conversation_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."captain_lines" TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "methods" "text"[], "return_arrives" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "methods" "text"[], "return_arrives" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_captain_line"("actor_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[], "return_arrives" time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_append_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_append_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_append_only"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_audit_log_append_only"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sekka_begin_location_search"("p_user_id" integer, "p_normalized_query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_begin_location_search"("p_user_id" integer, "p_normalized_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_captain_verification_noop"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_captain_verification_noop"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_captain_verification_noop"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_capture_lifecycle_audit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sekka_claim_location_resolution"("p_user_id" integer, "p_search_id" "uuid", "p_place_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_claim_location_resolution"("p_user_id" integer, "p_search_id" "uuid", "p_place_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_cluster_demand_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_cluster_demand_request"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_delete_account_v1"("p_actor_user_id" integer, "p_target_user_id" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_delete_account_v1"("p_actor_user_id" integer, "p_target_user_id" integer, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_geo_km"("lat_a" double precision, "lng_a" double precision, "lat_b" double precision, "lng_b" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_geo_km"("lat_a" double precision, "lng_a" double precision, "lat_b" double precision, "lng_b" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_geo_km"("lat_a" double precision, "lng_a" double precision, "lat_b" double precision, "lng_b" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_is_super_admin"("p_user_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_is_super_admin"("p_user_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_match_after_demand_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_match_after_demand_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_match_after_line_publish"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_match_after_line_publish"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_match_creates_trip"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_match_creates_trip"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_match_creates_trip"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_match_demand_group"("group_id" integer) FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."sekka_match_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_match_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_match_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_payment_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_payment_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_payment_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_process_pool_deadlines"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sekka_purge_expired_location_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_purge_expired_location_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_register_with_policy_acceptance_v1"("p_full_name" "text", "p_phone_number" "text", "p_password_hash" "text", "p_role" "text", "p_policy_locale" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_register_with_policy_acceptance_v1"("p_full_name" "text", "p_phone_number" "text", "p_password_hash" "text", "p_role" "text", "p_policy_locale" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_require_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_require_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_require_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_require_super_admin"("p_actor_user_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_require_super_admin"("p_actor_user_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_reserve_google_maps_request"("p_service" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_reserve_google_maps_request"("p_service" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sekka_suspend_captains_with_expired_document_grace"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sekka_sync_captain_verification_after_phone"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sekka_take_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sekka_take_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_track_route_geometry_age"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_track_route_geometry_age"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_track_route_geometry_age"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_trip_complete_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_trip_complete_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_trip_complete_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_trip_stop_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_trip_stop_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_trip_stop_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sekka_validate_vehicle_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."sekka_validate_vehicle_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sekka_validate_vehicle_capacity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_direct_message"("p_sender_user_id" integer, "p_conversation_id" bigint, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_direct_message"("p_sender_user_id" integer, "p_conversation_id" bigint, "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_captain_line_status"("actor_id" integer, "line_id" integer, "next_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_captain_line_status"("actor_id" integer, "line_id" integer, "next_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_captain_line"("actor_id" integer, "line_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "return_arrives" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_captain_line"("actor_id" integer, "line_id" integer, "vehicle_id" "text", "origin_name" "text", "origin_y" double precision, "origin_x" double precision, "destination_name" "text", "destination_y" double precision, "destination_x" double precision, "stops" "jsonb", "arrival" time without time zone, "return_arrives" time without time zone, "days" smallint[], "seat_count" integer, "route_km" double precision, "seat_price" numeric, "methods" "text"[]) TO "service_role";



GRANT SELECT ON TABLE "public"."account_deletion_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."account_deletion_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."account_deletion_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."account_deletion_events_id_seq" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_logs_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_ledger_adjustments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_ledger_adjustments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_ledger_adjustments_id_seq" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."admin_trip_actions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_trip_actions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_trip_actions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_trip_actions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."api_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."app_feature_flags" TO "service_role";



GRANT SELECT ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."captain_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."captain_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."captain_lines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."captain_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."captain_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."captain_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."captain_profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."commuter_board_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."daily_commute_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_commute_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_commute_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_commute_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."demand_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."demand_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."demand_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."demand_groups_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."demand_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."demand_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."demand_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."direct_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."direct_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."direct_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."google_maps_api_usage" TO "service_role";



GRANT ALL ON SEQUENCE "public"."google_maps_api_usage_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."google_maps_api_usage_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."google_maps_api_usage_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."message_conversations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."message_conversations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."message_conversations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."message_conversations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."otp_challenges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."otp_challenges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."otp_challenges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."otp_challenges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payment_status_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payment_status_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payment_status_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payment_status_events_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."policy_acceptances" TO "service_role";



GRANT ALL ON TABLE "public"."pool_captain_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."pool_captain_escrow_transfers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_captain_escrow_transfers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_captain_escrow_transfers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_captain_escrow_transfers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_captain_escrows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_captain_escrows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_captain_escrows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_captain_escrows_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_captain_stats" TO "service_role";



GRANT ALL ON TABLE "public"."pool_categories" TO "service_role";



GRANT ALL ON TABLE "public"."pool_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_notification_mutes" TO "service_role";



GRANT ALL ON TABLE "public"."pool_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_trip_cancellations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_trip_cancellations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_trip_cancellations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_trip_cancellations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_trip_stops" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_trip_stops_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_trip_stops_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_trip_stops_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pool_trips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pool_trips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pool_trips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pool_trips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_config" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rider_commuter_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."rider_preferred_routes" TO "service_role";



GRANT ALL ON TABLE "public"."rider_saved_places" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."super_admins" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_password_reset_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_phone_verification_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."trip_stops" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trip_stops_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trip_stops_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trip_stops_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_location_searches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_verifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_verifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_verifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_types" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







