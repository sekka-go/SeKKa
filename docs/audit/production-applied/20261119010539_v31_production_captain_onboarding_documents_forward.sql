-- Reviewed existing Staging migration 20261115130000_v31_staging_captain_review.sql (already tested on Staging)
-- STAGING-ONLY: Captain review workflow for the existing v31 domain.
-- PRD v3.1 includes document review but does not specify a mandatory document list.
-- None of the optional document categories below is treated as mandatory by the backend.
create table if not exists public.v31_captain_applications (
 user_id uuid primary key references public.v31_captain_profiles(user_id) on delete cascade,
 status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
 professional_notes text not null default '',
 experience_years smallint check (experience_years between 0 and 80),
 rejection_reason text,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.v31_captain_documents (
 id uuid primary key default gen_random_uuid(),
 captain_id uuid not null references public.v31_captain_applications(user_id) on delete cascade,
 kind text not null check (kind in ('identity','driving_license','vehicle_license','vehicle_photo')),
 object_name text not null unique,
 created_at timestamptz not null default now()
);
create index if not exists v31_captain_documents_captain_idx on public.v31_captain_documents(captain_id);
create table if not exists public.v31_captain_approval_audit (
 id uuid primary key default gen_random_uuid(),
 captain_id uuid not null references public.v31_captain_applications(user_id),
 actor_id uuid not null references auth.users(id),
 decision text not null check (decision in ('approved','rejected')),
 reason text,
 created_at timestamptz not null default now()
);
create index if not exists v31_captain_approval_audit_captain_idx on public.v31_captain_approval_audit(captain_id,created_at desc);

alter table public.v31_captain_applications enable row level security;
alter table public.v31_captain_documents enable row level security;
alter table public.v31_captain_approval_audit enable row level security;
revoke all on public.v31_captain_applications,public.v31_captain_documents,public.v31_captain_approval_audit from public,anon,authenticated;
grant select on public.v31_captain_applications,public.v31_captain_documents,public.v31_captain_approval_audit to authenticated;
create policy "captain application own or admin read" on public.v31_captain_applications for select to authenticated
 using (user_id=(select auth.uid()) or (select public.v31_is_admin()));
create policy "captain document own or admin read" on public.v31_captain_documents for select to authenticated
 using (captain_id=(select auth.uid()) or (select public.v31_is_admin()));
create policy "captain decision own or admin read" on public.v31_captain_approval_audit for select to authenticated
 using (captain_id=(select auth.uid()) or (select public.v31_is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('v31-captain-docs-staging','v31-captain-docs-staging',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

-- Objects can only be uploaded into the authenticated user's own UUID directory,
-- while a real draft/rejected application exists. No public read, update, or delete.
create policy "v31 captain private document upload" on storage.objects for insert to authenticated
with check (
 bucket_id='v31-captain-docs-staging'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|png|pdf)$')
 and exists (select 1 from public.v31_captain_applications a
   where a.user_id=(select auth.uid()) and a.status in ('draft','rejected'))
);
create policy "v31 captain private document download" on storage.objects for select to authenticated
using (
 bucket_id='v31-captain-docs-staging'
 and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.v31_is_admin()))
);

create or replace function public.v31_save_captain_application(p_notes text default '',p_experience smallint default null)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); st text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (select 1 from public.v31_captain_profiles cp where cp.user_id=uid)
 then raise exception 'CAPTAIN_ENROLLMENT_REQUIRED'; end if;
 if char_length(coalesce(p_notes,''))>1000 or (p_experience is not null and (p_experience<0 or p_experience>80))
 then raise exception 'INVALID_PROFESSIONAL_DETAILS'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st in ('submitted','approved') then raise exception 'APPLICATION_LOCKED'; end if;
 insert into public.v31_captain_applications(user_id,status,professional_notes,experience_years,rejection_reason,updated_at)
 values(uid,'draft',coalesce(p_notes,''),p_experience,null,now())
 on conflict(user_id) do update
 set status='draft',professional_notes=excluded.professional_notes,
     experience_years=excluded.experience_years,rejection_reason=null,updated_at=now();
 return 'draft';
end $$;

create or replace function public.v31_register_captain_document(p_kind text,p_object_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); doc uuid; st text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_kind not in ('identity','driving_license','vehicle_license','vehicle_photo')
 then raise exception 'INVALID_DOCUMENT_TYPE'; end if;
 if p_object_name is null or p_object_name !~ ('^'||uid::text||'/[0-9a-f-]{36}\.(jpg|png|pdf)$')
 then raise exception 'INVALID_DOCUMENT_PATH'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st is null or st not in ('draft','rejected') then raise exception 'APPLICATION_LOCKED'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='v31-captain-docs-staging' and o.name=p_object_name)
 then raise exception 'DOCUMENT_NOT_UPLOADED'; end if;
 insert into public.v31_captain_documents(captain_id,kind,object_name)
 values(uid,p_kind,p_object_name) returning id into doc;
 return doc;
end $$;

create or replace function public.v31_submit_captain_application()
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); st text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.v31_profiles p
   where p.user_id=uid and char_length(trim(p.display_name))>=2)
 then raise exception 'CAPTAIN_PROFILE_INCOMPLETE'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st is null then raise exception 'APPLICATION_DRAFT_REQUIRED'; end if;
 if st not in ('draft','rejected') then raise exception 'APPLICATION_ALREADY_SUBMITTED'; end if;
 update public.v31_captain_applications set status='submitted',submitted_at=now(),
 rejection_reason=null,reviewed_at=null,reviewed_by=null,updated_at=now() where user_id=uid;
 update public.v31_captain_profiles set approval_status='pending' where user_id=uid and approval_status<>'approved';
 return 'submitted';
