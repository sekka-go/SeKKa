-- An offer-specific contact request starts communication without accepting,
-- reserving seats, recording a subscription, or promising that the trip runs.
CREATE TABLE public.line_contact_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rider_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  captain_line_id integer NOT NULL REFERENCES public.captain_lines(id) ON DELETE RESTRICT,
  conversation_id bigint NOT NULL REFERENCES public.message_conversations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'contact_requested' CHECK (status = 'contact_requested'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_contact_requests_unique_rider_line UNIQUE (rider_user_id, captain_line_id)
);

CREATE INDEX line_contact_requests_line_recent_idx
  ON public.line_contact_requests (captain_line_id, created_at DESC);
CREATE INDEX line_contact_requests_rider_recent_idx
  ON public.line_contact_requests (rider_user_id, created_at DESC);

ALTER TABLE public.line_contact_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.line_contact_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.line_contact_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.line_contact_requests_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.create_line_contact_request(
  p_rider_user_id integer,
  p_captain_line_id integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rider public.users%ROWTYPE;
  line public.captain_lines%ROWTYPE;
  captain public.users%ROWTYPE;
  existing_request public.line_contact_requests%ROWTYPE;
  conversation_id bigint;
  created_request public.line_contact_requests%ROWTYPE;
BEGIN
  SELECT * INTO rider
  FROM public.users
  WHERE id = p_rider_user_id AND role = 'rider' AND deleted_at IS NULL AND verified_at IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rider is not eligible' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO line
  FROM public.captain_lines
  WHERE id = p_captain_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found' USING ERRCODE = 'P0002';
  END IF;

  -- Retries return the same request and conversation even if the captain
  -- pauses the offer after the first successful request.
  SELECT * INTO existing_request
  FROM public.line_contact_requests
  WHERE rider_user_id = p_rider_user_id AND captain_line_id = p_captain_line_id;
  IF FOUND THEN
    RETURN jsonb_build_object('request', to_jsonb(existing_request), 'created', false);
  END IF;

  IF line.status <> 'active' OR line.captain_user_id = p_rider_user_id THEN
    RAISE EXCEPTION 'offer is not available for contact' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO captain
  FROM public.users AS captain_user
  WHERE captain_user.id = line.captain_user_id AND captain_user.role = 'captain' AND captain_user.deleted_at IS NULL
    AND captain_user.verified_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_user_controls controls
      WHERE controls.user_id = captain_user.id AND controls.status <> 'active'
    )
  FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.captain_profiles profile
    WHERE profile.user_id = line.captain_user_id
      AND profile.status = 'active'
      AND profile.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'captain is not eligible' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.message_conversations (participant_low_id, participant_high_id)
  VALUES (LEAST(p_rider_user_id, line.captain_user_id), GREATEST(p_rider_user_id, line.captain_user_id))
  ON CONFLICT (participant_low_id, participant_high_id) DO NOTHING
  RETURNING id INTO conversation_id;
  IF conversation_id IS NULL THEN
    SELECT id INTO conversation_id FROM public.message_conversations
    WHERE participant_low_id = LEAST(p_rider_user_id, line.captain_user_id)
      AND participant_high_id = GREATEST(p_rider_user_id, line.captain_user_id);
  END IF;

  INSERT INTO public.line_contact_requests (rider_user_id, captain_line_id, conversation_id)
  VALUES (p_rider_user_id, p_captain_line_id, conversation_id)
  RETURNING * INTO created_request;
  RETURN jsonb_build_object('request', to_jsonb(created_request), 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_line_contact_request(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_line_contact_request(integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.direct_message_contact_ids(p_user_id integer)
RETURNS TABLE(contact_user_id integer)
LANGUAGE sql
SET search_path = ''
AS $$
  WITH contacts AS (
    SELECT trip.captain_user_id AS user_id
    FROM public.pool_members member
    JOIN public.pool_trips trip ON trip.group_id = member.group_id
    WHERE member.rider_user_id = p_user_id AND member.status <> 'cancelled' AND trip.captain_user_id IS NOT NULL
    UNION
    SELECT group_row.fixed_captain_user_id
    FROM public.pool_members member
    JOIN public.pool_groups group_row ON group_row.id = member.group_id
    WHERE member.rider_user_id = p_user_id AND member.status <> 'cancelled' AND group_row.fixed_captain_user_id IS NOT NULL
    UNION
    SELECT member.rider_user_id
    FROM public.pool_trips trip
    JOIN public.pool_members member ON member.group_id = trip.group_id
    WHERE trip.captain_user_id = p_user_id AND member.status <> 'cancelled'
    UNION
    SELECT matched_ride.captain_user_id
    FROM public.daily_commute_requests request
    JOIN public.matches matched_ride ON matched_ride.daily_commute_request_id = request.id
    WHERE request.rider_user_id = p_user_id
    UNION
    SELECT request.rider_user_id
    FROM public.matches matched_ride
    JOIN public.daily_commute_requests request ON request.id = matched_ride.daily_commute_request_id
    WHERE matched_ride.captain_user_id = p_user_id
    UNION
    SELECT line.captain_user_id
    FROM public.line_contact_requests intent
    JOIN public.captain_lines line ON line.id = intent.captain_line_id
    WHERE intent.rider_user_id = p_user_id
    UNION
    SELECT intent.rider_user_id
    FROM public.line_contact_requests intent
    JOIN public.captain_lines line ON line.id = intent.captain_line_id
    WHERE line.captain_user_id = p_user_id
  )
  SELECT DISTINCT contacts.user_id
  FROM contacts
  JOIN public.users contact ON contact.id = contacts.user_id
  WHERE contacts.user_id <> p_user_id AND contact.role IN ('rider', 'captain') AND contact.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.direct_message_contact_ids(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_message_contact_ids(integer) TO service_role;
