-- seKKa: P0 Captain capacity transitions, staging only.
-- Do not schedule an operational departure or mutate the approved recurring
-- service-line lifecycle. The trigger emits factual capacity-change notices.
-- All writes occur in the same transaction as booking/cancellation, so an
-- unsuccessful reservation cannot leave a "full" notification behind.
create or replace function public.v31_notify_route_capacity_transition()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_captain uuid;
 v_capacity integer;
 v_filled integer;
 v_filled_now boolean:=false;
 v_reopened boolean:=false;
begin
 if tg_op='INSERT' then
   v_filled_now:=new.status in ('pending','confirmed');
 elsif tg_op='UPDATE' and old.status is distinct from new.status then
   v_filled_now:=old.status not in ('pending','confirmed')
                and new.status in ('pending','confirmed');
   v_reopened:=old.status in ('pending','confirmed')
               and new.status not in ('pending','confirmed');
 else
   return new;
 end if;
 if not v_filled_now and not v_reopened then return new;end if;

 select r.captain_id,r.seat_capacity into v_captain,v_capacity
 from public.v31_routes r
 where r.id=new.route_id and r.status in ('published','paused');
 if not found or v_captain is null or v_capacity<1 then return new;end if;

 select coalesce(sum(b.seats),0)::integer into v_filled
 from public.v31_bookings b
 where b.route_id=new.route_id and b.status in ('pending','confirmed');

 if v_filled_now and v_filled=v_capacity then
   insert into public.v31_notifications(user_id,kind,entity_id,message_ar,message_en)
   values(v_captain,'route_capacity_full',new.route_id,
     'اكتملت مقاعد الخط. موعد الانطلاق النهائي لم يتحدد بعد؛ تابع حالة الرحلة قبل تأكيد أي موعد.',
     'All route seats are reserved. The final departure date is not confirmed; review the trip before confirming any date.');
 elsif v_reopened and v_filled+old.seats=v_capacity and v_filled<v_capacity then
   insert into public.v31_notifications(user_id,kind,entity_id,message_ar,message_en)
   values(v_captain,'route_seat_reopened',new.route_id,
     'اتلغى حجز بعد اكتمال المقاعد. فيه مقاعد متاحة من جديد، وأي موعد سابق محتاج مراجعة قبل اعتماده.',
     'A booking was cancelled after full capacity. Seats are available again; any previous departure plan needs review.');
 end if;
 return new;
end $$;
revoke all on function public.v31_notify_route_capacity_transition()
 from public,anon,authenticated;

drop trigger if exists v31_route_capacity_on_booking on public.v31_bookings;
create trigger v31_route_capacity_on_booking
after insert or update of status on public.v31_bookings
for each row execute function public.v31_notify_route_capacity_transition();
