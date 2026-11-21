-- Staging operational baseline. Source and reproducible extraction in docs/audit/SEKKA_GREATER_CAIRO.md.
create extension if not exists postgis with schema extensions;
create schema if not exists sekka_geo;
revoke all on schema sekka_geo from public,anon,authenticated;

create table sekka_geo.operational_boundaries (
 id text not null,
 version text not null,
 sources text[] not null,
 source_date date not null,
 operational_status text not null check (operational_status in ('active','inactive')),
 included_regions text[] not null,
 attribution text not null,
 geometry extensions.geometry(MultiPolygon,4326) not null
   check (not extensions.st_isempty(geometry) and extensions.st_isvalid(geometry)),
 primary key (id,version)
);
create unique index operational_boundary_active on sekka_geo.operational_boundaries (id)
 where operational_status='active';
create index operational_boundary_geometry on sekka_geo.operational_boundaries using gist(geometry)
 where operational_status='active';
alter table sekka_geo.operational_boundaries enable row level security;

insert into sekka_geo.operational_boundaries
 (id,version,sources,source_date,operational_status,included_regions,attribution,geometry)
 values ('greater-cairo','cairo-ucdb-beo-2026-11-v1',
 array['https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php','https://archive.org/details/greater-cairo'],
 '2024-11-05','active',array['Cairo (4605)','6th of October (3516)','Sheikh Zayed (BEO)'],'European Union, 2024 · GHSL / JRC; Built Environment Observatory · CC BY 4.0',
 extensions.st_setsrid(extensions.st_geomfromgeojson($geo${"type":"MultiPolygon","coordinates":[[[[30.8438534661,30.0930580247],[30.8721272159,30.0942047115],[30.8725685009,30.0917380178],[30.87382511,30.0896239018],[30.8758845527,30.0878117664],[30.8783279594,30.0869056862],[30.8859374258,30.0850330942],[30.9151702387,30.0779185533],[30.9387150093,30.0730114176],[30.9422055902,30.0731926598],[30.9450678666,30.074340519],[30.950160982,30.077492601],[30.9585415089,30.0836437289],[30.9653132359,30.08738893],[30.9706189189,30.0885366245],[30.974807616,30.0880533864],[30.9902359837,30.0837645441],[30.9965190293,30.080744121],[31.0072621631,30.0743664294],[31.0224312211,30.065222249],[31.0266172014,30.0866943968],[31.0157038637,30.0866943968],[31.0173706302,30.0952402719],[31.0493932942,30.0952402719],[31.0489144624,30.09134047],[31.0736555159,30.1007795121],[31.0850471968,30.1042288598],[31.1000462433,30.1098132628],[31.1120563072,30.1123144754],[31.1087479374,30.1160138497],[31.1097007561,30.1208795741],[31.1206164411,30.1208795741],[31.1256434925,30.1465213943],[31.114726045,30.1465213943],[31.1164025977,30.1550692277],[31.1035074586,30.1550692277],[31.1046941331,30.1568846252],[31.1209849012,30.1637918737],[31.1233345312,30.1643335982],[31.1266240132,30.1613540765],[31.1316365573,30.1610832064],[31.1317931993,30.1656878964],[31.1291302852,30.1700215259],[31.1263107292,30.1740841304],[31.1259974452,30.1761153699],[31.1385288053,30.171511167],[31.1424448553,30.1681255864],[31.1463609053,30.1623021159],[31.1518433753,30.1572909473],[31.1538797214,30.154378935],[31.1548978944,30.1533630966],[31.1556370488,30.1521102147],[31.1556566291,30.1516276817],[31.1559160674,30.1508234547],[31.1625733524,30.1427977564],[31.1803522195,30.1329086567],[31.1977179603,30.1308009741],[31.200679943,30.1309229628],[31.2144320055,30.130252023],[31.2186634093,30.1297030688],[31.2227757427,30.1326424444],[31.2120981667,30.144486199],[31.2149978782,30.1471748718],[31.2164623093,30.1479559815],[31.2181867795,30.1485477271],[31.2201576026,30.1488199289],[31.226179562,30.1489974514],[31.235103011,30.1495655213],[31.2428220681,30.1497312077],[31.2571652806,30.1496128603],[31.2601625741,30.149530017],[31.2649527691,30.1502401],[31.2706804737,30.1524413248],[31.2834464262,30.1587871432],[31.286426529,30.1603168102],[31.2893417048,30.163115385],[31.2905261233,30.1644065958],[31.2936597598,30.1657110657],[31.2960685073,30.1657304718],[31.2977108598,30.1655293137],[31.3035249116,30.1639048719],[31.3093424496,30.1743652851],[31.290430738,30.1800896902],[31.2954283296,30.1956749376],[31.301748813,30.2052027461],[31.3044435928,30.2126126262],[31.3087552404,30.2163385266],[31.3103231123,30.2258219997],[31.3216901833,30.2285313956],[31.3224741192,30.2512196544],[31.324825927,30.2634081973],[31.3334492223,30.2854114569],[31.3490299489,30.287696128],[31.3533415965,30.2939575465],[31.3572612762,30.2959035817],[31.3614749318,30.2970881059],[31.3635327636,30.2975111468],[31.3676484273,30.2957343628],[31.3723520429,30.2926883724],[31.3728420028,30.2904038175],[31.3751938106,30.2903192034],[31.3799954182,30.2893884427],[31.3866588736,30.2887115203],[31.3923424091,30.2980187935],[31.3949881929,30.2971727142],[31.395798951,30.2975959805],[31.3929570329,30.2833204184],[31.4029550674,30.2833204184],[31.4029255442,30.2805034649],[31.4033250913,30.2805120054],[31.4021821937,30.2747683701],[31.4131084923,30.2747683701],[31.4114069089,30.266216603],[31.4223326156,30.266216603],[31.4206311804,30.2576651176],[31.4097060648,30.2576651176],[31.40800596,30.2491139142],[31.3970814364,30.2491139142],[31.3953826612,30.2405629924],[31.3844587287,30.2405629924],[31.3776733698,30.2063621165],[31.3885949406,30.2063621165],[31.3868998529,30.1978126003],[31.430583778,30.1978126003],[31.4322812247,30.2063621165],[31.4432027955,30.2063621165],[31.4466010827,30.2234619923],[31.4575238338,30.2234619923],[31.4626285796,30.2491139142],[31.4517040551,30.2491139142],[31.4537404979,30.2593405485],[31.4617271578,30.266216603],[31.466035443,30.266216603],[31.4669281264,30.2706943377],[31.4727347124,30.275693474],[31.4764302212,30.2833204184],[31.4912990494,30.2833204184],[31.4878868563,30.266216603],[31.4988125629,30.266216603],[31.4936980561,30.2405629924],[31.4827741236,30.2405629924],[31.4742677022,30.1978126003],[31.4851886837,30.1978126003],[31.4834890272,30.1892633643],[31.4944094194,30.1892633643],[31.492709912,30.1807144096],[31.4817901099,30.1807144096],[31.478394489,30.1636173409],[31.4674758646,30.1636173409],[31.4657797502,30.1550692277],[31.4548617142,30.1550692277],[31.4531669248,30.1465213943],[31.4422494763,30.1465213943],[31.4388632832,30.1294265675],[31.4279470115,30.1294265675],[31.426255606,30.1208795741],[31.4153399219,30.1208795741],[31.4136498387,30.1123328605],[31.4027347411,30.1123328605],[31.3976706603,30.0866943968],[31.4085839971,30.0866943968],[31.4068968514,30.0781488015],[31.4178096026,30.0781488015],[31.4161226042,30.0696034848],[31.4379469342,30.0696034848],[31.439635104,30.0781488015],[31.4614606062,30.0781488015],[31.4597712642,30.0696034848],[31.4815955932,30.0696034848],[31.4832861076,30.0781488015],[31.505111609,30.0781488015],[31.5034199232,30.0696034848],[31.5252442532,30.0696034848],[31.5235521308,30.0610584471],[31.5344637106,30.0610584471],[31.5310805034,30.0439692095],[31.5201700942,30.0439692095],[31.518480179,30.0354250088],[31.5075703554,30.0354250088],[31.5025067705,30.0097940784],[31.5134148405,30.0097940784],[31.5117278628,30.0012509914],[31.4790054035,30.0012509914],[31.4773209106,29.9927081826],[31.4555071052,29.9927081826],[31.4538245122,29.9841656524],[31.442918193,29.9841656524],[31.4412369142,29.9756233997],[31.4194254418,29.9756233997],[31.4177460603,29.9670814256],[31.4068409071,29.9670814256],[31.4085197056,29.9756233997],[31.3976139703,29.9756233997],[31.3992929162,29.9841656524],[31.388386597,29.9841656524],[31.3917455137,30.0012509914],[31.4026529998,30.0012509914],[31.4076986104,30.0268810871],[31.3967893717,30.0268810871],[31.3984721201,30.0354250088],[31.3766524731,30.0354250088],[31.3749708933,30.0268810871],[31.3640616546,30.0268810871],[31.3623813909,30.0183374433],[31.3514727361,30.0183374433],[31.3464380796,29.9927081826],[31.3573449818,29.9927081826],[31.3556676394,29.9841656524],[31.3665739586,29.9841656524],[31.3632202952,29.9670814256],[31.352315142,29.9670814256],[31.350639987,29.9585397281],[31.339735416,29.9585397281],[31.3363884558,29.9414571678],[31.3254850498,29.9414571678],[31.3238132438,29.9329163034],[31.3129104199,29.9329163034],[31.3079011076,29.9072953741],[31.3188021869,29.9072953741],[31.3154651154,29.8902161391],[31.3263650332,29.8902161391],[31.3246970054,29.8816769373],[31.3355963438,29.8816769373],[31.3339284616,29.8731380122],[31.3448272197,29.8731380122],[31.3431594839,29.8645993633],[31.3758540172,29.8645993633],[31.3741852681,29.8560609902],[31.3850828656,29.8560609902],[31.381746387,29.838985074],[31.3926428265,29.838985074],[31.390975097,29.8304475301],[31.401870958,29.8304475301],[31.4002033758,29.8219102627],[31.3893080933,29.8219102627],[31.3859762626,29.804836554],[31.3532938853,29.804836554],[31.3516307911,29.7963001133],[31.3407372432,29.7963001133],[31.3350732963,29.7671884102],[31.3337904406,29.7673331135],[31.3309373949,29.7640182481],[31.3123951549,29.7593574327],[31.312290512,29.7541490063],[31.3070932522,29.7536947702],[31.3057328956,29.7562384657],[31.3041626575,29.7573119783],[31.3006402786,29.7571469127],[31.298500459,29.7712193677],[31.2890195684,29.7701525678],[31.2887562103,29.7799819365],[31.2898096426,29.7855438649],[31.294989018,29.7973524143],[31.2911264329,29.8311704804],[31.2939355857,29.8464001061],[31.2787486035,29.9140676777],[31.2786608175,29.9246437195],[31.2754045435,29.9242283703],[31.2735248395,29.9239568511],[31.2725849875,29.9257895913],[31.2669458755,29.92429625],[31.2642829615,29.9232780499],[31.2613067635,29.9264683754],[31.2525348114,29.9219883148],[31.2544145154,29.9207664452],[31.2412565874,29.9143513833],[31.2351083889,29.9119413855],[31.2192875468,29.9289119598],[31.2029184577,29.9206985631],[31.2146274473,29.9105836146],[31.2011562352,29.9013502817],[31.1979542798,29.9024873002],[31.1988903098,29.9072953741],[31.1879892296,29.9072953741],[31.1896518818,29.9158354066],[31.1787502203,29.9158354066],[31.1804130145,29.9243757165],[31.1695107728,29.9243757165],[31.171173708,29.9329163034],[31.1493680603,29.9329163034],[31.1526937762,29.9499983092],[31.1417897881,29.9499983092],[31.1434531482,29.9585397281],[31.1107394367,29.9585397281],[31.1090778239,29.9499983092],[31.0981738358,29.9499983092],[31.0965135273,29.9414571678],[31.0856101213,29.9414571678],[31.0922533613,29.9756233997],[31.081347626,29.9756233997],[31.0846724167,29.9927081826],[31.0955793198,29.9927081826],[31.1022399225,30.0268810871],[31.0913306837,30.0268810871],[31.0946641638,30.0439692095],[31.0837537554,30.0439692095],[31.0854209981,30.0525136888],[31.074510004,30.0525136888],[31.0761773868,30.0610584471],[31.0293384505,30.0610584471],[31.0521588892,30.047301877],[31.0524823703,30.0468082143],[30.9912641386,30.0085883668],[30.9882292793,30.0087794966],[30.9839804762,30.0094484481],[30.9818560747,30.0085883668],[30.9481691364,30.0474518172],[30.9332255718,30.0384776336],[30.9310187326,30.0404989587],[30.9300806852,30.0447501418],[30.9273217222,30.0466129623],[30.9260250096,30.0483563396],[30.9101885619,30.049693704],[30.9071433565,30.0467443137],[30.9003011283,30.0454069095],[30.8930174659,30.0379553265],[30.8462254534,30.0373821046],[30.8458810705,30.0674195985],[30.8448863915,30.0674065725],[30.8448750762,30.067660283],[30.8438534661,30.0930580247]]],[[[30.8440889896,29.9329163034],[30.847382111,29.9499983092],[30.8582860991,29.9499983092],[30.8599343172,29.9585397281],[30.8708388873,29.9585397281],[30.8724884053,29.9670814256],[30.8942987117,29.9670814256],[30.8959501134,29.9756233997],[30.9177615858,29.9756233997],[30.9194148722,29.9841656524],[30.9303211914,29.9841656524],[30.9319757804,29.9927081826],[30.9646964888,29.9927081826],[30.966353549,30.0012509914],[30.9881685212,30.0012509914],[30.9865102941,29.9927081826],[30.9974171963,29.9927081826],[30.9957591066,29.9841656524],[31.017571745,29.9841656524],[31.0159132098,29.9756233997],[30.9722902659,29.9756233997],[30.970634784,29.9670814256],[30.9597296308,29.9670814256],[30.9564219917,29.9499983092],[30.9455180036,29.9499983092],[30.9405636835,29.9243757165],[30.9514659261,29.9243757165],[30.9465163266,29.8987556179],[30.9356158276,29.8987556179],[30.932320843,29.8816769373],[30.9105221671,29.8816769373],[30.9121681404,29.8902161391],[30.9012682216,29.8902161391],[30.9029143305,29.8987556179],[30.8811133325,29.8987556179],[30.8827589967,29.9072953741],[30.8718579164,29.9072953741],[30.8735037154,29.9158354066],[30.8626020539,29.9158354066],[30.8642479876,29.9243757165],[30.853345745,29.9243757165],[30.8549918134,29.9329163034],[30.8440889896,29.9329163034]]]]}$geo$),4326));