end $$;

create or replace function public.v31_admin_decide_captain(p_captain uuid,p_decision text,p_reason text default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); st text;
begin
 if actor is null or not (select public.v31_is_admin()) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
 if p_decision='rejected' and char_length(trim(coalesce(p_reason,'')))<5
 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
 select status into st from public.v31_captain_applications where user_id=p_captain for update;
 if st is distinct from 'submitted' then raise exception 'APPLICATION_NOT_PENDING'; end if;
 update public.v31_captain_applications set status=p_decision,rejection_reason=case when p_decision='rejected' then trim(p_reason) else null end,
 reviewed_by=actor,reviewed_at=now(),updated_at=now() where user_id=p_captain;
 update public.v31_captain_profiles set approval_status=p_decision where user_id=p_captain;
 insert into public.v31_captain_approval_audit(captain_id,actor_id,decision,reason)
 values(p_captain,actor,p_decision,case when p_decision='rejected' then trim(p_reason) else null end);
 return p_decision;
end $$;

revoke all on function public.v31_save_captain_application(text,smallint) from public,anon;
revoke all on function public.v31_register_captain_document(text,text) from public,anon;
revoke all on function public.v31_submit_captain_application() from public,anon;
revoke all on function public.v31_admin_decide_captain(uuid,text,text) from public,anon;
grant execute on function public.v31_save_captain_application(text,smallint) to authenticated;
grant execute on function public.v31_register_captain_document(text,text) to authenticated;
grant execute on function public.v31_submit_captain_application() to authenticated;
grant execute on function public.v31_admin_decide_captain(uuid,text,text) to authenticated;


-- Reviewed existing Staging migration 20261115130500_v31_staging_captain_vehicle_intent.sql (already tested on Staging)
-- Optional planned vehicle data remains private until captain approval and vehicle registration.
-- The PRD names Vehicle & Category but does not define mandatory pre-approval fields.
alter table public.v31_captain_applications
 add column if not exists intended_vehicle_model text,
 add column if not exists intended_category text,
 add column if not exists intended_seats smallint,
 add column if not exists intended_plate text;
create or replace function public.v31_save_captain_vehicle_intent(
 p_model text default null,p_category text default null,p_seats smallint default null,p_plate text default null)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); st text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_model is not null and char_length(trim(p_model))>100
  or p_plate is not null and char_length(trim(p_plate))>24
  or p_category is not null and p_category not in ('PRIME','SAVER','SPACE','MAX')
  or p_seats is not null and (p_seats<1 or p_seats>13)
 then raise exception 'INVALID_VEHICLE_INTENT'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st is null then raise exception 'APPLICATION_DRAFT_REQUIRED'; end if;
 if st not in ('draft','rejected') then raise exception 'APPLICATION_LOCKED'; end if;
 update public.v31_captain_applications set intended_vehicle_model=nullif(trim(p_model),''),
 intended_category=p_category,intended_seats=p_seats,intended_plate=nullif(trim(p_plate),''),
 updated_at=now() where user_id=uid;
 return 'draft';
end $$;
revoke all on function public.v31_save_captain_vehicle_intent(text,text,smallint,text) from public,anon;
grant execute on function public.v31_save_captain_vehicle_intent(text,text,smallint,text) to authenticated;


-- Reviewed existing Staging migration 20261115131000_v31_captain_intent_category_guard.sql (already tested on Staging)
-- Category seat caps match the existing v31 vehicle categories, no new categories.
create or replace function public.v31_save_captain_vehicle_intent(
 p_model text default null,p_category text default null,p_seats smallint default null,p_plate text default null)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); st text; max_seats integer;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if (p_model is not null and char_length(trim(p_model))>100)
    or (p_plate is not null and char_length(trim(p_plate))>24)
    or (p_category is not null and p_category not in ('PRIME','SAVER','SPACE','MAX'))
    or (p_seats is not null and (p_seats<1 or p_seats>13))
 then raise exception 'INVALID_VEHICLE_INTENT'; end if;
 max_seats:=case p_category when 'PRIME' then 3 when 'SAVER' then 4 when 'SPACE' then 9 when 'MAX' then 13 else null end;
 if p_seats is not null and max_seats is not null and p_seats>max_seats
 then raise exception 'CATEGORY_CAPACITY_EXCEEDED'; end if;
 select status into st from public.v31_captain_applications where user_id=uid for update;
 if st is null then raise exception 'APPLICATION_DRAFT_REQUIRED'; end if;
 if st not in ('draft','rejected') then raise exception 'APPLICATION_LOCKED'; end if;
 update public.v31_captain_applications set intended_vehicle_model=nullif(trim(p_model),''),
 intended_category=p_category,intended_seats=p_seats,intended_plate=nullif(trim(p_plate),''),
 updated_at=now() where user_id=uid;
 return 'draft';
end $$;
revoke all on function public.v31_save_captain_vehicle_intent(text,text,smallint,text) from public,anon;
grant execute on function public.v31_save_captain_vehicle_intent(text,text,smallint,text) to authenticated;

