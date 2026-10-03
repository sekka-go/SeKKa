CREATE TABLE IF NOT EXISTS public.rider_commuter_preferences (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  usual_days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4],
  usual_departure_time time NOT NULL DEFAULT '07:30',
  usual_return_time time NOT NULL DEFAULT '17:00',
  frequent_places jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(frequent_places) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_commuter_preferences_days_check CHECK (
    cardinality(usual_days) BETWEEN 1 AND 7
    AND usual_days <@ ARRAY[0,1,2,3,4,5,6]::integer[]
  )
);

ALTER TABLE public.rider_commuter_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commuter_board_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'campaign' CHECK (type IN ('weekly_reminder','monthly_reminder','invite_friends','campaign')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  icon text NOT NULL DEFAULT '⌖' CHECK (char_length(icon) <= 16),
  cta_text text NOT NULL CHECK (char_length(btrim(cta_text)) BETWEEN 1 AND 60),
  cta_action text NOT NULL CHECK (cta_action IN ('open-booking','open-trips','invite-friends','manage-preferences')),
  priority integer NOT NULL DEFAULT 5 CHECK (priority BETWEEN 0 AND 100),
  targeting_rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(targeting_rules) = 'object'),
  start_date timestamptz,
  end_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  display_duration integer NOT NULL DEFAULT 10 CHECK (display_duration BETWEEN 5 AND 30),
  created_by_admin integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commuter_board_campaigns_date_range_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS commuter_board_campaigns_active_window_idx
  ON public.commuter_board_campaigns (active, priority DESC, start_date, end_date);

ALTER TABLE public.commuter_board_campaigns ENABLE ROW LEVEL SECURITY;
