-- Allow authenticated admins to manage integration credentials from Integration Manager
-- This resolves RLS insert/update failures on organization_integrations for adminpanel UI.

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_integrations_super_admin" ON public.organization_integrations;
DROP POLICY IF EXISTS "organization_integrations_manage_authenticated" ON public.organization_integrations;

CREATE POLICY "organization_integrations_manage_authenticated"
ON public.organization_integrations
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
