-- Admin-only Google sign-in address for a selected Captain application.
-- An account's Auth email must never be copied from a user-editable profile.
-- IMPORTANT: deploy to Staging first; Production requires an independent release gate.
create or replace function public.v31_admin_captain_login_email(p_captain uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not (select public.v31_is_admin()) then
  raise exception 'ADMIN_REQUIRED' using errcode='42501';
 end if;
 if p_captain is null then
  raise exception 'CAPTAIN_REQUIRED' using errcode='22023';
 end if;
 -- Only return an Auth email for a real Captain application. Never expose
 -- arbitrary auth.users rows, and never trust a client-provided email.
 return (
  select u.email
  from public.v31_captain_applications as a
  join auth.users as u on u.id = a.user_id
  where a.user_id = p_captain
  limit 1
 );
end;
$$;

revoke all on function public.v31_admin_captain_login_email(uuid) from public, anon, authenticated;
grant execute on function public.v31_admin_captain_login_email(uuid) to authenticated;
