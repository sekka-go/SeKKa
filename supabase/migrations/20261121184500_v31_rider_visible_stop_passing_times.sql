-- Include stored Captain stop timing preferences in the matched Rider pickup,
-- drop-off, and entire route. No change to capacity, visibility, RLS, time
-- filtering, geofence, ordering, or authorization.
CREATE OR REPLACE FUNCTION public.v31_search_published_routes(p_origin_area text, p_destination_area text, p_origin_lat double precision, p_origin_lon double precision, p_destination_lat double precision, p_destination_lon double precision, p_outbound time without time zone, p_return time without time zone, p_period text, p_direction text, p_categories text[], p_after uuid DEFAULT NULL::uuid)
 RETURNS TABLE(route_id uuid, selection jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
      select id, route_id, area_id, position, name, pickup_allowed, dropoff_allowed, latitude, longitude, outbound_stop_time, return_stop_time
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
            and endpoint.lat between 29.70 and 30.34
            and endpoint.lon between 30.70 and 31.80
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
      select id, route_id, area_id, position, name, pickup_allowed, dropoff_allowed, outbound_stop_time, return_stop_time
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
$function$

