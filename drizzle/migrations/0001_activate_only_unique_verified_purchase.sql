CREATE OR REPLACE FUNCTION public.activate_verified_purchase(_user_id uuid, _payment_id text, _order_id text, _plan_code text, _amount_paise integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer;
  _duration interval;
BEGIN
  IF _plan_code = 'weekly' AND _amount_paise = 4900 THEN
    _duration := interval '7 days';
  ELSIF _plan_code = 'monthly' AND _amount_paise = 9900 THEN
    _duration := interval '30 days';
  ELSE
    RAISE EXCEPTION 'Invalid purchase details';
  END IF;
  INSERT INTO public.verified_payments (payment_id, order_id, user_id, plan_code, amount_paise)
  VALUES (_payment_id, _order_id, _user_id, _plan_code, _amount_paise)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted = 0 THEN
    IF EXISTS (SELECT 1 FROM public.verified_payments WHERE payment_id = _payment_id AND order_id = _order_id AND user_id = _user_id AND plan_code = _plan_code AND amount_paise = _amount_paise) THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION 'Purchase already claimed';
  END IF;
  INSERT INTO public.user_subscriptions (user_id, plan_code, status, current_period_end)
  VALUES (_user_id, _plan_code, 'active', now() + _duration)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
    current_period_end = greatest(now(), coalesce(public.user_subscriptions.current_period_end, now())) + _duration,
    updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_verified_purchase(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_verified_purchase(uuid, text, text, text, integer) TO service_role;