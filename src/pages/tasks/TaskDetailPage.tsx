import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Calendar, Clock, Tag, Edit, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ProjectTask, TaskCategory, useUpdateProjectTask } from "@/hooks/useProjectTasks";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskCommentsSection } from "@/components/tasks/TaskCommentsSection";
import { InlineAssigneeSelect } from "@/components/tasks/InlineAssigneeSelect";
import { InlinePrioritySelect } from "@/components/tasks/InlinePrioritySelect";
import { UrlRenderer } from "@/components/tasks/UrlRenderer";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const getStatusColor = (status: ProjectTask['status']) => {
  switch (status) {
    case 'todo': return 'bg-slate-100 text-slate-800 hover:bg-slate-200';
    case 'in_progress': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    case 'review': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'blocked': return 'bg-red-100 text-red-800 hover:bg-red-200';
    default: return 'bg-slate-100 text-slate-800';
  }
};

const getCategoryColor = (category: TaskCategory | undefined) => {
  switch (category) {
    case 'clients': return 'bg-blue-100 text-blue-800';
    case 'development': return 'bg-purple-100 text-purple-800';
    case 'design': return 'bg-pink-100 text-pink-800';
    case 'marketing': return 'bg-indigo-100 text-indigo-800';
    case 'content': return 'bg-cyan-100 text-cyan-800';
    case 'seo': return 'bg-teal-100 text-teal-800';
    case 'analytics': return 'bg-amber-100 text-amber-800';
    case 'support': return 'bg-emerald-100 text-emerald-800';
    case 'other': return 'bg-gray-100 text-gray-800';
    default: return 'bg-slate-100 text-slate-800';
  }
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  general: 'General',
  clients: 'Clients',
  development: 'Development',
  design: 'Design',
  marketing: 'Marketing',
  content: 'Content',
  seo: 'SEO',
  analytics: 'Analytics',
  support: 'Support',
  other: 'Other'
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  completed: 'Completed',
  blocked: 'Blocked'
};

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showEditForm, setShowEditForm] = useState(false);
  const updateTask = useUpdateProjectTask();

  // Get navigation context from URL params
  const fromContext = searchParams.get('from');
  const brandSlug = searchParams.get('brandSlug');
  const brandName = searchParams.get('brandName');

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['project-task', taskId],
    queryFn: async () => {
      if (!taskId) throw new Error('Task ID required');
      
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          brands:brand_id(id, name, slug),
          projects:project_id(id, name),
          clients:client_id(id, name, company)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;
      return data as unknown as ProjectTask & { 
        brands: { id: string; name: string; slug: string } | null;
        projects: { id: string; name: string } | null;
        clients: { id: string; name: string; company: string | null } | null;
      };
    },
    enabled: !!taskId,
  });

  const handleStatusChange = (newStatus: ProjectTask['status']) => {
    if (!task) return;
    updateTask.mutate({
      id: task.id,
      updates: { status: newStatus }
    });
  };

  const handlePriorityChange = (newPriority: 'low' | 'normal' | 'high' | 'urgent') => {
    if (!task) return;
    // Map 'normal' to 'medium' for the database
    const dbPriority = newPriority === 'normal' ? 'medium' : newPriority;
    updateTask.mutate({
      id: task.id,
      updates: { priority: dbPriority as ProjectTask['priority'] }
    });
  };

  const handleAssigneeChange = (userId: string | null) => {
    if (!task) return;
    updateTask.mutate({
      id: task.id,
      updates: { assigned_to: userId }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Task Not Found</h3>
          <p className="text-muted-foreground">
            The task you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
        <Button onClick={() => navigate('/tasks')}>
          Back to Tasks
        </Button>
      </div>
    );
  }

  // Handle back navigation based on context
  const handleBack = () => {
    if (fromContext === 'brand' && brandSlug) {
      navigate(`/brands/${brandSlug}?tab=tasks`);
    } else {
      navigate(-1);
    }
  };

  // Map database priority to component priority
  const displayPriority = task.priority === 'medium' ? 'normal' : task.priority;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="mb-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            {fromContext === 'brand' && brandSlug ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/brands">Brands</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to={`/brands/${brandSlug}?tab=tasks`}>{brandName || 'Brand'}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              </>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/tasks">Tasks</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[200px] truncate">{task.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={handleBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge 
                variant="outline" 
                className={`${getStatusColor(task.status)} cursor-pointer text-sm px-3 py-1.5 flex items-center gap-1`}
              >
                {STATUS_LABELS[task.status]}
                <ChevronDown className="h-3 w-3" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <DropdownMenuItem 
                  key={value} 
                  onClick={() => handleStatusChange(value as ProjectTask['status'])}
                >
                  {label}
                  {task.status === value && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowEditForm(true)} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Task
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="space-y-3">
                <CardTitle className="text-2xl">{task.title}</CardTitle>
                {/* Project and Client Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {task.projects && (
                    <p className="text-sm text-muted-foreground">
                      Project: <span className="text-foreground font-medium">{task.projects.name}</span>
                    </p>
                  )}
                  {task.clients && (
                    <p className="text-sm text-muted-foreground">
                      Client: <span className="text-foreground font-medium">{task.clients.name}</span>
                      {task.clients.company && <span className="text-muted-foreground"> ({task.clients.company})</span>}
                    </p>
                  )}
                </div>
                {/* Inline Badges Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <InlinePrioritySelect
                    value={displayPriority as 'low' | 'normal' | 'high' | 'urgent'}
                    onChange={handlePriorityChange}
                  />
                  {task.category && (
                    <Badge variant="outline" className={getCategoryColor(task.category)}>
                      <Tag className="h-3 w-3 mr-1" />
                      {CATEGORY_LABELS[task.category]}
                    </Badge>
                  )}
                  {task.brands && (
                    <Badge variant="secondary">
                      {task.brands.name}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Description
                </h3>
                {task.description ? (
                  <UrlRenderer text={task.description} className="text-foreground" />
                ) : (
                  <p className="text-muted-foreground italic">No description provided</p>
                )}
              </div>

              <Separator />

              {/* Comments Section */}
              <TaskCommentsSection taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Assigned To Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Assigned To
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InlineAssigneeSelect
                value={task.assigned_to}
                onChange={handleAssigneeChange}
              />
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Created
                </div>
                <p className="font-medium pl-6">
                  {format(new Date(task.created_at), 'MMM d, yyyy')}
                </p>
              </div>

              {task.due_date && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Due Date
                  </div>
                  <p className="font-medium pl-6">
                    {format(new Date(task.due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              {task.estimated_hours && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Estimated
                  </div>
                  <p className="font-medium pl-6">{task.estimated_hours} hours</p>
                </div>
              )}

              {task.actual_hours && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Actual
                  </div>
                  <p className="font-medium pl-6">{task.actual_hours} hours</p>
                </div>
              )}

              {task.completed_at && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Completed
                  </div>
                  <p className="font-medium pl-6">
                    {format(new Date(task.completed_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskForm 
        open={showEditForm}
        onOpenChange={setShowEditForm}
        task={task}
      />
    </div>
  );
}
