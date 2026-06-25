CREATE OR REPLACE FUNCTION public.profiles_prevent_sensitive_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct user-initiated profile updates must not change identity/school fields.
  -- Trusted database triggers (for example school invite application) run nested
  -- and are allowed to maintain the server-owned school assignment.
  IF current_setting('role', true) <> 'service_role' AND pg_trigger_depth() <= 1 THEN
    NEW.id := OLD.id;
    NEW.school_id := OLD.school_id;
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_school_invite_to_existing_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_name text;
BEGIN
  SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
    INTO v_user_id, v_user_email, v_user_name
  FROM auth.users u
  WHERE lower(u.email) = lower(NEW.email)
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, school_id, full_name, year, section)
  VALUES (
    v_user_id,
    COALESCE(v_user_email, NEW.email),
    NEW.school_id,
    COALESCE(NEW.full_name, v_user_name),
    NEW.year,
    NEW.section
  )
  ON CONFLICT (id) DO UPDATE
  SET school_id = EXCLUDED.school_id,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      year = EXCLUDED.year,
      section = EXCLUDED.section;

  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (v_user_id, NEW.role, NEW.school_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_school_invite_to_existing_user_trg ON public.school_invites;
CREATE TRIGGER apply_school_invite_to_existing_user_trg
AFTER INSERT OR UPDATE OF email, school_id, role, full_name, year, section
ON public.school_invites
FOR EACH ROW
EXECUTE FUNCTION public.apply_school_invite_to_existing_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.school_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.school_invites
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, email, school_id, full_name, year, section)
  VALUES (
    NEW.id,
    NEW.email,
    v_invite.school_id,
    COALESCE(v_invite.full_name, NEW.raw_user_meta_data->>'full_name'),
    v_invite.year,
    v_invite.section
  )
  ON CONFLICT (id) DO UPDATE
  SET school_id = COALESCE(EXCLUDED.school_id, public.profiles.school_id),
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      year = COALESCE(EXCLUDED.year, public.profiles.year),
      section = COALESCE(EXCLUDED.section, public.profiles.section);

  IF v_invite.school_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, school_id)
    VALUES (NEW.id, COALESCE(v_invite.role, 'student'::public.app_role), v_invite.school_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;