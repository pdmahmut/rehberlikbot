DROP POLICY IF EXISTS class_requests_update_policy ON public.class_requests;

CREATE POLICY class_requests_update_policy
ON public.class_requests
FOR UPDATE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status IN ('pending', 'completed')
  )
)
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status IN ('pending', 'completed')
  )
);
