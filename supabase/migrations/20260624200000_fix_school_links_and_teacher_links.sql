-- ================================================================
-- FIX 1: Vincular usuarios existentes que quedaron sin school_id
-- (se crearon ANTES de que existiera su invite en school_invites)
-- ================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    JOIN public.school_invites si ON lower(si.email) = lower(u.email)
    JOIN public.profiles p ON p.id = u.id
    WHERE p.school_id IS NULL
  LOOP
    -- Actualizar perfil con datos del invite
    UPDATE public.profiles
    SET
      school_id  = (SELECT school_id  FROM public.school_invites WHERE lower(email) = lower(r.email) LIMIT 1),
      full_name  = COALESCE(full_name,  (SELECT full_name  FROM public.school_invites WHERE lower(email) = lower(r.email) LIMIT 1)),
      year       = COALESCE(year,       (SELECT year       FROM public.school_invites WHERE lower(email) = lower(r.email) LIMIT 1)),
      section    = COALESCE(section,    (SELECT section    FROM public.school_invites WHERE lower(email) = lower(r.email) LIMIT 1))
    WHERE id = r.id;

    -- Insertar rol si no existe
    INSERT INTO public.user_roles (user_id, role, school_id)
    SELECT
      r.id,
      si.role,
      si.school_id
    FROM public.school_invites si
    WHERE lower(si.email) = lower(r.email)
    LIMIT 1
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Fixed user: %', r.email;
  END LOOP;
END;
$$;

-- ================================================================
-- FIX 2: El teacher también debe poder LEER sus propios invites
-- (la migración anterior solo dejó SELECT a super_admin, roto para teacher)
-- ================================================================
DROP POLICY IF EXISTS "super admins read invites" ON public.school_invites;

CREATE POLICY "teachers and admins read invites in their school"
ON public.school_invites
FOR SELECT
TO authenticated
USING (
  public.is_teacher_of(school_id)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- ================================================================
-- FIX 3: Columnas para links del profesor (YouTube / Gmail / contacto)
-- ================================================================
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS youtube_url  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_label TEXT DEFAULT 'Contactar al profesor';

-- Política: cualquier alumno del colegio puede ver esos datos (ya leen schools)
-- No hace falta nueva policy, schools ya tiene "schools readable by authenticated"
