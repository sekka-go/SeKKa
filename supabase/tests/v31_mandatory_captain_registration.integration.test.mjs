import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const require=createRequire(new URL('../../web/package.json',import.meta.url));
const EmbeddedPostgres=require('embedded-postgres').default;
const {Client}=require('pg');
const captain='00000000-0000-0000-0000-000000000001';
const admin='00000000-0000-0000-0000-000000000002';
const rider='00000000-0000-0000-0000-000000000003';
const hiaceCaptain='00000000-0000-0000-0000-000000000004';
let cluster,db,databaseDir,port;

const fixture=`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE TABLE auth.identities(user_id uuid,provider text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
   SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
   SELECT string_to_array($1,'/')
 $$;
 CREATE TABLE public.v31_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),
   display_name text NOT NULL DEFAULT '',role_preference text NOT NULL DEFAULT 'rider',
   phone_number text,updated_at timestamptz DEFAULT now());
 CREATE TABLE public.v31_captain_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),
   approval_status text NOT NULL DEFAULT 'pending');
 CREATE TABLE public.v31_vehicles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),captain_id uuid NOT NULL,
   model text NOT NULL,plate_number text NOT NULL,category text NOT NULL,seats smallint NOT NULL,
   status text NOT NULL DEFAULT 'active',created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.v31_routes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),captain_id uuid NOT NULL,
   title text NOT NULL,category text NOT NULL,seat_capacity smallint NOT NULL,direction text NOT NULL,
   period text NOT NULL,outbound_time time,return_time time,return_supported boolean NOT NULL DEFAULT false,
   price_egp integer NOT NULL,status text NOT NULL DEFAULT 'draft',created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.v31_service_areas(id bigint PRIMARY KEY,name_ar text NOT NULL,name_en text NOT NULL,
   region text NOT NULL,active boolean NOT NULL DEFAULT true);
 CREATE TABLE public.v31_route_stops(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),route_id uuid NOT NULL,
   area_id bigint NOT NULL,name text NOT NULL,position integer NOT NULL,
   pickup_allowed boolean NOT NULL DEFAULT true,dropoff_allowed boolean NOT NULL DEFAULT true);
 CREATE TABLE public.v31_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),route_id uuid NOT NULL,
   rider_id uuid NOT NULL,seats smallint NOT NULL,status text NOT NULL DEFAULT 'pending',
   idempotency_key uuid NOT NULL,created_at timestamptz DEFAULT now(),cancelled_at timestamptz,
   pickup_stop_id uuid,dropoff_stop_id uuid,booked_direction text,price_snapshot_egp integer,
   period_snapshot text,UNIQUE(rider_id,idempotency_key));
 CREATE TABLE public.v31_trip_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL,
   captain_id uuid NOT NULL,route_id uuid NOT NULL,status text NOT NULL DEFAULT 'offered');
 CREATE TABLE public.v31_trip_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),rider_id uuid NOT NULL,
   origin_area_id bigint NOT NULL,destination_area_id bigint NOT NULL,outbound_time time NOT NULL,
   period text NOT NULL,seats smallint NOT NULL,request_key uuid NOT NULL,status text NOT NULL DEFAULT 'open',
   accepted_offer_id uuid,UNIQUE(rider_id,request_key));
 CREATE TABLE public.v31_captain_applications(user_id uuid PRIMARY KEY REFERENCES auth.users(id),
   status text NOT NULL DEFAULT 'draft',professional_notes text NOT NULL DEFAULT '',
   experience_years smallint,rejection_reason text,submitted_at timestamptz,reviewed_at timestamptz,
   reviewed_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
   updated_at timestamptz NOT NULL DEFAULT now(),intended_vehicle_model text,intended_category text,
   intended_seats smallint,intended_plate text);
 CREATE TABLE public.v31_captain_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   captain_id uuid NOT NULL REFERENCES public.v31_captain_applications(user_id),
   kind text NOT NULL,object_name text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.v31_captain_approval_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   captain_id uuid NOT NULL REFERENCES public.v31_captain_applications(user_id),
   actor_id uuid NOT NULL REFERENCES auth.users(id),decision text NOT NULL,reason text,
   created_at timestamptz NOT NULL DEFAULT now());
 CREATE FUNCTION public.v31_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
   SELECT auth.uid() IS NOT NULL AND auth.uid()='00000000-0000-0000-0000-000000000002'::uuid
 $$;
 CREATE FUNCTION public.v31_save_captain_application(p_notes text DEFAULT '',p_experience smallint DEFAULT NULL)
   RETURNS text LANGUAGE sql AS $$ SELECT 'draft'::text $$;
 CREATE FUNCTION public.v31_save_captain_vehicle_intent(p_model text DEFAULT NULL,p_category text DEFAULT NULL,
   p_seats smallint DEFAULT NULL,p_plate text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$ SELECT 'draft'::text $$;
 CREATE FUNCTION public.v31_submit_captain_application() RETURNS text LANGUAGE sql AS $$
   SELECT 'submitted'::text $$;
 CREATE FUNCTION public.v31_admin_decide_captain(p_captain uuid,p_decision text,p_reason text DEFAULT NULL)
   RETURNS text LANGUAGE sql AS $$ SELECT p_decision $$;
 CREATE FUNCTION public.v31_create_route_draft(p_title text,p_category text,p_capacity smallint,
   p_direction text,p_period text,p_outbound time,p_return time,p_return_supported boolean,
   p_price integer,p_stops jsonb) RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
 CREATE FUNCTION public.v31_reserve_seats(p_route uuid,p_seats smallint,p_idempotency uuid)
   RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
 CREATE FUNCTION public.v31_accept_trip_offer(p_offer uuid) RETURNS uuid LANGUAGE sql AS $$
   SELECT gen_random_uuid() $$;
 CREATE FUNCTION public.v31_set_route_status(p_route uuid,p_status text) RETURNS text LANGUAGE sql AS $$
   SELECT p_status $$;
`;

