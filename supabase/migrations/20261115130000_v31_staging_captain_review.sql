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
