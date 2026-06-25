
-- 1) profile_school_id_hijack: prevent users from changing school_id / email / id on their own profile
CREATE OR REPLACE FUNCTION public.profiles_prevent_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.school_id := OLD.school_id;
  NEW.email := OLD.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_sensitive_update_trg ON public.profiles;
CREATE TRIGGER profiles_prevent_sensitive_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (
  current_setting('role', true) <> 'service_role'
)
EXECUTE FUNCTION public.profiles_prevent_sensitive_update();

-- 2) profiles_email_classmate_exposure: replace "same school can see classmates" with teacher-only visibility
DROP POLICY IF EXISTS "users in same school can see classmates" ON public.profiles;
CREATE POLICY "teachers see classmates in school"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL
  AND public.is_teacher_of(school_id)
);

-- 3) questions_correct_answer_exposed: drop student-visible policy on questions
DROP POLICY IF EXISTS "questions visible to same school" ON public.questions;
-- (teachers retain access via the existing "teachers manage questions" ALL policy)

-- 4) test_score_fabrication: students may no longer write to test_attempts / attempt_answers
DROP POLICY IF EXISTS "students manage own attempts" ON public.test_attempts;
CREATE POLICY "students see own attempts"
ON public.test_attempts
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.test_attempts FROM authenticated;

DROP POLICY IF EXISTS "students manage own answers" ON public.attempt_answers;
CREATE POLICY "students see own answers"
ON public.attempt_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.test_attempts a
    WHERE a.id = attempt_answers.attempt_id
      AND a.student_id = auth.uid()
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.attempt_answers FROM authenticated;

-- 5) user_roles_no_teacher_visibility: explicit deny-by-default for writes; only super_admin can modify
CREATE POLICY "super admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "super admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "super admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 6) school_invites_email_exposure: scope SELECT to super_admins only; teachers retain manage via separate write policies
DROP POLICY IF EXISTS "teachers manage invites in their school" ON public.school_invites;

CREATE POLICY "super admins read invites"
ON public.school_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "teachers insert invites in their school"
ON public.school_invites
FOR INSERT
TO authenticated
WITH CHECK (public.is_teacher_of(school_id));

CREATE POLICY "teachers update invites in their school"
ON public.school_invites
FOR UPDATE
TO authenticated
USING (public.is_teacher_of(school_id))
WITH CHECK (public.is_teacher_of(school_id));

CREATE POLICY "teachers delete invites in their school"
ON public.school_invites
FOR DELETE
TO authenticated
USING (public.is_teacher_of(school_id));
