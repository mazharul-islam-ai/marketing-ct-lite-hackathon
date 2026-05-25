## Problem
The `project_tasks` table is missing the `completed_at` column, but frontend hooks (`useTeamTasks`, `useProjectTasks`, `useAnalytics`, etc.) and the Team Dashboard query select it — causing a 400 from PostgREST: `column project_tasks.completed_at does not exist`.

## Fix
Add the missing column via migration and auto-populate it when status transitions to `completed`.

### Migration
```sql
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

-- Backfill existing completed rows
UPDATE public.project_tasks
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;
```

## Scope
- Database migration only. No frontend changes needed — existing code already references `completed_at`.

## How to test
1. Reload `/tasks/team-dashboard` — no 400 error in network tab.
2. Mark a task `completed` → `completed_at` populates automatically.
3. Change status away from `completed` → `completed_at` clears.