-- This exposes only a coverage decision. The versioned geometry is read-only from clients.
create function public.v31_in_operational_region(p_lat double precision,p_lon double precision)
returns boolean
language sql stable security definer set search_path=''
as $$
 select case
  when p_lat between -90 and 90 and p_lon between -180 and 180 then exists (
   select 1 from sekka_geo.operational_boundaries b
   where b.id='greater-cairo' and b.operational_status='active'
     and extensions.st_covers(b.geometry,extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326))
  )
  else false
 end
$$;
revoke all on function public.v31_in_operational_region(double precision,double precision) from public;
grant execute on function public.v31_in_operational_region(double precision,double precision) to anon,authenticated;

-- Protect both current draft RPC overloads, the legacy setter and direct DML.
-- Stops that predate GPS remain valid. UPDATE never rewrites historical coordinates.
create function sekka_geo.guard_stop_coordinates() returns trigger
language plpgsql set search_path=''
as $$
begin
 if (new.latitude is not null or new.longitude is not null)
    and not public.v31_in_operational_region(new.latitude,new.longitude) then
  raise exception 'STOP_OUTSIDE_OPERATIONAL_REGION' using errcode='23514';
 end if;
 return new;
end
$$;
create trigger v31_stop_operational_region
 before insert or update of latitude,longitude on public.v31_route_stops
 for each row execute function sekka_geo.guard_stop_coordinates();

