REVOKE EXECUTE ON FUNCTION public.promo_active() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pro(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_pro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promo_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_pro() TO authenticated, service_role;