-- seKKa owner decisions Nov 17: captain form quality, ordinary plates and private upload repair.
-- STAGING ONLY; no existing users, drafts, documents or fleets are removed.
-- Existing invalid drafts must be corrected before submit/approval, not deleted.
-- Avoid double-escaped regex for file extension: [.] reliably matches a dot.


DROP POLICY IF EXISTS "v31 captain private document upload" ON storage.objects;
CREATE POLICY "v31 captain private document upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='v31-captain-docs-staging'
 AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}[.](jpg|png|pdf)$')
 AND EXISTS(SELECT 1 FROM public.v31_captain_applications a
   WHERE a.user_id=(SELECT auth.uid()) AND a.status IN ('draft','rejected'))
);

create or replace function public.v31_register_captain_document(p_kind text,p_object_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); doc uuid; st text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_kind not in ('identity','driving_license','vehicle_license','vehicle_photo')
 then raise exception 'INVALID_DOCUMENT_TYPE'; end if;
 if p_object_name is null or p_object_name !~ ('^'||uid::text||'/[0-9a-f-]{36}[.](jpg|png|pdf)$')
 then raise exception 'INVALID_DOCUMENT_PATH'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st is null or st not in ('draft','rejected') then raise exception 'APPLICATION_LOCKED'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='v31-captain-docs-staging' and o.name=p_object_name)
 then raise exception 'DOCUMENT_NOT_UPLOADED'; end if;
 insert into public.v31_captain_documents(captain_id,kind,object_name)
 values(uid,p_kind,p_object_name) returning id into doc;
 return doc;
end $$;

CREATE OR REPLACE FUNCTION public.v31_save_captain_application(
 p_full_name text,p_phone text,p_notes text,p_experience smallint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); st text; clean_phone text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp WHERE cp.user_id=uid)
 THEN RAISE EXCEPTION 'CAPTAIN_ENROLLMENT_REQUIRED'; END IF;
 clean_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[\s-]','','g'),'');
 IF (p_full_name IS NOT NULL AND char_length(trim(p_full_name))>100)
    OR (p_full_name IS NOT NULL AND nullif(trim(p_full_name),'') IS NOT NULL
        AND (char_length(trim(p_full_name))<8 OR cardinality(regexp_split_to_array(trim(p_full_name), '[[:space:]]+'))<3))
    OR (clean_phone IS NOT NULL AND clean_phone !~ '^01[0125][0-9]{8}$')
    OR char_length(coalesce(p_notes,''))>1000
    OR (char_length(trim(coalesce(p_notes,'')))>0 AND (char_length(trim(coalesce(p_notes,'')))<15 OR cardinality(regexp_split_to_array(trim(coalesce(p_notes,'')), '[[:space:]]+'))<3))
    OR (p_experience IS NOT NULL AND (p_experience<0 OR p_experience>30))
 THEN RAISE EXCEPTION 'INVALID_PROFESSIONAL_DETAILS'; END IF;
 SELECT status INTO st FROM public.v31_captain_applications WHERE user_id=uid FOR UPDATE;
 IF st IN ('submitted','approved') THEN RAISE EXCEPTION 'APPLICATION_LOCKED'; END IF;
 INSERT INTO public.v31_captain_applications(
   user_id,status,full_name,phone_number,professional_notes,experience_years,
   rejection_reason,updated_at
 ) VALUES(uid,'draft',nullif(trim(p_full_name),''),clean_phone,coalesce(p_notes,''),p_experience,null,now())
 ON CONFLICT(user_id) DO UPDATE SET
   status='draft',full_name=excluded.full_name,phone_number=excluded.phone_number,
   professional_notes=excluded.professional_notes,experience_years=excluded.experience_years,
   rejection_reason=null,updated_at=now();
 IF nullif(trim(p_full_name),'') IS NOT NULL THEN
   UPDATE public.v31_profiles SET display_name=trim(p_full_name),updated_at=now() WHERE user_id=uid;
 END IF;
 RETURN 'draft';
END
$$;

