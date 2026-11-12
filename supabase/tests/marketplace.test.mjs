import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const require = createRequire(
  new URL("../../web/package.json", import.meta.url),
);
const EmbeddedPostgres = require("embedded-postgres").default;
const { Client } = require("pg");
let cluster, db, port;
const captain = randomUUID(),
  rider = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  vehicle = randomUUID(),
  route = randomUUID();
const connection = () =>
  new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "local-test-only",
    database: "postgres",
  });
async function as(client, user, op, payload = {}) {
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  await client.query(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return (
      await client.query("select public.sekka_v2_api($1,$2::jsonb) value", [
        op,
        JSON.stringify(payload),
      ])
    ).rows[0].value;
  } finally {
    await client.query("reset role");
  }
}
async function fund(user, amount = 200) {
  await db.query(
    "insert into sekka_v2.ledger(user_id,available_delta,reserved_delta,reference,kind) values($1,$2,0,$3,'provider_credit')",
    [user, amount, randomUUID()],
  );
}
async function quote(client = db) {
  return as(client, rider, "quote", {
    routeId: route,
    period: "weekly",
    direction: "outbound",
  });
}
async function book(
  client,
  user,
  q,
  key = randomUUID(),
  direction = "outbound",
  period = "weekly",
) {
  return as(client, user, "book", {
    routeId: route,
    period,
    direction,
    expectedQuote: q,
    idempotencyKey: key,
  });
}
before(async () => {
  port = 20000 + Math.floor(Math.random() * 20000);
  cluster = new EmbeddedPostgres({
    databaseDir: await mkdtemp(join(tmpdir(), "sekka-pg-")),
    port,
    user: "postgres",
    password: "local-test-only",
    persistent: false,
    postgresFlags: ["-c", "unix_socket_directories="],
    autoRehydrateSymlinks: true,
    onLog: () => {},
    onError: (e) => console.error(String(e)),
  });
  await cluster.initialise();
  await cluster.start();
  db = connection();
  await db.connect();
  await db.query(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`,
  );
  const migration = await readFile(
    new URL(
      "../migrations/20261112084606_subscription_marketplace_v2.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(migration);
  await db.query(await readFile(new URL("../migrations/20261112214616_map74_booking_privacy.sql", import.meta.url), "utf8"));
  await db.query("update sekka_v2.settings set legal_terms_approved=true");
  for (const [id, role] of [
    [captain, "captain"],
    [rider, "rider"],
    [other, "rider"],
    [admin, "rider"],
  ]) {
    await db.query("insert into auth.users values($1)", [id]);
    await as(db, id, "profile.save", {
      name: "Test " + role,
      role,
      policyVersion: "2026-11-12",
    });
  }
  await db.query("insert into sekka_v2.staff values($1,'administration')", [
    admin,
  ]);
  await db.query(
    "update sekka_v2.captains set status='approved' where user_id=$1",
    [captain],
  );
  await db.query(
    "insert into sekka_v2.vehicles(id,captain_id,category,model,plate,status) values($1,$2,'PRIME','test car','test plate','approved')",
    [vehicle, captain],
  );
  await db.query(
    "update sekka_v2.settings set calendar_from='2024-01-01',calendar_through='2030-12-31',holiday_source='TEST FIXTURE ONLY'",
  );
  await db.query(
    "insert into sekka_v2.routes(id,captain_id,vehicle_id,origin,destination,outbound,return_time,anchor,seats,category,status) values($1,$2,$3,'مدينة نصر','التجمع','07:30','17:00','2026-01-04',1,'PRIME','active')",
    [route, captain, vehicle],
  );
  for (const period of ["weekly", "monthly"])
    for (const dir of ["outbound", "return", "round_trip"])
      await db.query("insert into sekka_v2.prices values($1,$2,$3,$4)", [
        route,
        period,
        dir,
        period === "weekly" ? 1000 : 4000,
      ]);
});
after(async () => {
  if (db) await db.end();
  if (cluster) await cluster.stop();
});
test("migration creates RLS on every new table and does not expose table writes", async () => {
  const { rows } = await db.query(
    "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sekka_v2' and relkind='r' and not relrowsecurity",
  );
  assert.deepEqual(rows, []);
  await db.query("set role authenticated");
  try {
    await assert.rejects(
      db.query("select * from sekka_v2.ledger"),
      /permission denied/,
    );
  } finally {
    await db.query("reset role");
  }
});
test("public discovery and authentication boundaries", async () => {
  const rs = await as(db, null, "search", {
    origin: "مدينة",
    direction: "round_trip",
  });
  assert.equal(rs.length, 1);
  assert.equal(rs[0].category, "PRIME");
  assert.equal(rs[0].captain_id, undefined);
  await assert.rejects(as(db, null, "wallet"), /AUTH_REQUIRED/);
  await assert.rejects(
    as(db, rider, "admin.list", { resource: "profiles" }),
    /FORBIDDEN/,
  );
  const rs2 = await as(db, null, "search", { departure: "09:00" });
  assert.equal(rs2.length, 0);
});
test("server prices match approved independent calendar examples", async () => {
  const r = await db.query(
    "select sekka_v2.quote($1,'weekly','outbound','2026-11-08T08:00:00Z') q",
    [route],
  );
  assert.equal(r.rows[0].q.price, 800);
  assert.equal(r.rows[0].q.remainingDays, 4);
  const m = await db.query(
    "select sekka_v2.boundary('2025-01-31','monthly',2)::text d",
  );
  assert.equal(m.rows[0].d, "2025-03-31");
});
test("real-money gate fails closed", async () => {
  await assert.rejects(book(db, rider, await quote()), /REAL_MONEY_DISABLED/);
  await assert.rejects(
    as(db, rider, "wallet.topup"),
    /POLICY_OR_PROVIDER_APPROVAL_REQUIRED/,
  );
});
test("holiday coverage blocks pricing when not approved", async () => {
  await db.query(
    "update sekka_v2.settings set calendar_from=null,calendar_through=null",
  );
  await assert.rejects(quote(), /HOLIDAY_CALENDAR_UNAPPROVED/);
  await db.query(
    "update sekka_v2.settings set calendar_from='2024-01-01',calendar_through='2030-12-31'",
  );
});
let reserved;
test("two concurrent riders cannot reserve the last seat", async () => {
  await db.query(
    "update sekka_v2.settings set payment_partner_approved=true,financial_policies_approved=true,real_money_enabled=true",
  );
  await fund(rider);
  await fund(other);
  const a = connection(),
    b = connection();
  await Promise.all([a.connect(), b.connect()]);
  try {
    const q = await quote();
    const results = await Promise.allSettled([
      book(a, rider, q),
      book(b, other, q),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(
      results.find((r) => r.status === "rejected").reason.message,
      /SOLD_OUT/,
    );
    reserved = results.find((r) => r.status === "fulfilled").value;
    const count = await db.query(
      "select count(*)::int n from sekka_v2.bookings where route_id=$1",
      [route],
    );
    assert.equal(count.rows[0].n, 1);
  } finally {
    await Promise.all([a.end(), b.end()]);
  }
});
test("idempotent booking retries reserve once, payload changes rejected", async () => {
  const user = reserved.rider_id;
  const q = await quote();
  const payload = {
    routeId: route,
    period: "weekly",
    direction: "outbound",
    expectedQuote: q,
    idempotencyKey: reserved.idempotency_key,
  };
  const again = await as(db, user, "book", payload);
  assert.equal(again.id, reserved.id);
  await assert.rejects(
    as(db, user, "book", { ...payload, direction: "return" }),
    /IDEMPOTENCY_CONFLICT/,
  );
  const w = await as(db, user, "wallet");
  assert.equal(w.balance.reserved, 100);
  assert.equal(w.transactions.filter((l) => l.kind === "reserve").length, 1);
});
test("cross-period reservation also prevents oversell and quote forgery", async () => {
  const user = reserved.rider_id === rider ? other : rider;
  const q = await as(db, user, "quote", {
    routeId: route,
    period: "monthly",
    direction: "outbound",
  });
  await assert.rejects(
    book(db, user, q, randomUUID(), "outbound", "monthly"),
    /SOLD_OUT/,
  );
  const w = await quote();
  await assert.rejects(book(db, user, { ...w, price: 1 }), /QUOTE_CHANGED/);
});
test("opposite directions may share a physical seat but round trip cannot oversell", async () => {
  const user = reserved.rider_id === rider ? other : rider;
  const q = await as(db, user, "quote", {
    routeId: route,
    period: "weekly",
    direction: "return",
  });
  await book(db, user, q, randomUUID(), "return");
  const both = await as(db, user, "quote", {
    routeId: route,
    period: "weekly",
    direction: "round_trip",
  });
  await assert.rejects(
    book(db, user, both, randomUUID(), "round_trip"),
    /SOLD_OUT/,
  );
});
test("immutable snapshot and append-only ledger enforced", async () => {
  await assert.rejects(
    db.query("update sekka_v2.bookings set price=1 where id=$1", [reserved.id]),
    /BOOKING_SNAPSHOT_IMMUTABLE/,
  );
  await assert.rejects(db.query("delete from sekka_v2.ledger"), /APPEND_ONLY/);
});
test("payment role and first-service-day restrictions", async () => {
  await assert.rejects(
    as(db, captain, "payment.paid", { bookingId: reserved.id }),
    /FORBIDDEN|PAYMENT_TOO_EARLY/,
  );
  await assert.rejects(
    as(db, reserved.rider_id, "payment.paid", { bookingId: reserved.id }),
    /PAYMENT_TOO_EARLY/,
  );
});
let todayBooking;
test("fixture starts today for payment state tests; both confirmations release only once", async () => {
  const date = (
    await db.query("select (now() at time zone 'Africa/Cairo')::date::text d")
  ).rows[0].d;
  const cy = await db.query(
    "insert into sekka_v2.cycles(route_id,period,starts_on,ends_before) values($1,'weekly',$2::date,$2::date+7) on conflict(route_id,period,starts_on) do update set starts_on=excluded.starts_on returning id",
    [route, date],
  );
  await fund(rider);
  const b = await db.query(
    "insert into sekka_v2.bookings(rider_id,route_id,cycle_id,direction,starts_on,ends_before,full_price,price,total_days,remaining_days,idempotency_key) values($1,$2,$3,'outbound',$4::date,$4::date+7,1000,1000,5,5,$5) returning *",
    [rider, route, cy.rows[0].id, date, randomUUID()],
  );
  todayBooking = b.rows[0];
  await db.query(
    "insert into sekka_v2.reservations values($1,$2,100,'reserved',null)",
    [todayBooking.id, rider],
  );
  await db.query(
    "insert into sekka_v2.ledger(user_id,booking_id,available_delta,reserved_delta,reference,kind) values($1,$2,-100,100,$3,'reserve')",
    [rider, todayBooking.id, "reserve:" + todayBooking.id],
  );
  await assert.rejects(
    as(db, captain, "payment.received", { bookingId: todayBooking.id }),
    /RIDER_CONFIRMATION_REQUIRED/,
  );
  await as(db, rider, "payment.paid", { bookingId: todayBooking.id });
  let b1 = (
    await db.query("select status from sekka_v2.bookings where id=$1", [
      todayBooking.id,
    ])
  ).rows[0];
  assert.equal(b1.status, "reserved");
  const after = await as(db, captain, "payment.received", {
    bookingId: todayBooking.id,
  });
  assert.equal(after.status, "confirmed");
  const a = connection(),
    b2 = connection();
  await Promise.all([a.connect(), b2.connect()]);
  try {
    await Promise.all([
      as(a, captain, "payment.received", { bookingId: todayBooking.id }),
      as(b2, captain, "payment.received", { bookingId: todayBooking.id }),
    ]);
  } finally {
    await Promise.all([a.end(), b2.end()]);
  }
  const n = (
    await db.query(
      "select count(*)::int n from sekka_v2.ledger where booking_id=$1 and kind='release'",
      [todayBooking.id],
    )
  ).rows[0].n;
  assert.equal(n, 1);
  const notices = await as(db, rider, "notifications");
  assert.equal(notices.filter((n) => n.body.includes("تأمينك متاح")).length, 1);
});
test("disputes hold reserved security, no timeout forfeiture", async () => {
  const before = await as(db, reserved.rider_id, "wallet");
  await as(db, reserved.rider_id, "dispute.open", {
    bookingId: reserved.id,
    reason: "Test dispute held for review",
  });
  const after = await as(db, reserved.rider_id, "wallet");
  assert.deepEqual(after.balance, before.balance);
  await assert.rejects(
    as(db, captain, "payment.received", { bookingId: reserved.id }),
    /BOOKING_NOT_CONFIRMABLE/,
  );
});
test("messages protected between parties; profile cannot escalate permissions", async () => {
  const c = await as(db, rider, "conversation.open", { captainId: captain });
  await as(db, rider, "message.send", {
    conversationId: c.id,
    body: "اختبار رسالة",
  });
  await assert.rejects(
    as(db, other, "messages", { conversationId: c.id }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    as(db, rider, "profile.save", {
      name: "Admin",
      role: "admin",
      policyVersion: "2026-11-12",
    }),
    /INVALID_PROFILE/,
  );
  const result = await as(db, admin, "admin.list", { resource: "analytics" });
  assert.equal(typeof result.confirmedSeats, "number");
});
test("document storage ownership policies enforce private paths", async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    rider,
  ]);
  await db.query("set role authenticated");
  try {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('sekka-v2-documents',$1)",
      [rider + "/test.png"],
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('sekka-v2-documents',$1)",
        [other + "/test.png"],
      ),
      /row-level security/,
    );
    const rows = await db.query("select * from storage.objects");
    assert.equal(rows.rows.length, 1);
  } finally {
    await db.query("reset role");
  }
});

test("remaining RPC reads and mutations are real and owned", async () => {
  assert.equal((await as(db, null, "route", { id: route })).plate, undefined);
  await as(db, rider, "favorite.toggle", { routeId: route });
  assert.equal((await as(db, rider, "favorites")).length, 1);
  await as(db, rider, "favorite.toggle", { routeId: route });
  assert.equal((await as(db, rider, "favorites")).length, 0);
  await as(db, rider, "waitlist.join", { routeId: route });
  await as(db, rider, "waitlist.join", { routeId: route });
  await as(db, rider, "request.create", {
    origin: "مدينة نصر",
    destination: "التجمع",
    departure: "07:30",
    direction: "round_trip",
  });
  await as(db, rider, "support.create", { body: "محتاج مساعدة في الاشتراك" });
  assert.ok((await as(db, captain, "captain.routes")).length);
  assert.ok((await as(db, captain, "captain")).vehicle);
  assert.ok((await as(db, captain, "bookings")).length);
  const w = await as(db, rider, "wallet");
  const total = Number(w.balance.available) + Number(w.balance.reserved);
  assert.equal(total, 400);
  await assert.rejects(as(db, rider, "unknown"), /UNKNOWN_OPERATION/);
  await db.query("update sekka_v2.settings set legal_terms_approved=false");
  await assert.rejects(
    as(db, rider, "profile.save", {
      name: "User",
      role: "rider",
      policyVersion: "2026-11-12",
    }),
    /LEGAL_TERMS_UNAPPROVED/,
  );
});
test("concurrent reservations cannot overspend one wallet across requests", async () => {
  const user = randomUUID();
  await db.query("insert into auth.users values($1)", [user]);
  await db.query("update sekka_v2.settings set legal_terms_approved=true");
  await as(db, user, "profile.save", {
    name: "Concurrent wallet",
    role: "rider",
    policyVersion: "2026-11-12",
  });
  await fund(user, 100);
  await db.query(
    "update sekka_v2.routes set seats=13,category='MAX' where id=$1",
    [route],
  );
  const q = await quote(),
    a = connection(),
    b = connection();
  await Promise.all([a.connect(), b.connect()]);
  try {
    const results = await Promise.allSettled([
      book(a, user, q),
      book(b, user, q),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.match(
      results.find((x) => x.status === "rejected").reason.message,
      /INSUFFICIENT_SECURITY/,
    );
  } finally {
    await Promise.all([a.end(), b.end()]);
  }
  const wallet = await as(db, user, "wallet");
  assert.deepEqual(wallet.balance, { available: 0, reserved: 100 });
});
test("concurrent identical booking retries return the same reservation", async () => {
  const user = randomUUID();
  await db.query("insert into auth.users values($1)", [user]);
  await as(db, user, "profile.save", {
    name: "Idempotent retry",
    role: "rider",
    policyVersion: "2026-11-12",
  });
  await fund(user, 100);
  await db.query(
    "update sekka_v2.routes set seats=13,category='MAX' where id=$1",
    [route],
  );
  const q = await quote(),
    key = randomUUID(),
    a = connection(),
    b = connection();
  await Promise.all([a.connect(), b.connect()]);
  try {
    const results = await Promise.all([
      book(a, user, q, key),
      book(b, user, q, key),
    ]);
    assert.equal(results[0].id, results[1].id);
  } finally {
    await Promise.all([a.end(), b.end()]);
  }
  assert.equal((await as(db, user, "wallet")).transactions.length, 2);
});

 test("map74 hides identity on public reads and gates contacts by owned booking", async()=>{
  const publicRoutes=await as(db,null,"search",{});
  const detail=await as(db,null,"route",{id:route});
  for(const row of [...publicRoutes,detail]) for(const key of ["captain_id","captain_name","vehicle_id","vehicle_model","model","plate"]) assert.equal(row[key],undefined);
  await assert.rejects(as(db,null,"booking.contact",{bookingId:reserved.id}),/AUTH_REQUIRED/);
  await assert.rejects(as(db,admin,"booking.contact",{bookingId:reserved.id}),/CONFIRMED_BOOKING_REQUIRED/);
  await assert.rejects(as(db,admin,"conversation.open",{captainId:captain}),/CONFIRMED_BOOKING_REQUIRED/);
  const contact=await as(db,rider,"booking.contact",{bookingId:reserved.id});
  assert.equal(contact.captain_id,captain);
  assert.equal(contact.plate,"test plate");
  const grants=await db.query("select has_function_privilege('authenticated','sekka_v2.api_before_map74(text,jsonb)','execute') allowed");
  assert.equal(grants.rows[0].allowed,false);
 });