-- Also prevent old, out-of-region drafts from being published or resumed.
create function sekka_geo.guard_route_publish() returns trigger
language plpgsql set search_path=''
as $$
begin
 if exists (
  select 1 from public.v31_route_stops s where s.route_id=new.id
  and (s.latitude is not null or s.longitude is not null)
  and not public.v31_in_operational_region(s.latitude,s.longitude)
 ) then
  raise exception 'STOP_OUTSIDE_OPERATIONAL_REGION' using errcode='23514';
 end if;
 return new;
end
$$;
create trigger v31_publish_operational_region
 before update of status on public.v31_routes
 for each row when (new.status='published' and old.status is distinct from new.status)
 execute function sekka_geo.guard_route_publish();

-- Request endpoints contain registered area IDs only. Historical inactive requests
-- can still be cancelled without changing their endpoints.
create function sekka_geo.guard_request_service_areas() returns trigger
language plpgsql set search_path=''
as $$
begin
 if not exists (select 1 from public.v31_service_areas a where a.id=new.origin_area_id and a.active)
    or not exists (select 1 from public.v31_service_areas a where a.id=new.destination_area_id and a.active) then
  raise exception 'TRIP_REQUEST_SERVICE_AREA_INACTIVE' using errcode='23514';
 end if;
 return new;
