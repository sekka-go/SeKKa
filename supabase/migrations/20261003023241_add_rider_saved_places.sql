CREATE TABLE public.rider_saved_places (
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  place_type text NOT NULL CHECK (place_type IN ('home', 'work')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 240),
  lat double precision NOT NULL CHECK (lat BETWEEN 29.65 AND 30.45),
  lng double precision NOT NULL CHECK (lng BETWEEN 30.55 AND 31.85),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rider_saved_places_pkey PRIMARY KEY (user_id, place_type)
);

ALTER TABLE public.rider_saved_places ENABLE ROW LEVEL SECURITY;
