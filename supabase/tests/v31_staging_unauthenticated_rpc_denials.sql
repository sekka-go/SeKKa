-- Run ONLY on staging zgcvumykzivsvnlflbyp.
-- Negative authorization checks without JWT; no user data, impersonation, or DML.
-- Not a replacement for two Google-authenticated sessions.
begin;
set local role authenticated;
do $tests$ declare v text;
begin
 if auth.uid() is not null then raise exception 'NOT_ANONYMOUS_SESSION';end if;
 if public.v31_is_admin() is distinct from false then raise exception 'ADMIN_LEAK';end if;
  begin execute 'select public.v31_admin_overview()';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'ADMIN_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_reserve_seats(''00000000-0000-4000-8000-000000000001''::uuid,1::smallint,''00000000-0000-4000-8000-000000000002''::uuid)';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_reserve_seats_with_stops(''00000000-0000-4000-8000-000000000001''::uuid,1::smallint,''00000000-0000-4000-8000-000000000002''::uuid,''00000000-0000-4000-8000-000000000003''::uuid,''00000000-0000-4000-8000-000000000004''::uuid,false)';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_accept_trip_offer(''00000000-0000-4000-8000-000000000001''::uuid)';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_cancel_pending_booking(''00000000-0000-4000-8000-000000000001''::uuid)';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_cancel_trip_request(''00000000-0000-4000-8000-000000000001''::uuid)';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
  begin execute 'select public.v31_set_route_status(''00000000-0000-4000-8000-000000000001''::uuid,''archived'')';raise exception 'EXPECTED_DENIAL_MISSING'; exception when others then get stacked diagnostics v=message_text; if v<>'AUTH_REQUIRED' then raise exception 'UNEXPECTED_DENIAL %',v;end if;end;
end $tests$;
rollback;
