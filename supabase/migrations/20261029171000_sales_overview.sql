-- Aggregate the verified capture ledger and recent institution inquiries only
-- for a service-role Edge Function. These amounts are gross captures, not bank
-- settlement, and are not net of later refunds or fees.
CREATE OR REPLACE FUNCTION public.sales_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  SELECT jsonb_build_object(
    'verifiedPayments', (SELECT count(*) FROM public.verified_payments),
    'grossVerifiedPaise', (SELECT coalesce(sum(amount_paise), 0) FROM public.verified_payments),
    'institutionLeads', (SELECT count(*) FROM public.sales_leads),
    'recentLeads', coalesce((
      SELECT jsonb_agg(to_jsonb(lead) ORDER BY lead.created_at DESC)
      FROM (
        SELECT id, name, email, phone, institution, students, message, stage, created_at
        FROM public.sales_leads ORDER BY created_at DESC LIMIT 50
      ) lead
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sales_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_overview() TO service_role;
