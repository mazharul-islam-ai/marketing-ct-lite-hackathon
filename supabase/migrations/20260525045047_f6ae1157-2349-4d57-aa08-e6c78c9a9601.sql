ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.set_project_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_tasks_completed_at ON public.project_tasks;
CREATE TRIGGER trg_project_tasks_completed_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_project_task_completed_at();

UPDATE public.project_tasks
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;