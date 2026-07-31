CREATE OR REPLACE FUNCTION public.register_device(p_device_id text, p_type text, p_label text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_devices (user_id, device_id, device_type, device_label, last_seen_at)
  values (auth.uid(), p_device_id, p_type, p_label, now())
  on conflict (user_id, device_id)
  do update set last_seen_at = now(),
                device_type = excluded.device_type,
                device_label = excluded.device_label;

  delete from public.user_devices
  where user_id = auth.uid()
    and device_id <> p_device_id;
end;
$function$;