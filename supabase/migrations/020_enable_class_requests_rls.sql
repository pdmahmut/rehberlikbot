CREATE OR REPLACE FUNCTION public.app_request_header(header_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (COALESCE(current_setting('request.headers', true), '{}')::jsonb ->> lower(header_name)),
    ''
  );
$$;

ALTER TABLE public.class_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_requests_select_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_insert_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_update_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_delete_policy ON public.class_requests;

CREATE POLICY class_requests_select_policy
ON public.class_requests
FOR SELECT
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND (
      public.app_request_header('x-class-key') = ''
      OR class_key = public.app_request_header('x-class-key')
    )
  )
);

CREATE POLICY class_requests_insert_policy
ON public.class_requests
FOR INSERT
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status = 'pending'
  )
);

CREATE POLICY class_requests_update_policy
ON public.class_requests
FOR UPDATE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status = 'pending'
  )
)
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status = 'pending'
  )
);

CREATE POLICY class_requests_delete_policy
ON public.class_requests
FOR DELETE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status = 'pending'
  )
);
