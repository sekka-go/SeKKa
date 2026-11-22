\set ON_ERROR_STOP on
-- Execute only against authorized sekka-staging. \\copy is client-side from generated OSM files.
begin;
create temporary table new_geo_places (
 source_id text,osm_kind text,osm_numeric_id bigint,name text,name_ar text,name_en text,
 context_label text,place_type text,latitude double precision,longitude double precision,
 is_exact_point boolean,source_snapshot text
) on commit drop;
create temporary table new_geo_aliases (
 source_id text,alias text,language text
) on commit drop;
\copy new_geo_places from 'geo-index/places.tsv' with (format text)
\copy new_geo_aliases from 'geo-index/aliases.tsv' with (format text)

-- Import is idempotent. Old snapshots stay available until a deliberate safe refresh review.
insert into sekka_geo.search_places
 (source_id,osm_kind,osm_numeric_id,name,name_ar,name_en,context_label,place_type,
  latitude,longitude,is_exact_point,source_snapshot)
select source_id,osm_kind,osm_numeric_id,name,name_ar,name_en,context_label,place_type,
 latitude,longitude,is_exact_point,source_snapshot from new_geo_places
on conflict (source_id) do update set
 name=excluded.name,name_ar=excluded.name_ar,name_en=excluded.name_en,
 context_label=excluded.context_label,place_type=excluded.place_type,
 latitude=excluded.latitude,longitude=excluded.longitude,
 is_exact_point=excluded.is_exact_point,source_snapshot=excluded.source_snapshot,
 imported_at=now(),enabled=true;

delete from sekka_geo.search_aliases a using new_geo_places p where a.source_id=p.source_id;
insert into sekka_geo.search_aliases (source_id,alias,language)
select distinct a.source_id,a.alias,a.language from new_geo_aliases a
join sekka_geo.search_places p on p.source_id=a.source_id
on conflict (source_id,alias) do nothing;

-- Report real ingested row counts (not Google features).
select (select count(*) from new_geo_places) as source_rows,
 (select count(*) from new_geo_aliases) as alias_rows,
 (select count(*) from sekka_geo.search_places) as total_indexed,
 (select count(*) from public.v31_location_suggest('الحصري')) as hosary_suggestions;
commit;