CREATE OR REPLACE FUNCTION public.v31_save_captain_vehicle_intent(
 p_vehicle_type text,p_make_id bigint,p_model_id bigint,p_year smallint,
 p_color_code text,p_color_other text,p_plate text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); st text; clean_plate text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 clean_plate:=nullif(upper(translate(
   regexp_replace(coalesce(p_plate,''),'[[:space:]-]+','','g'),
   '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'
 )),'');
 IF (p_vehicle_type IS NOT NULL AND p_vehicle_type NOT IN ('private_car','hiace'))
    OR (p_make_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.v31_vehicle_makes WHERE id=p_make_id AND active))
    OR (p_model_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.v31_vehicle_models WHERE id=p_model_id AND make_id=p_make_id AND active))
    OR (p_year IS NOT NULL AND (p_year<1980 OR p_year>extract(year FROM now())::integer))
    OR (p_color_code IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.v31_vehicle_colors WHERE code=p_color_code AND active))
    OR (p_color_code='other' AND char_length(trim(coalesce(p_color_other,'')))<2)
    OR (p_color_code IS DISTINCT FROM 'other' AND nullif(trim(coalesce(p_color_other,'')),'') IS NOT NULL)
    OR (clean_plate IS NOT NULL AND (
      clean_plate !~ '^([ء-ي]{3}[0-9]{3}|[ء-ي]{2}[0-9]{4}|[ء-ي]{3}[0-9]{4})$'
    ))
 THEN RAISE EXCEPTION 'INVALID_VEHICLE_DETAILS'; END IF;
 SELECT status INTO st FROM public.v31_captain_applications WHERE user_id=uid FOR UPDATE;
 IF st IS NULL THEN RAISE EXCEPTION 'APPLICATION_DRAFT_REQUIRED'; END IF;
 IF st NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'APPLICATION_LOCKED'; END IF;
 IF clean_plate IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(lower(regexp_replace(clean_plate,'[[:space:]-]+','','g')),0));
   IF EXISTS(SELECT 1 FROM public.v31_captain_applications a WHERE a.user_id<>uid
       AND lower(regexp_replace(a.intended_plate,'[[:space:]-]+','','g'))=
           lower(regexp_replace(clean_plate,'[[:space:]-]+','','g')))
      OR EXISTS(SELECT 1 FROM public.v31_vehicles v WHERE v.captain_id<>uid
       AND lower(regexp_replace(v.plate_number,'[[:space:]-]+','','g'))=
           lower(regexp_replace(clean_plate,'[[:space:]-]+','','g')))
   THEN RAISE EXCEPTION 'DUPLICATE_LICENSE_PLATE'; END IF;
 END IF;
 UPDATE public.v31_captain_applications SET
   vehicle_type=p_vehicle_type,vehicle_make_id=p_make_id,vehicle_model_id=p_model_id,
   manufacture_year=p_year,vehicle_color_code=p_color_code,
   vehicle_color_other=nullif(trim(coalesce(p_color_other,'')),''),
   intended_plate=clean_plate,updated_at=now()
 WHERE user_id=uid;
 RETURN 'draft';
END
$$;