before(async()=>{
 port=45000+Math.floor(Math.random()*10000);
 databaseDir=await mkdtemp(join(tmpdir(),'sekka-v31-registration-'));
 cluster=new EmbeddedPostgres({databaseDir,port,user:'postgres',password:'local-test-only',
  persistent:false,postgresFlags:['-c','unix_socket_directories='],autoRehydrateSymlinks:true,
  onLog:()=>{},onError:error=>console.error(String(error))});
 await cluster.initialise();await cluster.start();
 db=new Client({host:'127.0.0.1',port,user:'postgres',password:'local-test-only',database:'postgres'});
 await db.connect();await db.query(fixture);
 await db.query(await readFile(new URL('../migrations/20261115150000_v31_mandatory_captain_registration.sql',import.meta.url),'utf8'));
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)',
  [captain,'captain@test.invalid',admin,'admin@test.invalid',rider,'rider@test.invalid']);
 await db.query("INSERT INTO public.v31_profiles(user_id,role_preference) VALUES($1,'captain'),($2,'rider')",[captain,rider]);
 await db.query('INSERT INTO public.v31_captain_profiles(user_id) VALUES($1)',[captain]);
 await db.query("INSERT INTO public.v31_service_areas(id,name_ar,name_en,region,active) VALUES(1,'A','A','Cairo',true),(2,'B','B','Cairo',true)");
});

after(async()=>{
 if(db)await db.end().catch(()=>{});
 if(cluster)await cluster.stop().catch(()=>{});
 if(databaseDir)await rm(databaseDir,{recursive:true,force:true});
});

async function setUser(user){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);}

