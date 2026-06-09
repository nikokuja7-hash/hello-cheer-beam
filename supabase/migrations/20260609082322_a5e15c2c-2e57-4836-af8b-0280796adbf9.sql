
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone TEXT;
  v_username TEXT;
  v_is_admin BOOLEAN := false;
BEGIN
  v_phone := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '');
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', 'player_' || substr(NEW.id::text, 1, 8));

  -- Strip non-digits and detect admin phone (multiple formats)
  IF regexp_replace(v_phone, '[^0-9]', '', 'g') IN ('0743053511', '254743053511', '743053511') THEN
    v_is_admin := true;
  END IF;

  INSERT INTO public.profiles (id, username, phone)
  VALUES (NEW.id, v_username, NULLIF(v_phone, ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player') ON CONFLICT DO NOTHING;
  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
