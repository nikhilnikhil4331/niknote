-- Atomically cap expensive paid vision requests per account and hour.
CREATE OR REPLACE FUNCTION public.reserve_handwriting_request(_user_id uuid, _endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_requests integer;
  used_requests integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF _user_id IS NULL OR _endpoint NOT IN ('handwriting-vision-style', 'handwriting-vision-ocr') THEN
    RAISE EXCEPTION 'invalid request';
  END IF;
  max_requests := CASE WHEN _endpoint = 'handwriting-vision-style' THEN 20 ELSE 60 END;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _endpoint, 0));
  DELETE FROM public.rate_limits
    WHERE user_id = _user_id AND endpoint = _endpoint AND window_start < now() - interval '7 days';
  SELECT count(*) INTO used_requests FROM public.rate_limits
    WHERE user_id = _user_id AND endpoint = _endpoint AND window_start >= now() - interval '1 hour';
  IF used_requests >= max_requests THEN RETURN false; END IF;
  INSERT INTO public.rate_limits (user_id, endpoint, window_start) VALUES (_user_id, _endpoint, clock_timestamp());
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_handwriting_request(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_handwriting_request(uuid, text) TO service_role;