test('real PostgreSQL enforces mandatory registration, approval, activation, categories and route capacity',async()=>{
 await setUser(captain);
 await assert.rejects(db.query('SELECT public.v31_save_captain_application($1,$2,$3,$4)',
  ['QA Captain Test','01012345678','Professional driver background',-1]),/INVALID_PROFESSIONAL_DETAILS/);
 await db.query('SELECT public.v31_save_captain_application($1,$2,$3,$4)',
  ['QA Captain Test','01012345678','Professional driver background',0]);
 const make=(await db.query("SELECT id FROM public.v31_vehicle_makes WHERE slug='toyota'")).rows[0].id;
 const model=(await db.query("SELECT id FROM public.v31_vehicle_models WHERE make_id=$1 AND slug='corolla'",[make])).rows[0].id;
 await db.query('SELECT public.v31_save_captain_vehicle_intent($1,$2,$3,$4,$5,$6,$7)',
  ['private_car',make,model,2018,'white',null,'STG-LOCAL-1']);
 await assert.rejects(db.query('SELECT public.v31_submit_captain_application()'),/CAPTAIN_DOCUMENTS_INCOMPLETE/);
 for(const kind of ['identity','driving_license','vehicle_license','vehicle_photo']){
  const objectName=`${captain}/${randomUUID()}.png`;
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',
   ['v31-captain-docs-staging',objectName]);
  await db.query('INSERT INTO public.v31_captain_documents(captain_id,kind,object_name) VALUES($1,$2,$3)',
   [captain,kind,objectName]);
 }
 await db.query('SELECT public.v31_submit_captain_application()');
 await setUser(admin);
 await db.query('SELECT public.v31_admin_decide_captain($1,$2,$3,$4)',[captain,'approved',null,null]);
 const vehicle=(await db.query('SELECT id,seats,status,enabled_categories FROM public.v31_vehicles WHERE captain_id=$1',[captain])).rows[0];
 assert.equal(vehicle.seats,4);
 assert.equal(vehicle.status,'active');
 assert.deepEqual(vehicle.enabled_categories,['PRIME','SAVER']);
 assert.deepEqual((await db.query('SELECT category,seat_capacity FROM public.v31_vehicle_service_categories WHERE vehicle_id=$1 ORDER BY category',[vehicle.id])).rows,
  [{category:'PRIME',seat_capacity:3},{category:'SAVER',seat_capacity:4}]);

 await setUser(captain);
 const stops=[{area_id:1,name:'Origin',pickup:true,dropoff:true},{area_id:2,name:'Destination',pickup:true,dropoff:true}];
 const createRoute=async(title)=>db.query(
  'SELECT public.v31_create_vehicle_route_draft($1::text,$2::uuid,$3::text,$4::text,$5::text,$6::time,$7::time,$8::boolean,$9::integer,$10::jsonb) id',
  [title,vehicle.id,'SAVER','outbound','monthly','07:30',null,false,1000,JSON.stringify(stops)]
 );
 const route=(await createRoute('Primary route')).rows[0].id;
 assert.equal((await db.query('SELECT seat_capacity FROM public.v31_routes WHERE id=$1',[route])).rows[0].seat_capacity,4);
 await db.query("UPDATE public.v31_routes SET status='published' WHERE id=$1",[route]);
 const second=(await createRoute('Second route')).rows[0].id;
 await assert.rejects(db.query("UPDATE public.v31_routes SET status='published' WHERE id=$1",[second]),/VEHICLE_HAS_ACTIVE_SERVICE/);

 await setUser(rider);
 const idempotency=randomUUID();
 await db.query('SELECT public.v31_reserve_seats($1,$2,$3)',[route,3,idempotency]);
 await assert.rejects(db.query('SELECT public.v31_reserve_seats($1,$2,$3)',[route,2,randomUUID()]),
  /VEHICLE_SEAT_CAPACITY_EXCEEDED|INSUFFICIENT_SEATS/);
});

test('Hiace eligibility remains Admin-selected and preserves SPACE/MAX capacities',async()=>{
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[hiaceCaptain,'hiace@test.invalid']);
 await db.query("INSERT INTO public.v31_profiles(user_id,role_preference) VALUES($1,'captain')",[hiaceCaptain]);
 await db.query('INSERT INTO public.v31_captain_profiles(user_id) VALUES($1)',[hiaceCaptain]);
 await setUser(hiaceCaptain);
 await db.query('SELECT public.v31_save_captain_application($1,$2,$3,$4)',
  ['Hiace Captain Test','01012345679','Professional route driver',0]);
 const make=(await db.query("SELECT id FROM public.v31_vehicle_makes WHERE slug='toyota'")).rows[0].id;
 const model=(await db.query("SELECT id FROM public.v31_vehicle_models WHERE make_id=$1 AND slug='hiace'",[make])).rows[0].id;
 await db.query('SELECT public.v31_save_captain_vehicle_intent($1,$2,$3,$4,$5,$6,$7)',
  ['hiace',make,model,2022,'other','silver metallic','STG-HIACE-1']);
 for(const kind of ['identity','driving_license','vehicle_license','vehicle_photo']){
  const objectName=`${hiaceCaptain}/${randomUUID()}.png`;
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',
   ['v31-captain-docs-staging',objectName]);
  await db.query('INSERT INTO public.v31_captain_documents(captain_id,kind,object_name) VALUES($1,$2,$3)',
   [hiaceCaptain,kind,objectName]);
 }
 await db.query('SELECT public.v31_submit_captain_application()');
 await setUser(admin);
 await assert.rejects(db.query('SELECT public.v31_admin_decide_captain($1,$2,$3,$4)',
  [hiaceCaptain,'approved',null,null]),/HIACE_CATEGORY_REVIEW_REQUIRED/);
 await db.query('SELECT public.v31_admin_decide_captain($1,$2,$3,$4)',
  [hiaceCaptain,'approved',null,['SPACE']]);
 const vehicle=(await db.query('SELECT seats,enabled_categories,color_code,color_other FROM public.v31_vehicles WHERE captain_id=$1',
  [hiaceCaptain])).rows[0];
 assert.equal(vehicle.seats,13);
 assert.deepEqual(vehicle.enabled_categories,['SPACE']);
 assert.equal(vehicle.color_code,'other');
 assert.equal(vehicle.color_other,'silver metallic');
 assert.deepEqual((await db.query('SELECT category,seat_capacity FROM public.v31_vehicle_service_categories WHERE vehicle_id=(SELECT id FROM public.v31_vehicles WHERE captain_id=$1)',
  [hiaceCaptain])).rows,[{category:'SPACE',seat_capacity:9}]);
});
