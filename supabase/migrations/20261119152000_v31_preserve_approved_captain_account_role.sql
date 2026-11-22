-- STAGING first: reconcile a legacy verified Captain whose approval was
-- granted by Admin but whose older Google login left profile.role_preference
-- as Rider. Only full, server-approved Captains qualify; never promote a
-- Rider from a stale local OAuth role or an unapproved draft.
create or replace function public.v31_enforce_approved_captain_profile_role()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
 if exists (
  select 1 from public.v31_captain_profiles c
  join public.v31_captain_applications a on a.user_id=c.user_id
  where c.user_id=new.user_id
   and c.approval_status='approved' and a.status='approved'
 ) then
  new.role_preference:='captain';
 end if;
 return new;
end;
$$;
revoke all on function public.v31_enforce_approved_captain_profile_role() from public, anon, authenticated;
drop trigger if exists v31_approved_captain_profile_role_guard on public.v31_profiles;
create trigger v31_approved_captain_profile_role_guard
before insert or update of role_preference on public.v31_profiles
for each row execute function public.v31_enforce_approved_captain_profile_role();

-- Preserve all production/staging users and unapproved drafts unchanged.
update public.v31_profiles p
set role_preference='captain',updated_at=now()
where p.role_preference='rider'
  and exists(
    select 1 from public.v31_captain_profiles c
    join public.v31_captain_applications a on a.user_id=c.user_id
    where c.user_id=p.user_id
      and c.approval_status='approved' and a.status='approved'
  );
