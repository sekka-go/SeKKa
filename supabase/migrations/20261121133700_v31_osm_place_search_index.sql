-- Additive, staging-first OSM search index. No registered service-area or operational geometry change.
-- Source: Geofabrik Egypt OSM PBF (ODbL). Import is an explicit opt-in operation.
create extension if not exists pg_trgm with schema extensions;
create schema if not exists sekka_geo;
revoke all on schema sekka_geo from public, anon, authenticated;

create or replace function sekka_geo.normalize_place(q text)
returns text language sql immutable strict set search_path=''
as $$
 select trim(regexp_replace(translate(
  regexp_replace(lower(q), '[ًٌٍَُِّْٰـ]', '', 'g'),
  'أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
  'اااايه01234567890123456789'
 ), '[^a-z0-9ء-ي]+', ' ', 'g'));
$$;

create table if not exists sekka_geo.search_places (
 source_id text primary key check (source_id ~ '^osm:(node|way|relation):[0-9]+$'),
 osm_kind text not null check (osm_kind in ('node','way','relation')),
 osm_numeric_id bigint not null check (osm_numeric_id > 0),
 name text not null check (char_length(name) between 2 and 200),
 name_ar text,
 name_en text,
 context_label text not null default '',
 place_type text not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 is_exact_point boolean not null default false,
 source_snapshot text not null,
 imported_at timestamptz not null default now(),
 enabled boolean not null default true,
 unique (osm_kind,osm_numeric_id)
);
create index if not exists v31_search_places_geo
 on sekka_geo.search_places using gist
 (extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326));
create index if not exists v31_search_places_snapshot on sekka_geo.search_places(source_snapshot);
alter table sekka_geo.search_places enable row level security;
revoke all on sekka_geo.search_places from public,anon,authenticated;

create table if not exists sekka_geo.search_aliases (
 source_id text not null references sekka_geo.search_places(source_id) on delete cascade,
 alias text not null check (char_length(alias) between 2 and 260),
 normalized text generated always as (sekka_geo.normalize_place(alias)) stored,
 language text not null default 'und',
 primary key (source_id,alias)
);
create index if not exists v31_search_aliases_prefix on sekka_geo.search_aliases (normalized text_pattern_ops);
create index if not exists v31_search_aliases_trgm on sekka_geo.search_aliases
 using gin (normalized extensions.gin_trgm_ops);
alter table sekka_geo.search_aliases enable row level security;
revoke all on sekka_geo.search_aliases from public,anon,authenticated;

-- Public search reveals licensed OSM place names only. No Captain/private trip fields.
-- SECURITY DEFINER is restricted to this fixed, read-only projection. No dynamic SQL.
create or replace function public.v31_location_suggest(p_query text,p_limit integer default 8)
returns table (
 place_id text, name text, name_ar text, name_en text, context_label text,
 place_type text, osm_kind text, latitude double precision, longitude double precision,
 is_exact_point boolean, source_snapshot text, relevance integer
)
language sql stable security definer set search_path=''
as $$
 with params as (
  select sekka_geo.normalize_place(coalesce(p_query,'')) q
 ),
 hits as (
  select a.source_id, max(
   case when a.normalized=p.q then 500
    when a.normalized like p.q||' %' then 450
    when a.normalized like p.q||'%' then 350
    when a.normalized like '% '||p.q||' %' or a.normalized like '% '||p.q then 275
    when a.normalized like '%'||p.q||'%' then 160
    else 0 end
  ) as score
  from sekka_geo.search_aliases a cross join params p
  where char_length(p.q) between 2 and 120
    and a.normalized like '%'||p.q||'%'
  group by a.source_id
 )
 select sp.source_id,sp.name,sp.name_ar,sp.name_en,sp.context_label,
  sp.place_type,sp.osm_kind,sp.latitude,sp.longitude,sp.is_exact_point,
  sp.source_snapshot,hits.score
 from hits join sekka_geo.search_places sp on sp.source_id=hits.source_id
 where sp.enabled and hits.score>0
  and public.v31_in_operational_region(sp.latitude,sp.longitude)
 order by hits.score desc,
  case sp.place_type
   when 'neighbourhood' then 1 when 'suburb' then 2 when 'city' then 3
   when 'square' then 4 when 'station' then 5 when 'bus_station' then 6
   when 'road' then 8 else 7 end,
  sp.source_id
 limit least(12,greatest(1,coalesce(p_limit,8)))
$$;
revoke all on function public.v31_location_suggest(text,integer) from public;
grant execute on function public.v31_location_suggest(text,integer) to anon,authenticated;
comment on function public.v31_location_suggest(text,integer) is
 'Public, bounded, geofenced OSM place autocomplete; never grants service-area eligibility.';