-- Reviewed existing Staging migration 20261115150000_v31_mandatory_captain_registration.sql (already tested on Staging)
-- Staging-only: mandatory Captain onboarding and system-controlled fleet eligibility.
-- Existing Captain applications, vehicles, routes, and bookings are retained.

CREATE TABLE IF NOT EXISTS public.v31_vehicle_makes (
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 name_en text NOT NULL,
 name_ar text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 catalog_version text NOT NULL DEFAULT '2026.1',
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v31_vehicle_models (
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 make_id bigint NOT NULL REFERENCES public.v31_vehicle_makes(id),
 slug text NOT NULL,
 name_en text NOT NULL,
 name_ar text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 catalog_version text NOT NULL DEFAULT '2026.1',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (make_id, slug)
);

CREATE TABLE IF NOT EXISTS public.v31_vehicle_colors (
 code text PRIMARY KEY,
 name_en text NOT NULL,
 name_ar text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 catalog_version text NOT NULL DEFAULT '2026.1'
);

INSERT INTO public.v31_vehicle_makes(slug,name_en,name_ar) VALUES
 ('toyota','Toyota','تويوتا'),('hyundai','Hyundai','هيونداي'),('kia','Kia','كيا'),
 ('nissan','Nissan','نيسان'),('chevrolet','Chevrolet','شيفروليه'),('renault','Renault','رينو'),
 ('peugeot','Peugeot','بيجو'),('citroen','Citroën','سيتروين'),('mitsubishi','Mitsubishi','ميتسوبيشي'),
 ('honda','Honda','هوندا'),('suzuki','Suzuki','سوزوكي'),('fiat','Fiat','فيات'),
 ('skoda','Škoda','سكودا'),('volkswagen','Volkswagen','فولكس فاجن'),('bmw','BMW','بي إم دبليو'),
 ('mercedes-benz','Mercedes-Benz','مرسيدس بنز'),('opel','Opel','أوبل'),('ford','Ford','فورد'),
 ('mg','MG','إم جي'),('chery','Chery','شيري'),('geely','Geely','جيلي'),
 ('jac','JAC','جاك'),('byd','BYD','بي واي دي'),('jetour','Jetour','جيتور'),
 ('dfsk','DFSK','دي إف إس كيه'),('foton','Foton','فوتون'),('isuzu','Isuzu','إيسوزو'),
 ('mazda','Mazda','مازدا'),('subaru','Subaru','سوبارو'),('lada','Lada','لادا')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.v31_vehicle_models(make_id,slug,name_en,name_ar)
SELECT m.id, x.slug, x.name_en, x.name_ar
FROM (VALUES
 ('toyota','corolla','Corolla','كورولا'),('toyota','yaris','Yaris','ياريس'),
 ('toyota','camry','Camry','كامري'),('toyota','hiace','Hiace','هايس'),
 ('hyundai','verna','Verna','فيرنا'),('hyundai','accent','Accent','أكسنت'),
 ('hyundai','elantra','Elantra','إلنترا'),('hyundai','tucson','Tucson','توسان'),
 ('hyundai','creta','Creta','كريتا'),('kia','cerato','Cerato','سيراتو'),
 ('kia','rio','Rio','ريو'),('kia','sportage','Sportage','سبورتاج'),
 ('nissan','sunny','Sunny','صني'),('nissan','sentra','Sentra','سنترا'),
 ('nissan','qashqai','Qashqai','قشقاي'),('chevrolet','aveo','Aveo','أفيو'),
 ('chevrolet','optra','Optra','أوبترا'),('chevrolet','captiva','Captiva','كابتيفا'),
 ('renault','logan','Logan','لوجان'),('renault','megane','Megane','ميجان'),
 ('renault','duster','Duster','داستر'),('peugeot','301','301','٣٠١'),
 ('peugeot','508','508','٥٠٨'),('peugeot','3008','3008','٣٠٠٨'),
 ('citroen','c-elysee','C-Elysée','سي إليزيه'),('mitsubishi','lancer','Lancer','لانسر'),
 ('mitsubishi','attrage','Attrage','أتراج'),('honda','civic','Civic','سيفيك'),
 ('honda','city','City','سيتي'),('suzuki','swift','Swift','سويفت'),
 ('fiat','tipo','Tipo','تيبو'),('skoda','octavia','Octavia','أوكتافيا'),
 ('skoda','rapid','Rapid','رابيد'),('volkswagen','jetta','Jetta','جيتا'),
 ('volkswagen','passat','Passat','باسات'),('bmw','3-series','3 Series','الفئة الثالثة'),
 ('mercedes-benz','c-class','C-Class','الفئة C'),('opel','astra','Astra','أسترا'),
 ('ford','focus','Focus','فوكَس'),('mg','5','MG 5','إم جي ٥'),
 ('mg','zs','MG ZS','إم جي زد إس'),('chery','arrizo-5','Arrizo 5','أريزو ٥'),
 ('chery','tiggo-7','Tiggo 7','تيجو ٧'),('geely','emgrand','Emgrand','إمجراند'),
 ('jac','j7','J7','جيه ٧'),('byd','f3','F3','إف ٣'),
 ('jetour','x70','X70','إكس ٧٠'),('dfsk','glory-330','Glory 330','جلوري ٣٣٠'),
 ('foton','view','View','فيو'),('isuzu','d-max','D-Max','دي ماكس'),
 ('mazda','3','Mazda 3','مازدا ٣'),('subaru','impreza','Impreza','إمبريزا'),
 ('lada','granta','Granta','جرانتا')
) AS x(make_slug,slug,name_en,name_ar)
JOIN public.v31_vehicle_makes m ON m.slug=x.make_slug
ON CONFLICT (make_id,slug) DO NOTHING;

INSERT INTO public.v31_vehicle_colors(code,name_en,name_ar) VALUES
 ('white','White','أبيض'),('black','Black','أسود'),('silver','Silver','فضي'),
 ('gray','Gray','رمادي'),('red','Red','أحمر'),('blue','Blue','أزرق'),
 ('green','Green','أخضر'),('brown','Brown','بني'),('gold','Gold','ذهبي'),
 ('other','Other','أخرى')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.v31_captain_applications
 ADD COLUMN IF NOT EXISTS full_name text,
 ADD COLUMN IF NOT EXISTS phone_number text,
 ADD COLUMN IF NOT EXISTS vehicle_type text,
 ADD COLUMN IF NOT EXISTS vehicle_make_id bigint REFERENCES public.v31_vehicle_makes(id),
 ADD COLUMN IF NOT EXISTS vehicle_model_id bigint REFERENCES public.v31_vehicle_models(id),
 ADD COLUMN IF NOT EXISTS manufacture_year smallint,
 ADD COLUMN IF NOT EXISTS vehicle_color_code text REFERENCES public.v31_vehicle_colors(code),
 ADD COLUMN IF NOT EXISTS vehicle_color_other text,
 ADD COLUMN IF NOT EXISTS approved_vehicle_id uuid REFERENCES public.v31_vehicles(id);

ALTER TABLE public.v31_vehicles
 ADD COLUMN IF NOT EXISTS vehicle_type text,
 ADD COLUMN IF NOT EXISTS make_id bigint REFERENCES public.v31_vehicle_makes(id),
 ADD COLUMN IF NOT EXISTS vehicle_model_id bigint REFERENCES public.v31_vehicle_models(id),
 ADD COLUMN IF NOT EXISTS manufacture_year smallint,
 ADD COLUMN IF NOT EXISTS color_code text REFERENCES public.v31_vehicle_colors(code),
 ADD COLUMN IF NOT EXISTS color_other text,
 ADD COLUMN IF NOT EXISTS enabled_categories text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.v31_vehicles DROP CONSTRAINT IF EXISTS v31_vehicles_check;
ALTER TABLE public.v31_routes
 ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.v31_vehicles(id);

CREATE TABLE IF NOT EXISTS public.v31_vehicle_service_categories (
 vehicle_id uuid NOT NULL REFERENCES public.v31_vehicles(id) ON DELETE CASCADE,
 category text NOT NULL CHECK (category IN ('PRIME','SAVER','SPACE','MAX')),
 seat_capacity smallint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(vehicle_id,category),
 CONSTRAINT v31_vehicle_service_category_capacity CHECK (
   (category='PRIME' AND seat_capacity=3) OR
   (category='SAVER' AND seat_capacity=4) OR
   (category='SPACE' AND seat_capacity=9) OR
   (category='MAX' AND seat_capacity=13)
 )
);

CREATE INDEX IF NOT EXISTS v31_vehicle_models_make_idx
 ON public.v31_vehicle_models(make_id,active,name_en);
CREATE INDEX IF NOT EXISTS v31_vehicle_category_lookup_idx
 ON public.v31_vehicle_service_categories(category,vehicle_id);
CREATE INDEX IF NOT EXISTS v31_routes_vehicle_status_idx
 ON public.v31_routes(vehicle_id,status);

ALTER TABLE public.v31_vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v31_vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v31_vehicle_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v31_vehicle_service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle makes catalog read" ON public.v31_vehicle_makes;
CREATE POLICY "vehicle makes catalog read" ON public.v31_vehicle_makes
 FOR SELECT TO authenticated USING (active OR (SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle makes admin manage" ON public.v31_vehicle_makes;
CREATE POLICY "vehicle makes admin manage" ON public.v31_vehicle_makes
 FOR ALL TO authenticated USING ((SELECT public.v31_is_admin()))
 WITH CHECK ((SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle models catalog read" ON public.v31_vehicle_models;
CREATE POLICY "vehicle models catalog read" ON public.v31_vehicle_models
 FOR SELECT TO authenticated USING (active OR (SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle models admin manage" ON public.v31_vehicle_models;
CREATE POLICY "vehicle models admin manage" ON public.v31_vehicle_models
 FOR ALL TO authenticated USING ((SELECT public.v31_is_admin()))
 WITH CHECK ((SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle colors catalog read" ON public.v31_vehicle_colors;
CREATE POLICY "vehicle colors catalog read" ON public.v31_vehicle_colors
 FOR SELECT TO authenticated USING (active OR (SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle colors admin manage" ON public.v31_vehicle_colors;
CREATE POLICY "vehicle colors admin manage" ON public.v31_vehicle_colors
 FOR ALL TO authenticated USING ((SELECT public.v31_is_admin()))
 WITH CHECK ((SELECT public.v31_is_admin()));
DROP POLICY IF EXISTS "vehicle service categories owner read" ON public.v31_vehicle_service_categories;
CREATE POLICY "vehicle service categories owner read" ON public.v31_vehicle_service_categories
 FOR SELECT TO authenticated USING (
   EXISTS (SELECT 1 FROM public.v31_vehicles v WHERE v.id=vehicle_id AND v.captain_id=(SELECT auth.uid()))
   OR (SELECT public.v31_is_admin())
 );

GRANT SELECT ON public.v31_vehicle_makes,public.v31_vehicle_models,public.v31_vehicle_colors,
 public.v31_vehicle_service_categories TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.v31_vehicle_makes,public.v31_vehicle_models,
 public.v31_vehicle_colors TO authenticated;
REVOKE ALL ON public.v31_captain_applications,public.v31_captain_documents,
 public.v31_captain_approval_audit FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.v31_vehicles FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.v31_vehicle_service_categories FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.v31_routes,public.v31_route_stops FROM anon,authenticated;

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
        AND (char_length(trim(p_full_name))<5 OR position(' ' in trim(p_full_name))=0))
    OR (clean_phone IS NOT NULL AND clean_phone !~ '^01[0125][0-9]{8}$')
    OR char_length(coalesce(p_notes,''))>1000
    OR (p_experience IS NOT NULL AND (p_experience<0 OR p_experience>80))
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

CREATE OR REPLACE FUNCTION public.v31_save_captain_application(
 p_notes text DEFAULT '',p_experience smallint DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); saved public.v31_captain_applications%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO saved FROM public.v31_captain_applications WHERE user_id=uid;
 RETURN public.v31_save_captain_application(saved.full_name,saved.phone_number,p_notes,p_experience);
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
 clean_plate:=nullif(trim(p_plate),'');
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
      char_length(clean_plate)<3 OR char_length(clean_plate)>24
      OR clean_plate !~ '^[A-Za-z0-9 ء-ي-]+$'
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
 IF app.full_name IS NULL OR char_length(trim(app.full_name))<5
    OR position(' ' in trim(app.full_name))=0
    OR app.phone_number IS NULL OR app.phone_number !~ '^01[0125][0-9]{8}$'
    OR char_length(trim(coalesce(app.professional_notes,'')))<3
    OR app.experience_years IS NULL OR app.experience_years NOT BETWEEN 0 AND 80
 THEN RAISE EXCEPTION 'CAPTAIN_PROFILE_INCOMPLETE'; END IF;
 IF app.vehicle_type IS NULL OR app.vehicle_type NOT IN ('private_car','hiace')
    OR app.vehicle_make_id IS NULL OR app.vehicle_model_id IS NULL
    OR app.manufacture_year IS NULL OR app.manufacture_year<1980
    OR app.manufacture_year>extract(year FROM now())::integer
    OR app.vehicle_color_code IS NULL
    OR (app.vehicle_color_code='other' AND char_length(trim(coalesce(app.vehicle_color_other,'')))<2)
    OR app.intended_plate IS NULL OR char_length(trim(app.intended_plate))<3
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
   IF app.full_name IS NULL OR char_length(trim(app.full_name))<5
      OR position(' ' in trim(app.full_name))=0
      OR app.phone_number IS NULL OR app.phone_number !~ '^01[0125][0-9]{8}$'
      OR char_length(trim(coalesce(app.professional_notes,'')))<3
      OR app.experience_years IS NULL OR app.experience_years NOT BETWEEN 0 AND 80
      OR app.vehicle_type IS NULL OR app.vehicle_type NOT IN ('private_car','hiace') OR app.vehicle_make_id IS NULL
      OR app.vehicle_model_id IS NULL OR app.manufacture_year IS NULL
      OR app.manufacture_year<1980 OR app.manufacture_year>extract(year FROM now())::integer
      OR app.vehicle_color_code IS NULL OR app.intended_plate IS NULL
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

CREATE OR REPLACE FUNCTION public.v31_admin_decide_captain(
 p_captain uuid,p_decision text,p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
 RETURN public.v31_admin_decide_captain(p_captain,p_decision,p_reason,NULL::text[]);
END
$$;

CREATE OR REPLACE FUNCTION public.v31_guard_route_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=''
AS $$
DECLARE enabled boolean; fixed_capacity smallint; physical_id uuid;
        v_n integer; v_first bigint; v_last bigint;
BEGIN
 IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
   IF TG_OP='INSERT' THEN RAISE EXCEPTION 'DRAFT_FIRST_REQUIRED'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
      WHERE cp.user_id=NEW.captain_id AND cp.approval_status='approved')
   THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
   IF NEW.vehicle_id IS NULL THEN RAISE EXCEPTION 'VEHICLE_REQUIRED'; END IF;
   PERFORM 1 FROM public.v31_vehicles v WHERE v.id=NEW.vehicle_id FOR UPDATE;
   SELECT v.status='active',c.seat_capacity INTO enabled,fixed_capacity
   FROM public.v31_vehicles v LEFT JOIN public.v31_vehicle_service_categories c
     ON c.vehicle_id=v.id AND c.category=NEW.category
   WHERE v.id=NEW.vehicle_id AND v.captain_id=NEW.captain_id;
   IF NOT FOUND OR enabled IS DISTINCT FROM true OR fixed_capacity IS NULL
   THEN RAISE EXCEPTION 'VEHICLE_CATEGORY_NOT_ENABLED'; END IF;
   IF NEW.seat_capacity IS DISTINCT FROM fixed_capacity
   THEN RAISE EXCEPTION 'CATEGORY_CAPACITY_MISMATCH'; END IF;
   IF EXISTS(SELECT 1 FROM public.v31_routes r
      WHERE r.vehicle_id=NEW.vehicle_id AND r.id<>NEW.id
        AND r.status IN ('published','paused'))
   THEN RAISE EXCEPTION 'VEHICLE_HAS_ACTIVE_SERVICE'; END IF;
   physical_id:=NEW.vehicle_id;
   SELECT count(*),min(area_id) FILTER(WHERE position=0)
     INTO v_n,v_first FROM public.v31_route_stops WHERE route_id=NEW.id;
   SELECT area_id INTO v_last FROM public.v31_route_stops
     WHERE route_id=NEW.id ORDER BY position DESC LIMIT 1;
   IF v_n<2 OR v_n>30 OR v_first IS NULL OR v_last IS NULL OR v_first=v_last
   THEN RAISE EXCEPTION 'INVALID_ROUTE_STOPS'; END IF;
   IF EXISTS(SELECT 1 FROM public.v31_route_stops s WHERE s.route_id=NEW.id
       AND NOT EXISTS(SELECT 1 FROM public.v31_service_areas a WHERE a.id=s.area_id AND a.active))
   THEN RAISE EXCEPTION 'INACTIVE_SERVICE_AREA'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.v31_route_stops p JOIN public.v31_route_stops d
       ON p.route_id=d.route_id WHERE p.route_id=NEW.id AND p.position<d.position
       AND p.pickup_allowed AND d.dropoff_allowed)
   THEN RAISE EXCEPTION 'NO_VALID_PICKUP_DROPOFF'; END IF;
   IF NEW.direction='round_trip' AND (NOT NEW.return_supported OR NOT EXISTS(
       SELECT 1 FROM public.v31_route_stops p JOIN public.v31_route_stops d
       ON p.route_id=d.route_id WHERE p.route_id=NEW.id AND p.position<d.position
       AND d.pickup_allowed AND p.dropoff_allowed))
   THEN RAISE EXCEPTION 'REVERSE_ROUTE_UNSUPPORTED'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND (
    NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.seat_capacity IS DISTINCT FROM OLD.seat_capacity
 ) THEN
   IF NEW.vehicle_id IS NULL THEN RAISE EXCEPTION 'VEHICLE_REQUIRED'; END IF;
   SELECT c.seat_capacity INTO fixed_capacity
   FROM public.v31_vehicle_service_categories c JOIN public.v31_vehicles v ON v.id=c.vehicle_id
   WHERE c.vehicle_id=NEW.vehicle_id AND c.category=NEW.category
     AND v.captain_id=NEW.captain_id AND v.status='active';
   IF fixed_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_CATEGORY_NOT_ENABLED'; END IF;
   IF NEW.seat_capacity IS DISTINCT FROM fixed_capacity
   THEN RAISE EXCEPTION 'CATEGORY_CAPACITY_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS v31_route_publish_guard ON public.v31_routes;
CREATE TRIGGER v31_route_publish_guard
 BEFORE INSERT OR UPDATE OF status,vehicle_id,category,seat_capacity ON public.v31_routes
 FOR EACH ROW EXECUTE FUNCTION public.v31_guard_route_status();

CREATE OR REPLACE FUNCTION public.v31_create_vehicle_route_draft(
 p_title text,p_vehicle uuid,p_category text,p_direction text,p_period text,
 p_outbound time,p_return time,p_return_supported boolean,p_price integer,p_stops jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); route_id uuid; stop jsonb; position integer:=0;
        fixed_capacity smallint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
     WHERE cp.user_id=uid AND cp.approval_status='approved')
 THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 SELECT c.seat_capacity INTO fixed_capacity
 FROM public.v31_vehicles v JOIN public.v31_vehicle_service_categories c ON c.vehicle_id=v.id
 WHERE v.id=p_vehicle AND v.captain_id=uid AND v.status='active' AND c.category=p_category
 FOR UPDATE OF v;
 IF fixed_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_CATEGORY_NOT_ENABLED'; END IF;
 IF char_length(trim(coalesce(p_title,'')))<3 OR char_length(trim(p_title))>120
    OR p_category NOT IN ('PRIME','SAVER','SPACE','MAX')
    OR p_direction NOT IN ('outbound','return','round_trip')
    OR p_period NOT IN ('weekly','monthly') OR p_price IS NULL OR p_price<1
    OR (p_direction<>'return' AND p_outbound IS NULL)
    OR (p_direction<>'outbound' AND p_return IS NULL)
    OR (p_direction='round_trip' AND NOT coalesce(p_return_supported,false))
 THEN RAISE EXCEPTION 'INVALID_ROUTE_DETAILS'; END IF;
 IF jsonb_typeof(p_stops) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_stops)<2 OR jsonb_array_length(p_stops)>30
 THEN RAISE EXCEPTION 'INVALID_STOPS_COUNT'; END IF;
 IF p_stops->0->>'area_id' IS NOT DISTINCT FROM
    p_stops->(jsonb_array_length(p_stops)-1)->>'area_id'
 THEN RAISE EXCEPTION 'SAME_ORIGIN_DESTINATION'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_stops) s
    WHERE nullif(trim(s->>'name'),'') IS NULL OR char_length(trim(s->>'name'))<2
      OR (s->>'area_id') !~ '^[0-9]+$'
      OR NOT EXISTS(SELECT 1 FROM public.v31_service_areas a
        WHERE a.id=(s->>'area_id')::bigint AND a.active))
 THEN RAISE EXCEPTION 'INVALID_STOP'; END IF;
 IF (SELECT count(DISTINCT lower(trim(s->>'name'))||':'||(s->>'area_id'))
     FROM jsonb_array_elements(p_stops) s)<>jsonb_array_length(p_stops)
 THEN RAISE EXCEPTION 'DUPLICATE_STOPS'; END IF;
 INSERT INTO public.v31_routes(captain_id,title,category,seat_capacity,vehicle_id,
   direction,period,outbound_time,return_time,return_supported,price_egp,status)
 VALUES(uid,trim(p_title),p_category,fixed_capacity,p_vehicle,p_direction,p_period,
   p_outbound,p_return,coalesce(p_return_supported,false),p_price,'draft')
 RETURNING id INTO route_id;
 FOR stop IN SELECT value FROM jsonb_array_elements(p_stops) LOOP
   INSERT INTO public.v31_route_stops(route_id,area_id,name,position,pickup_allowed,dropoff_allowed)
   VALUES(route_id,(stop->>'area_id')::bigint,trim(stop->>'name'),position,
     coalesce((stop->>'pickup')::boolean,true),coalesce((stop->>'dropoff')::boolean,true));
   position:=position+1;
 END LOOP;
 RETURN route_id;
END
$$;

CREATE OR REPLACE FUNCTION public.v31_reserve_seats(
 p_route uuid,p_seats smallint,p_idempotency uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); route public.v31_routes%rowtype;
        vehicle_capacity smallint; route_reserved integer; vehicle_reserved integer;
        existing public.v31_bookings%rowtype; booking uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_seats IS NULL OR p_seats<1 OR p_seats>13 OR p_idempotency IS NULL
 THEN RAISE EXCEPTION 'INVALID_BOOKING'; END IF;
 SELECT * INTO existing FROM public.v31_bookings
 WHERE rider_id=uid AND idempotency_key=p_idempotency;
 IF FOUND THEN
   IF existing.route_id<>p_route OR existing.seats<>p_seats THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   IF existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
   RETURN existing.id;
 END IF;
 SELECT * INTO route FROM public.v31_routes WHERE id=p_route FOR UPDATE;
 IF NOT FOUND OR route.status<>'published' THEN RAISE EXCEPTION 'ROUTE_NOT_AVAILABLE'; END IF;
 IF route.captain_id=uid THEN RAISE EXCEPTION 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; END IF;
 -- Recheck after locking the route: an identical concurrent retry may have committed.
 SELECT * INTO existing FROM public.v31_bookings
 WHERE rider_id=uid AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF existing.route_id<>p_route OR existing.seats<>p_seats
  THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  IF existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
  RETURN existing.id;
 END IF;
 IF route.vehicle_id IS NOT NULL THEN
   SELECT seats INTO vehicle_capacity FROM public.v31_vehicles
   WHERE id=route.vehicle_id AND status='active' FOR UPDATE;
   IF vehicle_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE'; END IF;
   SELECT coalesce(sum(b.seats),0) INTO vehicle_reserved
   FROM public.v31_bookings b JOIN public.v31_routes r ON r.id=b.route_id
   WHERE r.vehicle_id=route.vehicle_id AND b.status IN ('pending','confirmed');
   IF vehicle_reserved+p_seats>vehicle_capacity
   THEN RAISE EXCEPTION 'VEHICLE_SEAT_CAPACITY_EXCEEDED'; END IF;
 END IF;
 SELECT coalesce(sum(seats),0) INTO route_reserved FROM public.v31_bookings
 WHERE route_id=p_route AND status IN ('pending','confirmed');
 IF route_reserved+p_seats>route.seat_capacity THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
 INSERT INTO public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 VALUES(p_route,uid,p_seats,p_idempotency,'pending')
 ON CONFLICT(rider_id,idempotency_key) DO NOTHING RETURNING id INTO booking;
 IF booking IS NOT NULL THEN RETURN booking; END IF;
 SELECT * INTO existing FROM public.v31_bookings
 WHERE rider_id=uid AND idempotency_key=p_idempotency FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENCY_RETRY_NOT_FOUND'; END IF;
 IF existing.route_id<>p_route OR existing.seats<>p_seats
 THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 IF existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
 RETURN existing.id;
END
$$;

CREATE OR REPLACE FUNCTION public.v31_accept_trip_offer(p_offer uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); offer public.v31_trip_offers%rowtype;
        request public.v31_trip_requests%rowtype; route public.v31_routes%rowtype;
        physical_capacity smallint; reserved integer; booking uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO offer FROM public.v31_trip_offers WHERE id=p_offer;
 IF NOT FOUND THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
 SELECT * INTO request FROM public.v31_trip_requests WHERE id=offer.request_id FOR UPDATE;
 IF NOT FOUND OR request.rider_id<>uid THEN RAISE EXCEPTION 'NOT_REQUEST_OWNER'; END IF;
 IF request.status='accepted' AND request.accepted_offer_id=p_offer THEN
   SELECT id INTO booking FROM public.v31_bookings WHERE rider_id=uid AND idempotency_key=request.id;
   IF booking IS NOT NULL THEN RETURN booking; END IF;
 END IF;
 IF request.status<>'open' OR offer.status<>'offered' THEN RAISE EXCEPTION 'REQUEST_NOT_AVAILABLE'; END IF;
 SELECT * INTO route FROM public.v31_routes WHERE id=offer.route_id FOR UPDATE;
 IF NOT FOUND OR route.status<>'published' OR route.captain_id<>offer.captain_id
 THEN RAISE EXCEPTION 'ROUTE_NOT_AVAILABLE'; END IF;
 IF route.captain_id=uid THEN RAISE EXCEPTION 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; END IF;
 IF route.period<>request.period OR route.outbound_time IS DISTINCT FROM request.outbound_time
   OR route.direction='return' THEN RAISE EXCEPTION 'ROUTE_SCHEDULE_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
   WHERE cp.user_id=route.captain_id AND cp.approval_status='approved')
 THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_route_stops o JOIN public.v31_route_stops d
   ON o.route_id=d.route_id AND o.position<d.position
   WHERE o.route_id=route.id AND o.area_id=request.origin_area_id
     AND d.area_id=request.destination_area_id AND o.pickup_allowed AND d.dropoff_allowed)
 THEN RAISE EXCEPTION 'ROUTE_NOT_MATCHING_REQUEST'; END IF;
 IF route.vehicle_id IS NOT NULL THEN
   SELECT seats INTO physical_capacity FROM public.v31_vehicles
   WHERE id=route.vehicle_id AND status='active' FOR UPDATE;
   IF physical_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE'; END IF;
   SELECT coalesce(sum(b.seats),0) INTO reserved
   FROM public.v31_bookings b JOIN public.v31_routes r ON r.id=b.route_id
   WHERE r.vehicle_id=route.vehicle_id AND b.status IN ('pending','confirmed');
   IF reserved+request.seats>physical_capacity
   THEN RAISE EXCEPTION 'VEHICLE_SEAT_CAPACITY_EXCEEDED'; END IF;
 END IF;
 SELECT coalesce(sum(b.seats),0) INTO reserved FROM public.v31_bookings b
 WHERE b.route_id=route.id AND b.status IN ('pending','confirmed');
 IF reserved+request.seats>route.seat_capacity THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
 INSERT INTO public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 VALUES(route.id,uid,request.seats,request.id,'pending') RETURNING id INTO booking;
 UPDATE public.v31_trip_offers SET status='accepted' WHERE id=p_offer;
 UPDATE public.v31_trip_offers SET status='rejected'
 WHERE request_id=request.id AND id<>p_offer AND status='offered';
 UPDATE public.v31_trip_requests SET status='accepted',accepted_offer_id=p_offer
 WHERE id=request.id;
 RETURN booking;
END
$$;

CREATE OR REPLACE FUNCTION public.v31_set_route_status(p_route uuid,p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE uid uuid:=(SELECT auth.uid()); route public.v31_routes%rowtype; active_bookings integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_status NOT IN ('paused','published','archived') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO route FROM public.v31_routes WHERE id=p_route FOR UPDATE;
 IF NOT FOUND OR route.captain_id<>uid THEN RAISE EXCEPTION 'ROUTE_NOT_OWNED'; END IF;
 IF route.status='draft' AND p_status='published' THEN NULL;
 ELSIF route.status='published' AND p_status='paused' THEN NULL;
 ELSIF route.status='paused' AND p_status IN ('published','archived') THEN NULL;
 ELSIF route.status='published' AND p_status='archived' THEN NULL;
 ELSE RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 IF p_status='published' AND NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
   WHERE cp.user_id=uid AND cp.approval_status='approved')
 THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 IF p_status='archived' THEN
   SELECT count(*) INTO active_bookings FROM public.v31_bookings
   WHERE route_id=p_route AND status IN ('pending','confirmed');
   IF active_bookings>0 THEN RAISE EXCEPTION 'ACTIVE_BOOKINGS_PREVENT_ARCHIVE'; END IF;
 END IF;
 UPDATE public.v31_routes SET status=p_status WHERE id=p_route;
 RETURN p_status;
END
$$;

REVOKE ALL ON FUNCTION public.v31_save_captain_application(text,text,text,smallint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_save_captain_application(text,smallint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_save_captain_vehicle_intent(text,bigint,bigint,smallint,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_save_captain_vehicle_intent(text,text,smallint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.v31_submit_captain_application() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_admin_decide_captain(uuid,text,text,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_admin_decide_captain(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_create_route_draft(text,text,smallint,text,text,time,time,boolean,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.v31_create_vehicle_route_draft(text,uuid,text,text,text,time,time,boolean,integer,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_reserve_seats(uuid,smallint,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_accept_trip_offer(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.v31_set_route_status(uuid,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.v31_save_captain_application(text,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_save_captain_application(text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_save_captain_vehicle_intent(text,bigint,bigint,smallint,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_submit_captain_application() TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_admin_decide_captain(uuid,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_admin_decide_captain(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_create_vehicle_route_draft(text,uuid,text,text,text,time,time,boolean,integer,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_reserve_seats(uuid,smallint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_accept_trip_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v31_set_route_status(uuid,text) TO authenticated;

COMMENT ON TABLE public.v31_vehicle_makes IS 'Versioned, Admin-extensible vehicle manufacturer catalog.';
COMMENT ON TABLE public.v31_vehicle_models IS 'Versioned, Admin-extensible models linked to a manufacturer.';
COMMENT ON COLUMN public.v31_vehicles.seats IS 'Passenger capacity for newly approved vehicles is server-owned; route capacity is always category-specific.';
COMMENT ON COLUMN public.v31_routes.vehicle_id IS 'Approved physical vehicle used by this offering; required for all newly published routes.';


-- Reviewed existing Staging migration 20261117183000_v31_captain_quality_document_upload.sql (already tested on Staging)
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
