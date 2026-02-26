import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useMyTasks, useMyTasksStats, useUserInfo, TaskViewMode } from "@/hooks/useMyTasks";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Plus, CheckCircle, Clock, AlertCircle, XCircle, Filter, X, ArrowLeft } from "lucide-react";
import { TASK_CATEGORIES, TaskCategory, ProjectTask } from "@/hooks/useProjectTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useAuth } from "@/hooks/useAuth";

// Hook to fetch brands for filtering
const useBrands = () => {
  return useQuery({
    queryKey: ['brands-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching brands:', error);
        throw error;
      }

      return data;
    },
    staleTime: 60000,
  });
};

const STATUS_OPTIONS: Array<{ value: ProjectTask['status']; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS: Array<{ value: ProjectTask['priority']; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

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
  other: 'Other',
};

export default function MyTasksIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasMinimumRole } = useAuth();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);

  // Get filter values from URL
  const viewMode = (searchParams.get('view') as TaskViewMode) || 'assigned';
  const brandId = searchParams.get('brand') || undefined;
  const category = searchParams.get('category') as TaskCategory | undefined;
  const status = searchParams.get('status') as ProjectTask['status'] | undefined;
  const priority = searchParams.get('priority') as ProjectTask['priority'] | undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const assigneeId = searchParams.get('assignee') || undefined;

  // Check if viewing another user's tasks
  const isViewingOtherUser = assigneeId && assigneeId !== user?.id;

  // Fetch assignee info if viewing another user's tasks
  const { data: assigneeInfo } = useUserInfo(isViewingOtherUser ? assigneeId : undefined);

  // Fetch data
  const { data: brandsData } = useBrands();
  const { data: statsData, isLoading: statsLoading } = useMyTasksStats(viewMode, assigneeId);
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useMyTasks({
    brandId,
    category,
    status,
    priority,
    page,
    limit: 10,
    viewMode,
    assigneeId,
  });

  const tasks = tasksData?.tasks || [];
  const totalCount = tasksData?.count || 0;
  const totalPages = Math.ceil(totalCount / 10);

  // Update filter function
  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  // Clear all filters
  const clearFilters = () => {
    const newParams: Record<string, string> = { view: viewMode };
    // Keep assignee param when clearing other filters
    if (assigneeId) {
      newParams.assignee = assigneeId;
    }
    setSearchParams(newParams);
  };

  // Get assignee display name
  const getAssigneeName = () => {
    if (!assigneeInfo) return 'Team Member';
    const firstName = assigneeInfo.first_name;
    const lastName = assigneeInfo.last_name;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return assigneeInfo.email?.split('@')[0] || 'Team Member';
  };

  // Handle view mode change
  const handleViewModeChange = (newViewMode: TaskViewMode) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', newViewMode);
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  // Check if any filters are active
  const hasActiveFilters = brandId || category || status || priority;

  // Handle page change
  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  // Handle task edit
  const handleEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  // Handle new task
  const handleNewTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            {isViewingOtherUser && (
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Link to="/tasks/team-dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Team Dashboard
                </Link>
              </div>
            )}
            <h1 className="text-3xl font-bold">
              {isViewingOtherUser ? `${getAssigneeName()}'s Tasks` : 'My Tasks'}
            </h1>
            <p className="text-muted-foreground">
              {isViewingOtherUser ? (
                `Tasks assigned to ${getAssigneeName()}`
              ) : (
                <>
                  {viewMode === 'assigned' && 'Tasks assigned to you'}
                  {viewMode === 'delegated' && 'Tasks you created and delegated to others'}
                  {viewMode === 'all' && 'All your tasks - assigned to you or created by you'}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={brandId || 'all'} onValueChange={(value) => updateFilter('brand', value === 'all' ? null : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brandsData?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category || 'all'} onValueChange={(value) => updateFilter('category', value === 'all' ? null : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TASK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority || 'all'} onValueChange={(value) => updateFilter('priority', value === 'all' ? null : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={handleNewTask}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs - Only show for own tasks */}
      {!isViewingOtherUser && (
        <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as TaskViewMode)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
            <TabsTrigger value="delegated">Delegated</TabsTrigger>
            <TabsTrigger value="all">All My Tasks</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {statsLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.total || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">To Do</CardTitle>
                <Clock className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.todo || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <AlertCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.in_progress || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.completed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.blocked || 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasksLoading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : tasksError ? (
          // Error state
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
              <p className="text-lg font-medium mb-2">Error loading tasks</p>
              <p className="text-sm text-muted-foreground mb-4">There was an error fetching your tasks. Please try again.</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          // Empty states
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              {hasActiveFilters ? (
                <>
                  <Filter className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No tasks match your filters</p>
                  <p className="text-sm text-muted-foreground mb-4">Try adjusting or clearing your filters to see more tasks.</p>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </>
              ) : isViewingOtherUser ? (
                <>
                  <Clock className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No tasks assigned to {getAssigneeName()}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    This team member doesn't have any tasks assigned yet.
                  </p>
                  <Link to="/tasks/team-dashboard">
                    <Button variant="outline">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Team Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Clock className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {viewMode === 'assigned' && 'No tasks assigned to you yet'}
                    {viewMode === 'delegated' && 'No delegated tasks'}
                    {viewMode === 'all' && 'No tasks found'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {viewMode === 'assigned' && 'When tasks are assigned to you, they will appear here.'}
                    {viewMode === 'delegated' && 'Tasks you create and assign to others will appear here.'}
                    {viewMode === 'all' && 'You don\'t have any tasks yet.'}
                  </p>
                  <Button onClick={handleNewTask}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create a Task
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          // Task cards
          <>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onEdit={handleEditTask} />
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => page > 1 && handlePageChange(page - 1)}
                className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber: number;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (page <= 3) {
                pageNumber = i + 1;
              } else if (page >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = page - 2 + i;
              }

              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    onClick={() => handlePageChange(pageNumber)}
                    isActive={page === pageNumber}
                    className="cursor-pointer"
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => page < totalPages && handlePageChange(page + 1)}
                className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Task Form Dialog */}
      <TaskForm
        open={showTaskForm}
        onOpenChange={handleFormClose}
        task={editingTask || undefined}
        defaultAssignedTo={user?.id}
      />
    </div>
  );
}