end
$$;
create trigger v31_request_operational_areas
 before insert or update of origin_area_id,destination_area_id on public.v31_trip_requests
 for each row execute function sekka_geo.guard_request_service_areas();

-- Match against the public offer projection and published stops under caller RLS.
-- Map selections use the existing 3 km straight-line radius. Area selections
-- retain the service-area match and also work with historic stops without GPS.
create or replace function public.v31_search_published_routes(
  p_origin_area text, p_destination_area text,
  p_origin_lat double precision, p_origin_lon double precision,
  p_destination_lat double precision, p_destination_lon double precision,
  p_outbound time, p_return time, p_period text, p_direction text,
  p_categories text[], p_after uuid default null
) returns table (route_id uuid, selection jsonb)
language sql stable security invoker set search_path=''
as $$
  with endpoints(side, area_name, lat, lon) as (
    values (1, p_origin_area, p_origin_lat, p_origin_lon),
           (2, p_destination_area, p_destination_lat, p_destination_lon)
  ),
  coverage as materialized (
    select *, public.v31_in_operational_region(lat,lon) as covered from endpoints
  ),
  eligible as (
    select offer.*, coalesce(p_direction = 'return',false) as reverse
    from public.v31_public_route_offers offer
    where (p_after is null or offer.id > p_after)
      and (nullif(p_period,'') is null or offer.period = p_period)
      and (coalesce(cardinality(p_categories),0) = 0 or offer.category = any(p_categories))
      and case p_direction
        when 'round_trip' then offer.direction = 'round_trip' and offer.return_supported
          and (p_outbound is null or left(offer.outbound_time::text,5) = left(p_outbound::text,5))
          and (p_return is null or left(offer.return_time::text,5) = left(p_return::text,5))
        when 'return' then offer.direction <> 'outbound' and offer.return_supported
          and (p_return is null or left(offer.return_time::text,5) = left(p_return::text,5))
        else offer.direction <> 'return'
          and (p_outbound is null or left(offer.outbound_time::text,5) = left(p_outbound::text,5))
      end
  )
  select offer.id, jsonb_build_object(
    'route', jsonb_build_object(
      'id',offer.id,'title',offer.title,'category',offer.category,
      'seat_capacity',offer.seat_capacity,'period',offer.period,'direction',offer.direction,
      'outbound_time',offer.outbound_time,'return_time',offer.return_time,
      'seat_price_egp',offer.seat_price_egp,'return_supported',offer.return_supported
    ),
    'from', pair.pickup, 'to', pair.dropoff, 'reverse', offer.reverse,
    'stops', route_stops.sequence, 'remaining', public.v31_published_route_available_seats(offer.id),
    'pickupDistanceKm', pair.pickup_distance, 'dropoffDistanceKm', pair.dropoff_distance
  )
  from eligible offer
  cross join lateral (
    with stops as (
      select id, route_id, area_id, position, name, pickup_allowed, dropoff_allowed, latitude, longitude
      from public.v31_route_stops
      where route_id = offer.id
        and ((latitude is null and longitude is null) or public.v31_in_operational_region(latitude,longitude))
    ),
    matches as (
      select endpoint.side, to_jsonb(stop) as point, distance.km,
             stop.pickup_allowed, stop.dropoff_allowed, stop.id,
             case when offer.reverse then -stop.position else stop.position end as travel_position
      from stops stop
      cross join coverage endpoint
      left join public.v31_service_areas area on area.id = stop.area_id and area.active
      cross join lateral (
        select case
          when endpoint.lat is not null and endpoint.lon is not null
            and stop.latitude is not null and stop.longitude is not null
            and endpoint.covered
          then 12742.0176 * asin(sqrt(least(1.0, greatest(0.0,
            power(sin(radians(stop.latitude - endpoint.lat) / 2),2)
              + cos(radians(endpoint.lat)) * cos(radians(stop.latitude::double precision))
              * power(sin(radians(stop.longitude - endpoint.lon) / 2),2)
          ))))
        end as km
      ) distance
      where distance.km <= 3
        or (endpoint.lat is null and endpoint.lon is null
          and endpoint.area_name in (area.name_ar, area.name_en))
    )
    select a.point as pickup, b.point as dropoff,
           a.km as pickup_distance, b.km as dropoff_distance
    from matches a join matches b on a.travel_position < b.travel_position
    where a.side = 1 and b.side = 2
      and case when offer.reverse then a.dropoff_allowed and b.pickup_allowed
               else a.pickup_allowed and b.dropoff_allowed end
    order by coalesce(a.km,0) + coalesce(b.km,0), a.travel_position, b.travel_position,
             a.id, b.id
    limit 1
  ) pair
  cross join lateral (
    select jsonb_agg(to_jsonb(stop) order by stop.position, stop.id) as sequence
    from (
      select id, route_id, area_id, position, name, pickup_allowed, dropoff_allowed
      from public.v31_route_stops
      where route_id = offer.id
        and ((latitude is null and longitude is null) or public.v31_in_operational_region(latitude,longitude))
    ) stop
  ) route_stops
  where not (
    p_origin_lat is null and p_origin_lon is null and
    p_destination_lat is null and p_destination_lon is null and
    (pair.pickup->>'area_id') = (pair.dropoff->>'area_id')
  )
  order by offer.id
  limit 100
$$;

revoke all on function public.v31_search_published_routes(
  text, text, double precision, double precision, double precision, double precision,
  time, time, text, text, text[], uuid
) from public;
grant execute on function public.v31_search_published_routes(
  text, text, double precision, double precision, double precision, double precision,
  time, time, text, text, text[], uuid
) to anon, authenticated;
