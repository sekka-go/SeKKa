-- Staging only. Notification messages and event kinds are written by
-- authenticated server-side triggers; a client can only acknowledge an
-- existing notification addressed to them.
revoke insert,update,delete on public.v31_notifications from anon,authenticated;
revoke select on public.v31_notifications from anon;
grant update(read_at) on public.v31_notifications to authenticated;

-- A malicious client must not backdate, clear, or otherwise forge the
-- timestamp. Normalise first acknowledgment to the database clock and keep
-- existing acknowledgments immutable.
create or replace function public.v31_stamp_notification_read()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if old.read_at is null then
   new.read_at:=now();
 else
   new.read_at:=old.read_at;
 end if;
 return new;
end $$;
revoke all on function public.v31_stamp_notification_read() from public,anon,authenticated;
drop trigger if exists v31_stamp_notification_read on public.v31_notifications;
create trigger v31_stamp_notification_read
before update of read_at on public.v31_notifications
for each row execute function public.v31_stamp_notification_read();