CREATE OR REPLACE FUNCTION public.v31_submit_captain_application()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); app public.v31_captain_applications%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO app FROM public.v31_captain_applications WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_DRAFT_REQUIRED'; END IF;
 IF app.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'APPLICATION_ALREADY_SUBMITTED'; END IF;
 IF app.full_name IS NULL OR char_length(trim(app.full_name))<8
    OR cardinality(regexp_split_to_array(trim(app.full_name), '[[:space:]]+'))<3
    OR app.phone_number IS NULL OR app.phone_number !~ '^01[0125][0-9]{8}$'
    OR (char_length(trim(coalesce(app.professional_notes,'')))<15 OR cardinality(regexp_split_to_array(trim(coalesce(app.professional_notes,'')), '[[:space:]]+'))<3)
    OR app.experience_years IS NULL OR app.experience_years NOT BETWEEN 0 AND 30
 THEN RAISE EXCEPTION 'CAPTAIN_PROFILE_INCOMPLETE'; END IF;
 IF app.vehicle_type IS NULL OR app.vehicle_type NOT IN ('private_car','hiace')
    OR app.vehicle_make_id IS NULL OR app.vehicle_model_id IS NULL
    OR app.manufacture_year IS NULL OR app.manufacture_year<1980
    OR app.manufacture_year>extract(year FROM now())::integer
    OR app.vehicle_color_code IS NULL
    OR (app.vehicle_color_code='other' AND char_length(trim(coalesce(app.vehicle_color_other,'')))<2)
    OR app.intended_plate IS NULL OR app.intended_plate !~ '^([ء-ي]{3}[0-9]{3}|[ء-ي]{2}[0-9]{4}|[ء-ي]{3}[0-9]{4})$'
 THEN RAISE EXCEPTION 'CAPTAIN_VEHICLE_INCOMPLETE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_vehicle_models m
   JOIN public.v31_vehicle_makes mk ON mk.id=m.make_id
   WHERE m.id=app.vehicle_model_id AND m.make_id=app.vehicle_make_id AND m.active AND mk.active)
 THEN RAISE EXCEPTION 'INVALID_VEHICLE_CATALOG_SELECTION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_vehicle_colors c
   WHERE c.code=app.vehicle_color_code AND c.active)
 THEN RAISE EXCEPTION 'INVALID_VEHICLE_COLOR'; END IF;
 IF (SELECT count(DISTINCT d.kind) FROM public.v31_captain_documents d
   JOIN storage.objects o ON o.bucket_id='v31-captain-docs-staging' AND o.name=d.object_name
   WHERE d.captain_id=uid AND d.kind IN ('identity','driving_license','vehicle_license','vehicle_photo'))<4
 THEN RAISE EXCEPTION 'CAPTAIN_DOCUMENTS_INCOMPLETE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')),0));
 IF EXISTS(SELECT 1 FROM public.v31_captain_applications a WHERE a.user_id<>uid
     AND lower(regexp_replace(a.intended_plate,'[[:space:]-]+','','g'))=
         lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')))
    OR EXISTS(SELECT 1 FROM public.v31_vehicles v WHERE v.captain_id<>uid
     AND lower(regexp_replace(v.plate_number,'[[:space:]-]+','','g'))=
         lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')))
 THEN RAISE EXCEPTION 'DUPLICATE_LICENSE_PLATE'; END IF;
 UPDATE public.v31_captain_applications SET status='submitted',submitted_at=now(),
   rejection_reason=null,reviewed_at=null,reviewed_by=null,updated_at=now()
 WHERE user_id=uid;
 UPDATE public.v31_captain_profiles SET approval_status='pending'
 WHERE user_id=uid AND approval_status<>'approved';
 RETURN 'submitted';
END
$$;

CREATE OR REPLACE FUNCTION public.v31_admin_decide_captain(
 p_captain uuid,p_decision text,p_reason text,p_hiace_categories text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE actor uuid:=(SELECT auth.uid()); app public.v31_captain_applications%rowtype;
        vehicle uuid; display_model text; categories text[]; base_category text;
        physical_seats smallint;
BEGIN
 IF actor IS NULL OR (SELECT public.v31_is_admin()) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
 IF p_decision='rejected' AND char_length(trim(coalesce(p_reason,'')))<5
 THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
 SELECT * INTO app FROM public.v31_captain_applications
 WHERE user_id=p_captain FOR UPDATE;
 IF app.status IS DISTINCT FROM 'submitted' THEN RAISE EXCEPTION 'APPLICATION_NOT_PENDING'; END IF;
 IF p_decision='approved' THEN
   IF app.full_name IS NULL OR char_length(trim(app.full_name))<8
      OR cardinality(regexp_split_to_array(trim(app.full_name), '[[:space:]]+'))<3
      OR app.phone_number IS NULL OR app.phone_number !~ '^01[0125][0-9]{8}$'
      OR (char_length(trim(coalesce(app.professional_notes,'')))<15 OR cardinality(regexp_split_to_array(trim(coalesce(app.professional_notes,'')), '[[:space:]]+'))<3)
      OR app.experience_years IS NULL OR app.experience_years NOT BETWEEN 0 AND 30
      OR app.vehicle_type IS NULL OR app.vehicle_type NOT IN ('private_car','hiace') OR app.vehicle_make_id IS NULL
      OR app.vehicle_model_id IS NULL OR app.manufacture_year IS NULL
      OR app.manufacture_year<1980 OR app.manufacture_year>extract(year FROM now())::integer
      OR app.vehicle_color_code IS NULL OR app.intended_plate IS NULL
      OR app.intended_plate !~ '^([ء-ي]{3}[0-9]{3}|[ء-ي]{2}[0-9]{4}|[ء-ي]{3}[0-9]{4})$'
      OR (app.vehicle_color_code='other' AND char_length(trim(coalesce(app.vehicle_color_other,'')))<2)
   THEN RAISE EXCEPTION 'CAPTAIN_APPLICATION_INCOMPLETE'; END IF;
   IF (SELECT count(DISTINCT d.kind) FROM public.v31_captain_documents d
       JOIN storage.objects o ON o.bucket_id='v31-captain-docs-staging' AND o.name=d.object_name
       WHERE d.captain_id=p_captain AND d.kind IN ('identity','driving_license','vehicle_license','vehicle_photo'))<4
   THEN RAISE EXCEPTION 'CAPTAIN_DOCUMENTS_INCOMPLETE'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')),0));
   IF EXISTS(SELECT 1 FROM public.v31_captain_applications a WHERE a.user_id<>p_captain
       AND lower(regexp_replace(a.intended_plate,'[[:space:]-]+','','g'))=
           lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')))
      OR EXISTS(SELECT 1 FROM public.v31_vehicles v WHERE v.captain_id<>p_captain
       AND lower(regexp_replace(v.plate_number,'[[:space:]-]+','','g'))=
           lower(regexp_replace(app.intended_plate,'[[:space:]-]+','','g')))
   THEN RAISE EXCEPTION 'DUPLICATE_LICENSE_PLATE'; END IF;
   SELECT m.name_en INTO display_model FROM public.v31_vehicle_models m
   JOIN public.v31_vehicle_makes mk ON mk.id=m.make_id
   WHERE m.id=app.vehicle_model_id AND m.make_id=app.vehicle_make_id
     AND m.active AND mk.active;
   IF display_model IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.v31_vehicle_colors c WHERE c.code=app.vehicle_color_code AND c.active)
   THEN RAISE EXCEPTION 'INVALID_VEHICLE_CATALOG_SELECTION'; END IF;
   IF app.vehicle_type='private_car' THEN
     IF p_hiace_categories IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CATEGORY_SELECTION'; END IF;
     categories:=ARRAY['PRIME','SAVER'];base_category:='PRIME';physical_seats:=4;
   ELSE
     IF p_hiace_categories IS NULL OR cardinality(p_hiace_categories)<1
        OR cardinality(p_hiace_categories)>2
        OR EXISTS(SELECT 1 FROM unnest(p_hiace_categories) c WHERE c NOT IN ('SPACE','MAX'))
        OR cardinality(ARRAY(SELECT DISTINCT c FROM unnest(p_hiace_categories) c))<>cardinality(p_hiace_categories)
     THEN RAISE EXCEPTION 'HIACE_CATEGORY_REVIEW_REQUIRED'; END IF;
     categories:=p_hiace_categories;base_category:=p_hiace_categories[1];physical_seats:=13;
   END IF;
   SELECT id INTO vehicle FROM public.v31_vehicles
   WHERE captain_id=p_captain AND lower(trim(plate_number))=lower(trim(app.intended_plate))
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
   IF vehicle IS NULL THEN
     INSERT INTO public.v31_vehicles(captain_id,model,plate_number,category,seats,status,
       vehicle_type,make_id,vehicle_model_id,manufacture_year,color_code,color_other,enabled_categories)
     VALUES(p_captain,display_model,trim(app.intended_plate),base_category,physical_seats,'active',
       app.vehicle_type,app.vehicle_make_id,app.vehicle_model_id,app.manufacture_year,
       app.vehicle_color_code,app.vehicle_color_other,categories)
     RETURNING id INTO vehicle;
   ELSE
     UPDATE public.v31_vehicles SET model=display_model,plate_number=trim(app.intended_plate),
       category=base_category,seats=physical_seats,status='active',vehicle_type=app.vehicle_type,
       make_id=app.vehicle_make_id,vehicle_model_id=app.vehicle_model_id,
       manufacture_year=app.manufacture_year,color_code=app.vehicle_color_code,
       color_other=app.vehicle_color_other,enabled_categories=categories
     WHERE id=vehicle;
     DELETE FROM public.v31_vehicle_service_categories WHERE vehicle_id=vehicle;
   END IF;
   DELETE FROM public.v31_vehicle_service_categories WHERE vehicle_id=vehicle;
   INSERT INTO public.v31_vehicle_service_categories(vehicle_id,category,seat_capacity)
   SELECT vehicle,c,CASE c WHEN 'PRIME' THEN 3 WHEN 'SAVER' THEN 4 WHEN 'SPACE' THEN 9 ELSE 13 END
   FROM unnest(categories) c;
 END IF;
 UPDATE public.v31_captain_applications SET status=p_decision,
   approved_vehicle_id=CASE WHEN p_decision='approved' THEN vehicle ELSE approved_vehicle_id END,
   rejection_reason=CASE WHEN p_decision='rejected' THEN trim(p_reason) ELSE NULL END,
   reviewed_by=actor,reviewed_at=now(),updated_at=now()
 WHERE user_id=p_captain;
 UPDATE public.v31_captain_profiles SET approval_status=p_decision WHERE user_id=p_captain;
 INSERT INTO public.v31_captain_approval_audit(captain_id,actor_id,decision,reason)
 VALUES(p_captain,actor,p_decision,CASE WHEN p_decision='rejected' THEN trim(p_reason) ELSE NULL END);
 RETURN p_decision;
END
$$;
