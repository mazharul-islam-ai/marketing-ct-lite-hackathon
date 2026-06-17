CREATE UNIQUE INDEX idx_ai_agents_slug ON public.ai_agents USING btree (slug) WHERE (slug IS NOT NULL);
CREATE UNIQUE INDEX organization_integrations_integration_type_unique_idx ON public.organization_integrations USING btree (integration_type);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
