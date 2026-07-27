CREATE OR REPLACE FUNCTION public.admin_emails_by_ids(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = ANY(COALESCE(p_user_ids, ARRAY[]::uuid[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_q text := btrim(COALESCE(p_query, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.display_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email ILIKE '%' || v_q || '%'
     OR COALESCE(p.display_name, '') ILIKE '%' || v_q || '%'
  ORDER BY u.created_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_emails_by_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_search_users(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_emails_by_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text) TO authenticated;