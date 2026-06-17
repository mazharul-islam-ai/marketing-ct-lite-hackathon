CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'super_admin' THEN 5 WHEN 'manager' THEN 4 WHEN 'brand_manager' THEN 3 WHEN 'pm' THEN 2 ELSE 1 END DESC LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$
;
CREATE OR REPLACE FUNCTION public.set_project_task_completed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_seo_blog_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.user_has_brand_access(_user_id uuid, _brand_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_brands WHERE user_id = _user_id AND brand_id = _brand_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'manager'));
$function$
;
CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'manager', 'pm'));
$function$
;
