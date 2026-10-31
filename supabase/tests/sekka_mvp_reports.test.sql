begin;
select plan(5);

create temporary table sekka_report_test_ids as
select gen_random_uuid() as fixture_key;

insert into public.users (full_name, phone_number, password_hash, role)
select 'Test report admin ' || fixture_key, 'test-admin-' || fixture_key, 'not-a-real-password-hash', 'admin'
from sekka_report_test_ids;
insert into public.users (full_name, phone_number, password_hash, role)
select 'Test report reporter ' || fixture_key, 'test-reporter-' || fixture_key, 'not-a-real-password-hash', 'rider'
from sekka_report_test_ids;
insert into public.users (full_name, phone_number, password_hash, role)
select 'Test report subject ' || fixture_key, 'test-subject-' || fixture_key, 'not-a-real-password-hash', 'captain'
from sekka_report_test_ids;

insert into public.super_admins (user_id, note)
select u.id, 'Temporary pgTAP fixture'
from public.users u cross join sekka_report_test_ids f
where u.full_name = 'Test report admin ' || f.fixture_key;

insert into public.user_reports (reporter_user_id, subject_type, subject_user_id, category, description)
select reporter.id, 'user', subject.id, 'fraud', 'Temporary test report description for review flow.'
from public.users reporter
cross join public.users subject
cross join sekka_report_test_ids f
where reporter.full_name = 'Test report reporter ' || f.fixture_key
  and subject.full_name = 'Test report subject ' || f.fixture_key;

select is(
  (select r.status from public.user_reports r join public.users u on u.id = r.reporter_user_id cross join sekka_report_test_ids f where u.full_name = 'Test report reporter ' || f.fixture_key),
  'submitted',
  'new report enters the submitted queue'
);

select lives_ok(
  $$select public.admin_review_user_report(
    (select id from public.users u cross join sekka_report_test_ids f where u.full_name = 'Test report admin ' || f.fixture_key),
    (select r.id from public.user_reports r join public.users u on u.id = r.reporter_user_id cross join sekka_report_test_ids f where u.full_name = 'Test report reporter ' || f.fixture_key),
    'in_review', null, null, 'Initial review started by test admin', null
  )$$,
  'authorized admin can atomically move a report to review and write its audit entry'
);

select is(
  (select r.status from public.user_reports r join public.users u on u.id = r.reporter_user_id cross join sekka_report_test_ids f where u.full_name = 'Test report reporter ' || f.fixture_key),
  'in_review',
  'review status is persisted'
);

select is(
  (select count(*)::integer from public.admin_audit_logs a join public.user_reports r on a.resource_id = r.id::text cross join sekka_report_test_ids f join public.users u on u.id = r.reporter_user_id where a.resource_type = 'user_report' and u.full_name = 'Test report reporter ' || f.fixture_key),
  1,
  'review action creates one audit log entry'
);

select throws_ok(
  $$select public.admin_review_user_report(
    (select id from public.users u cross join sekka_report_test_ids f where u.full_name = 'Test report reporter ' || f.fixture_key),
    (select r.id from public.user_reports r join public.users u on u.id = r.reporter_user_id cross join sekka_report_test_ids f where u.full_name = 'Test report reporter ' || f.fixture_key),
    'reviewed', 'no_violation', 'should not be saved', 'unauthorized reviewer test', null
  )$$,
  '42501', 'not authorized',
  'non-admin reviewer is rejected'
);

select * from finish();
rollback;
