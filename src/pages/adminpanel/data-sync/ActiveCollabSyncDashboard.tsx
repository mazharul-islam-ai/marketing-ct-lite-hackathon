import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Database, AlertTriangle, Code, Search, BarChart, Key, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useActiveCollabSync } from '@/hooks/useActiveCollabSync';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { encryptValue } from '@/lib/encryption';

export default function ActiveCollabSyncDashboard() {
  const { syncLogs, projects, logsLoading, projectsLoading, syncAll, syncProject, syncProgress, lastSync } = useActiveCollabSync();
  const { user } = useAuth();
  const [confirmSync, setConfirmSync] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugProjectId, setDebugProjectId] = useState('');
  const [debugLimit, setDebugLimit] = useState('10');
  const [debugPage, setDebugPage] = useState('1');
  const [debugTaskId, setDebugTaskId] = useState('');
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [dbDebugResult, setDbDebugResult] = useState<any>(null);
  const [dbDebugLoading, setDbDebugLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Credentials state
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [apiUrl, setApiUrl] = useState('https://app.activecollab.com/api/v1');
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [hasBearerToken, setHasBearerToken] = useState(false);

  // Check if user is super admin
  const isSuperAdmin = user?.role === 'super_admin';

  // Load existing credentials on mount
  useEffect(() => {
    if (isSuperAdmin) {
      loadCredentials();
    }
  }, [isSuperAdmin]);

  const loadCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('activecollab_credentials')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHasExistingCredentials(true);
        // Email is now stored as plain text
        setEmail(data.email || '');
        setApiUrl(data.api_url || 'https://app.activecollab.com/api/v1');
        // Check if bearer token exists
        if (data.bearer_token) {
          setHasBearerToken(true);
        }
        // Don't set password or bearer token for security
        setPassword('');
        setBearerToken('');
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const handleSaveCredentials = async () => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can save credentials');
      return;
    }

    if (!email || !password || !apiUrl) {
      toast.error('Please fill in all fields');
      return;
    }

    setSavingCredentials(true);
    try {
      // Encrypt password
      const encryptedPassword = await encryptValue(password);

      // Bearer token stores the email as Base64-encoded JSON object
      // Format: {"email": "user@example.com"}
      const bearerTokenJson = JSON.stringify({ email: email });
      const encodedBearerToken = btoa(bearerTokenJson);

      // Prepare update data - email is now stored as plain text
      const updateData: any = {
        email: email, // Plain text email
        password_encrypted: encryptedPassword,
        api_url: apiUrl,
        updated_by: user?.id,
        bearer_token: encodedBearerToken, // Auto-generated from email as Base64-encoded JSON
      };

      if (hasExistingCredentials) {
        // Update existing credentials
        const { error } = await supabase
          .from('activecollab_credentials')
          .update(updateData)
          .eq('is_active', true);

        if (error) throw error;
      } else {
        // Insert new credentials
        const { error } = await supabase
          .from('activecollab_credentials')
          .insert({
            ...updateData,
            is_active: true,
            created_by: user?.id,
          });

        if (error) throw error;
      }

      toast.success('ActiveCollab credentials saved successfully');
      setHasExistingCredentials(true);
      setHasBearerToken(true); // Bearer token is always set (auto-generated from email)
      setPassword(''); // Clear password after saving
    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast.error(`Failed to save credentials: ${error.message}`);
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSync = () => {
    if (!confirmSync) {
      setConfirmSync(true);
      setTimeout(() => setConfirmSync(false), 5000);
      return;
    }
    syncAll.mutate();
    setConfirmSync(false);
  };

  const handleCompareWithActiveCollab = async () => {
    if (!debugProjectId) {
      toast.error('Please select a project');
      return;
    }
    setComparisonLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: {
          action: 'sync_project_detailed',
          projectId: debugProjectId,
        },
      });
      if (error) throw error;
      setComparisonResult(data);
      toast.success('Comparison completed successfully');
    } catch (error) {
      console.error('Comparison error:', error);
      toast.error('Failed to compare with ActiveCollab');
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleFetchRawTasks = async () => {
    if (!debugProjectId) {
      toast.error('Please select a project');
      return;
    }
    setDebugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: {
          action: 'debug_get_all_raw',
          projectId: debugProjectId,
          perPage: parseInt(debugLimit),
          page: parseInt(debugPage),
        },
      });
      if (error) throw error;
      setDebugResult(data);
      toast.success('Raw tasks data fetched successfully');
    } catch (error) {
      console.error('Debug fetch error:', error);
      toast.error('Failed to fetch raw tasks data');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleFetchRawComments = async () => {
    if (!debugTaskId) {
      toast.error('Please enter a task ID');
      return;
    }
    if (!debugProjectId) {
      toast.error('Please select a project');
      return;
    }
    setDebugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: {
          action: 'debug_get_comments_raw',
          taskId: debugTaskId,
          projectId: debugProjectId,
        },
      });
      if (error) throw error;
      setDebugResult(data);
      toast.success('Raw comments data fetched successfully');
    } catch (error) {
      console.error('Debug fetch error:', error);
      toast.error('Failed to fetch raw comments data');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleFetchDbTasks = async () => {
    if (!debugProjectId) {
      toast.error('Please select a project');
      return;
    }
    setDbDebugLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', debugProjectId)
        .order('created_at', { ascending: false })
        .limit(parseInt(debugLimit));
      
      if (error) throw error;
      setDbDebugResult({ type: 'tasks', data, count: data?.length || 0 });
      toast.success(`Fetched ${data?.length || 0} tasks from database`);
    } catch (error) {
      console.error('Database debug fetch error:', error);
      toast.error('Failed to fetch tasks from database');
    } finally {
      setDbDebugLoading(false);
    }
  };

  const handleFetchDbComments = async () => {
    if (!debugTaskId) {
      toast.error('Please enter a task ID');
      return;
    }
    if (!debugProjectId) {
      toast.error('Please select a project');
      return;
    }
    setDbDebugLoading(true);
    try {
      // Fetch comments from ActiveCollab API using bearer token from activecollab_credentials
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: {
          action: 'debug_get_comments_raw',
          taskId: debugTaskId,
          projectId: debugProjectId,
        },
      });
      
      if (error) throw error;
      
      // Extract comments array from response
      const comments = data?.comments || data?.data?.comments || data?.data || data || [];
      const commentsList = Array.isArray(comments) ? comments : [];
      
      setDbDebugResult({ type: 'comments', data: commentsList, count: commentsList.length });
      toast.success(`Fetched ${commentsList.length} comments using bearer token`);
    } catch (error) {
      console.error('Comments fetch error:', error);
      toast.error('Failed to fetch comments from ActiveCollab');
    } finally {
      setDbDebugLoading(false);
    }
  };

  const stats = {
    totalProjects: projects?.length || 0,
    lastSyncTime: (lastSync as any)?.created_at
      ? formatDistanceToNow(new Date((lastSync as any).created_at), { addSuffix: true })
      : 'Never',
    totalSyncs: syncLogs?.length || 0,
    successRate: syncLogs
      ? ((syncLogs.filter(l => l.status === 'success' || l.status === 'partial_success').length / syncLogs.length) * 100).toFixed(0)
      : 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ActiveCollab Sync Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage data synchronization from ActiveCollab
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncAll.isPending}
          variant={confirmSync ? 'destructive' : 'default'}
          size="lg"
        >
          {syncAll.isPending ? (
            <>
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Syncing...
            </>
          ) : confirmSync ? (
            <>
              <AlertTriangle className="mr-2 h-5 w-5" />
              Click Again to Confirm
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-5 w-5" />
              Sync All Data
            </>
          )}
        </Button>
      </div>

      {/* Sync Progress Alert */}
      {syncProgress && syncProgress.progress !== undefined && (
        <Alert className="border-primary">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Sync in Progress</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-2">
              <p className="font-medium">{syncProgress.currentStep}</p>
              {syncProgress.currentProject && (
                <p className="text-sm text-muted-foreground">
                  Current: <span className="font-medium">{syncProgress.currentProject}</span>
                </p>
              )}
              <Progress value={syncProgress.progress} className="w-full" />
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span>Progress: {Math.round(syncProgress.progress)}%</span>
                {syncProgress.totalProjects && (
                  <span>Projects: {syncProgress.projectsProcessed || 0}/{syncProgress.totalProjects}</span>
                )}
                {syncProgress.tasksSynced !== undefined && (
                  <span>Tasks: {syncProgress.tasksSynced}</span>
                )}
                {syncProgress.commentsSynced !== undefined && (
                  <span>Comments: {syncProgress.commentsSynced}</span>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Automated Sync Info Alert */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Automated Sync Schedule</AlertTitle>
        <AlertDescription>
          ActiveCollab data automatically syncs every 12 hours (00:00 and 12:00 UTC).
          Last successful sync: <strong>{stats.lastSyncTime}</strong>
        </AlertDescription>
      </Alert>

      {/* ActiveCollab Credentials - Super Admin Only */}
      {isSuperAdmin && (
        <Card>
          <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <CardTitle>ActiveCollab Integration Settings</CardTitle>
                    <Badge variant="destructive">Super Admin Only</Badge>
                    {hasExistingCredentials && (
                      <Badge variant="default">Configured</Badge>
                    )}
                  </div>
                  <AlertTriangle className={`h-4 w-4 transition-transform ${credentialsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                Configure ActiveCollab API credentials. These credentials are used for all synchronization operations.
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ac-email">ActiveCollab Email</Label>
                  <Input
                    id="ac-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email used as username for Basic Auth (projects/tasks)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ac-password">ActiveCollab Password</Label>
                  <div className="relative">
                    <Input
                      id="ac-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={hasExistingCredentials ? '••••••••' : 'Enter password'}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password is encrypted using AES-GCM before storage. Used for fetching projects and tasks.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bearer Token (for Comments)</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Bearer token is <strong>auto-generated</strong> from the email address and stored as Base64-encoded JSON.
                    </p>
                    {hasBearerToken && (
                      <p className="text-sm text-green-600 font-medium mt-1">✓ Configured</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ac-api-url">API URL</Label>
                  <Input
                    id="ac-api-url"
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://app.activecollab.com/api/v1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={savingCredentials || !email || !password || !apiUrl}
                  >
                    {savingCredentials ? 'Saving...' : hasExistingCredentials ? 'Update Credentials' : 'Save Credentials'}
                  </Button>
                  {hasExistingCredentials && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Credentials configured
                    </Badge>
                  )}
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Security Note</AlertTitle>
                  <AlertDescription>
                    These credentials are securely stored and only accessible by super administrators.
                    They are used by the system to authenticate with ActiveCollab API.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connected Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalProjects}</span>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.lastSyncTime}</span>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalSyncs}</span>
              <BarChart className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.successRate}%</span>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={Number(stats.successRate)} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Project Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle>Project Sync Status</CardTitle>
          <CardDescription>
            All projects with ActiveCollab integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading projects...</div>
          ) : projects && projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>ActiveCollab ID</TableHead>
                  <TableHead className="text-center">Tasks</TableHead>
                  <TableHead className="text-center">Comments</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.activecollab_project_id}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {project.task_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {project.comment_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {project.activecollab_sync_at
                        ? formatDistanceToNow(new Date(project.activecollab_sync_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.activecollab_sync_at ? 'default' : 'secondary'}>
                        {project.activecollab_sync_at ? 'Synced' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncProject.mutate(project.id)}
                        disabled={syncProject.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncProject.isPending ? 'animate-spin' : ''}`} />
                        Sync
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No projects with ActiveCollab integration found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Panel - Admin Only */}
      <Card>
        <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  <CardTitle>Debug Panel</CardTitle>
                  <Badge variant="secondary">Admin Only</Badge>
                </div>
                <AlertTriangle className={`h-4 w-4 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CardDescription>
              Fetch raw API responses to debug data extraction issues
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Tasks Debug */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Fetch Raw Tasks</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="debug-project">Project</Label>
                    <Select value={debugProjectId} onValueChange={setDebugProjectId}>
                      <SelectTrigger id="debug-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.activecollab_project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debug-limit">Limit</Label>
                    <Input
                      id="debug-limit"
                      type="number"
                      value={debugLimit}
                      onChange={(e) => setDebugLimit(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debug-page">Page</Label>
                    <Input
                      id="debug-page"
                      type="number"
                      value={debugPage}
                      onChange={(e) => setDebugPage(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
                <Button onClick={handleFetchRawTasks} disabled={debugLoading || !debugProjectId}>
                  {debugLoading ? 'Fetching...' : 'Fetch Raw Tasks'}
                </Button>
              </div>

              {/* Comments Debug */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Fetch Raw Comments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="debug-comments-project">Project</Label>
                    <Select value={debugProjectId} onValueChange={setDebugProjectId}>
                      <SelectTrigger id="debug-comments-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.activecollab_project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debug-task-id">Task ID</Label>
                    <Input
                      id="debug-task-id"
                      type="text"
                      value={debugTaskId}
                      onChange={(e) => setDebugTaskId(e.target.value)}
                      placeholder="Enter ActiveCollab Task ID"
                    />
                  </div>
                </div>
                <Button onClick={handleFetchRawComments} disabled={debugLoading || !debugTaskId || !debugProjectId}>
                  {debugLoading ? 'Fetching...' : 'Fetch Raw Comments'}
                </Button>
              </div>

              {/* Database Debug - Tasks */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-sm font-semibold text-blue-600">Database Debug - Tasks</h3>
                <p className="text-xs text-muted-foreground">Query synced tasks from the database</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db-debug-project">Project</Label>
                    <Select value={debugProjectId} onValueChange={setDebugProjectId}>
                      <SelectTrigger id="db-debug-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-debug-limit">Limit</Label>
                    <Input
                      id="db-debug-limit"
                      type="number"
                      value={debugLimit}
                      onChange={(e) => setDebugLimit(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
                <Button onClick={handleFetchDbTasks} disabled={dbDebugLoading || !debugProjectId} variant="secondary">
                  <Database className="h-4 w-4 mr-2" />
                  {dbDebugLoading ? 'Fetching...' : 'Fetch DB Tasks'}
                </Button>
              </div>

              {/* Fetch Comments using Bearer Token */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-sm font-semibold text-green-600">Fetch Comments (Bearer Token)</h3>
                <p className="text-xs text-muted-foreground">
                  Fetch task comments from ActiveCollab API using bearer token from credentials
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db-debug-project">Project</Label>
                    <Select value={debugProjectId} onValueChange={setDebugProjectId}>
                      <SelectTrigger id="db-debug-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.activecollab_project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-debug-task-id">ActiveCollab Task ID</Label>
                    <Input
                      id="db-debug-task-id"
                      type="text"
                      value={debugTaskId}
                      onChange={(e) => setDebugTaskId(e.target.value)}
                      placeholder="Enter ActiveCollab Task ID"
                    />
                  </div>
                </div>
                <Button onClick={handleFetchDbComments} disabled={dbDebugLoading || !debugTaskId || !debugProjectId} variant="secondary">
                  <Key className="h-4 w-4 mr-2" />
                  {dbDebugLoading ? 'Fetching...' : 'Fetch Comments (Bearer Token)'}
                </Button>
              </div>

              {/* Debug Results */}
              {debugResult && (
                <div className="space-y-2">
                  <Label>Raw Response Preview</Label>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(debugResult, null, 2).substring(0, 2000)}
                      {JSON.stringify(debugResult, null, 2).length > 2000 && '\n\n... (truncated)'}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Full response logged to browser console and edge function logs
                  </p>
                </div>
              )}

              {/* API/Database Results */}
              {dbDebugResult && (
                <div className="space-y-2 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <Label>
                      {dbDebugResult.type === 'tasks' ? 'Database Results' : 'ActiveCollab API Results'} ({dbDebugResult.type})
                    </Label>
                    <Badge variant="outline" className="font-mono">
                      {dbDebugResult.count} records
                    </Badge>
                  </div>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(dbDebugResult.data, null, 2).substring(0, 3000)}
                      {JSON.stringify(dbDebugResult.data, null, 2).length > 3000 && '\n\n... (truncated)'}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dbDebugResult.type === 'tasks' 
                      ? 'Showing project_tasks table data' 
                      : 'Comments fetched from ActiveCollab API using bearer token'}
                  </p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent synchronization operations</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sync history...</div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {formatDistanceToNow(new Date((log as any).created_at || (log as any).started_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.sync_type}</Badge>
                    </TableCell>
                    <TableCell>{(log as any).entity_type || log.sync_type}</TableCell>
                    <TableCell>{(log as any).entity_count || log.records_synced}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.status === 'success' || log.status === 'partial_success' ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <Badge variant="default">
                              {log.status === 'partial_success' ? 'Partial' : 'Success'}
                            </Badge>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <Badge variant="destructive">Failed</Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No sync history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
