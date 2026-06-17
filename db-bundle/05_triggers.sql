CREATE TRIGGER trg_project_tasks_completed_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION set_project_task_completed_at();
CREATE TRIGGER update_seo_blog_content_updated_at BEFORE UPDATE ON public.seo_blog_content FOR EACH ROW EXECUTE FUNCTION update_seo_blog_updated_at();
