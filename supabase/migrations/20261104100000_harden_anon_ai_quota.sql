-- Guest quota state is a service-owned security boundary. Public clients must
-- not choose the quota bucket or increase their own request limit directly.
CREATE TABLE IF NOT EXISTS public.anon_ai_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS anon_ai_limits_window_start_idx
  ON public.anon_ai_limits (window_start);

ALTER TABLE public.anon_ai_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anon_ai_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.anon_ai_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_anon_quota(
  p_bucket text,
  p_limit integer DEFAULT 5,
  p_window_seconds integer DEFAULT 3600
)
RETURNS TABLE(allowed boolean, used integer, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_window timestamptz;
  v_used integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_bucket IS NULL OR p_bucket !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid quota bucket' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS DISTINCT FROM 5 OR p_window_seconds IS DISTINCT FROM 3600 THEN
    RAISE EXCEPTION 'invalid quota configuration' USING ERRCODE = '22023';
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600);

  INSERT INTO public.anon_ai_limits (bucket, window_start, request_count)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET request_count = public.anon_ai_limits.request_count + 1
  WHERE public.anon_ai_limits.request_count < 5
  RETURNING public.anon_ai_limits.request_count INTO v_used;

  DELETE FROM public.anon_ai_limits
  WHERE window_start < now() - interval '2 days';

  IF v_used IS NULL THEN
    SELECT limits.request_count INTO v_used
    FROM public.anon_ai_limits AS limits
    WHERE limits.bucket = p_bucket AND limits.window_start = v_window;

    RETURN QUERY SELECT false, coalesce(v_used, 5), 0, v_window + interval '1 hour';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_used, greatest(0, 5 - v_used), v_window + interval '1 hour';
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_anon_quota(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_anon_quota(text, integer, integer) TO service_role;
