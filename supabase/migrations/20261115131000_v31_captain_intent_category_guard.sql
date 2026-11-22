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