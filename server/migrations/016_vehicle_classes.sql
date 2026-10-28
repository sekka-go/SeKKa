-- Add the approved vehicle classes for new registrations and journeys.
-- Keep the old rows because existing profiles and historical routes reference them.
INSERT OR IGNORE INTO vehicle_types (id, name_ar, capacity_max) VALUES
  ('prime', 'Prime', 3),
  ('daily', 'Daily', 4),
  ('space', 'Space', 9),
  ('max', 'Max', 13);

-- Reclassify captain profiles to the nearest approved capacity. Preserve
-- legacy vehicle rows and existing service-category definitions for history.
UPDATE captain_profiles SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE captain_profiles SET vehicle_type_id='max' WHERE vehicle_type_id='hiace';
UPDATE service_categories SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE service_categories SET vehicle_type_id='max', max_seats=13
WHERE vehicle_type_id='hiace';

INSERT OR IGNORE INTO pricing_config (vehicle_type_id, base_fee, rate_per_km, rate_per_min)
SELECT target.id, source.base_fee, source.rate_per_km, source.rate_per_min
FROM (SELECT 'prime' AS id UNION ALL SELECT 'daily') target
JOIN pricing_config source ON source.vehicle_type_id='private_car';
INSERT OR IGNORE INTO pricing_config (vehicle_type_id, base_fee, rate_per_km, rate_per_min)
SELECT target.id, source.base_fee, source.rate_per_km, source.rate_per_min
FROM (SELECT 'space' AS id UNION ALL SELECT 'max') target
JOIN pricing_config source ON source.vehicle_type_id='hiace';
