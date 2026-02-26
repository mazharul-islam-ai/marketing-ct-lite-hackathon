import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LeaderFormDialog } from "@/features/linkedin-content/components/LeaderFormDialog";
import { UploadDialog } from "@/features/linkedin-content/components/UploadDialog";
import { AnalyticsUploadDialog } from "@/features/linkedin-content/components/AnalyticsUploadDialog";
import { EditPostDialog } from "@/features/linkedin-content/components/EditPostDialog";
import {
  useLinkedInLeader,
  useLeaderUploads,
  useCreateUpload,
  useDeleteUpload,
  useWeeklyTrends,
  useGenerateWeeklyTrends,
  useGeneratedPosts,
  useGeneratePost,
  useUpdateLeader,
  useUpdatePost,
  useDeleteLeader,
  useDeletePost,
} from "@/features/linkedin-content/hooks";
import { useLeaderAnalytics, useAnalyticsSummary } from "@/hooks/useLeaderAnalytics";
import { GeneratedPost, LeaderInput, LeaderUpload, WeeklyTrend } from "@/features/linkedin-content/types";
import { uploadDocument } from "@/features/linkedin-content/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ChevronDown, Edit, ExternalLink, FileText, FileUp, Loader2, MoreVertical, RefreshCw, Settings, Save, Sparkles, Trash2, TrendingUp, Upload, Wand2, Users, Eye, Check, AlertCircle, LayoutDashboard, Lightbulb, FileEdit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { FileReviewDialog } from "@/components/linkedin/FileReviewDialog";
import { LeaderDashboardTab } from "@/components/linkedin/LeaderDashboardTab";
import { UnifiedIdeasTab } from "@/components/linkedin/UnifiedIdeasTab";
import { GeneratePostSheet } from "@/components/linkedin/GeneratePostSheet";
import { ContentStrategySection } from "@/features/linkedin-content/components/ContentStrategySection";

interface AgentTemplate {
  id: string;
  template_name: string;
  role_category: string;
  persona_tone: string;
  system_prompt: string;
  is_active: boolean;
}

const renderAudience = (audience: Record<string, unknown>) => {
  const entries = Object.entries(audience ?? {});
  if (entries.length === 0) {
    return <p className="text-muted-foreground">General LinkedIn audience</p>;
  }
  return (
    <ul className="grid gap-2 text-sm">
      {entries.map(([key, value]) => (
        <li key={key} className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <span className="font-medium capitalize">{key.replace(/_/g, " ")}</span>
          <span className="text-muted-foreground">{String(value)}</span>
        </li>
      ))}
    </ul>
  );
};

const UploadList = ({ 
  uploads, 
  onDelete, 
  onReview 
}: { 
  uploads: LeaderUpload[]; 
  onDelete: (uploadId: string) => void;
  onReview: (upload: LeaderUpload) => void;
}) => {
  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8" />
        <div>No knowledge documents yet.</div>
        <p className="max-w-md text-xs text-muted-foreground">
          Add reports, transcripts, or articles that capture this leader&apos;s thinking and expertise.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {uploads.map((upload) => (
        <Card key={upload.id} className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{upload.fileName}</CardTitle>
              <CardDescription className="flex items-center gap-2 text-xs">
                Added {upload.createdAt ? formatDistanceToNow(new Date(upload.createdAt), { addSuffix: true }) : 'recently'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onReview(upload)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Review Content
              </Button>
              
              {upload.openaiFileId ? (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Indexed
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not indexed
                </Badge>
              )}
              
              <Button variant="ghost" size="sm" onClick={() => onDelete(upload.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          {upload.fileSummary && (
            <CardContent>
              <p className="text-sm text-muted-foreground">{upload.fileSummary}</p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

const PostsList = ({
  posts,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  posts: GeneratedPost[];
  onEdit: (post: GeneratedPost) => void;
  onRegenerate: (post: GeneratedPost) => void;
  onDelete: (post: GeneratedPost) => void;
}) => {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <FileEdit className="mx-auto h-8 w-8 mb-3 opacity-50" />
        <p>No drafts yet.</p>
        <p className="mt-1 text-xs">Generate your first post from the Dashboard or Ideas tab.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <Card key={post.id} className="shadow-sm">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">{post.postTitle}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{post.sourceType}</Badge>
                <span className="text-xs text-muted-foreground">
                  Generated {post.generatedAt ? formatDistanceToNow(new Date(post.generatedAt), { addSuffix: true }) : 'recently'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p className="whitespace-pre-wrap leading-relaxed line-clamp-4">{post.postBody}</p>
            </div>
            {Array.isArray(post.extraPayload?.carousel_outline) && post.extraPayload.carousel_outline.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-4">
                <h4 className="text-sm font-semibold">Carousel outline</h4>
                <div className="mt-2 space-y-2">
                  {post.extraPayload.carousel_outline.slice(0, 3).map((slide: any, index: number) => (
                    <div key={`${post.id}-carousel-${index}`} className="text-sm">
                      <div className="font-medium">
                        Slide {typeof slide === 'object' ? (slide.slide_number || index + 1) : index + 1}: {' '}
                        {typeof slide === 'object' ? (slide.headline || slide.title || '') : slide}
                      </div>
                    </div>
                  ))}
                  {post.extraPayload.carousel_outline.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{post.extraPayload.carousel_outline.length - 3} more slides</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(post)}>
                <Edit className="mr-2 h-4 w-4" /> Edit draft
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerate(post)}
                disabled={post.sourceType === "custom" && !post.sourceReference}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{post.postTitle}". This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(post)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Draft
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const LinkedInLeaderDetailPage = () => {
  const { leaderSlug } = useParams<{ leaderSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [isLeaderDialogOpen, setLeaderDialogOpen] = useState(false);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isAnalyticsUploadOpen, setAnalyticsUploadOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [reviewUpload, setReviewUpload] = useState<LeaderUpload | null>(null);
  const [isFileReviewOpen, setFileReviewOpen] = useState(false);
  
  // Generate post sheet state
  const [isGenerateSheetOpen, setGenerateSheetOpen] = useState(false);
  const [selectedTrendForGeneration, setSelectedTrendForGeneration] = useState<WeeklyTrend | null>(null);
  const [customIdeaForGeneration, setCustomIdeaForGeneration] = useState<string>("");

  // Get active tab from URL or default to dashboard
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const { data: leader, isLoading: leaderLoading } = useLinkedInLeader(leaderSlug);
  const leaderId = leader?.id;

  // Redirect from UUID to slug URL
  useEffect(() => {
    if (leader && leaderSlug && leader.urlSlug && leaderSlug !== leader.urlSlug) {
      const currentPath = location.pathname;
      const newPath = currentPath.replace(leaderSlug, leader.urlSlug);
      navigate(newPath, { replace: true });
    }
  }, [leader, leaderSlug, navigate, location.pathname]);
  
  const { data: uploads = [], isLoading: uploadsLoading } = useLeaderUploads(leaderId);
  const { data: trends = [], isLoading: trendsLoading } = useWeeklyTrends(leaderId);
  const { data: posts = [], isLoading: postsLoading } = useGeneratedPosts(leaderId);
  const { data: analytics = [], isLoading: analyticsLoading, refetch: refetchAnalytics } = useLeaderAnalytics(leaderId);
  const { data: analyticsSummary } = useAnalyticsSummary(leaderId);

  const { data: agentTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ['agent-template', leader?.agentTemplateId],
    queryFn: async () => {
      if (!leader?.agentTemplateId) return null;
      const { data, error } = await supabase
        .from('linkedin_agent_templates')
        .select('*')
        .eq('id', leader.agentTemplateId)
        .single();
      if (error) throw error;
      return data as AgentTemplate;
    },
    enabled: !!leader?.agentTemplateId,
  });

  useEffect(() => {
    if (agentTemplate) {
      setEditedPrompt(agentTemplate.system_prompt);
    }
  }, [agentTemplate]);

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, system_prompt }: { id: string; system_prompt: string }) => {
      const { error } = await supabase
        .from('linkedin_agent_templates')
        .update({ system_prompt, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-template'] });
      setIsEditingPrompt(false);
      toast({ title: "Agent prompt updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update agent prompt", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateLeaderMutation = useUpdateLeader(leaderId);
  const createUploadMutation = useCreateUpload(leaderId);
  const deleteUploadMutation = useDeleteUpload(leaderId);
  const generateTrendsMutation = useGenerateWeeklyTrends(leaderId);
  const generatePostMutation = useGeneratePost(leaderId);
  const updatePostMutation = useUpdatePost(leaderId, selectedPost?.id);
  const deleteLeaderMutation = useDeleteLeader();
  const deletePostMutation = useDeletePost(leaderId);

  const bulkIndexMutation = useMutation({
    mutationFn: async () => {
      if (!leaderId) throw new Error('No leader ID');
      const { data, error } = await supabase.functions.invoke('bulk-index-leader-files', {
        body: { leaderId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.message === 'All files already indexed') {
        toast({ title: "All files already indexed", description: "No files needed indexing" });
      } else {
        toast({ 
          title: `Indexed ${data.successful ?? 0} of ${data.total ?? 0} documents`,
          description: data.failed > 0 ? `${data.failed} files failed to index` : undefined,
          variant: data.failed > 0 ? "destructive" : "default"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["leader-uploads", leaderId] });
    },
    onError: (error) => {
      toast({ title: "Indexing failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  });

  // Handler to open generate sheet
  const handleOpenGenerateSheet = (customIdea?: string) => {
    setSelectedTrendForGeneration(null);
    setCustomIdeaForGeneration(customIdea || "");
    setGenerateSheetOpen(true);
  };

  // Handler when clicking "Generate Post" from a trend
  const handleGenerateFromTrend = (trend: WeeklyTrend) => {
    setSelectedTrendForGeneration(trend);
    setCustomIdeaForGeneration("");
    setGenerateSheetOpen(true);
  };

  const handleLeaderSubmit = async (payload: LeaderInput) => {
    await updateLeaderMutation.mutateAsync(payload);
    setLeaderDialogOpen(false);
  };

  const handleUploadSubmit = async (payload: { fileName: string; fileUrl: string; fileSummary?: string | null }) => {
    if (!createUploadMutation) return;
    
    try {
      const newUpload = await createUploadMutation.mutateAsync(payload);
      if (newUpload?.id) {
        toast({ title: "Indexing document for AI search..." });
        const { error: indexError } = await supabase.functions.invoke('linkedin-upload-file-to-openai', {
          body: { uploadId: newUpload.id }
        });
        if (indexError) {
          toast({ title: "Document uploaded but indexing failed", variant: "destructive" });
        } else {
          toast({ title: "Document uploaded and indexed successfully" });
          await queryClient.invalidateQueries({ queryKey: ["leader-uploads", leaderId] });
        }
      }
      setUploadDialogOpen(false);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload document", variant: "destructive" });
    }
  };

  const handleFileUpload = async (payload: any) => {
    if (!leaderId) return;
    try {
      await uploadDocument(leaderId, payload);
      await queryClient.invalidateQueries({ queryKey: ["leader-uploads", leaderId] });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: newUploads } = await supabase
        .from('leader_uploads')
        .select('id')
        .eq('leader_id', leaderId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (newUploads && newUploads.length > 0) {
        toast({ title: "Indexing document for AI search..." });
        const { error: indexError } = await supabase.functions.invoke('linkedin-upload-file-to-openai', {
          body: { uploadId: newUploads[0].id }
        });
        if (indexError) {
          toast({ title: "Document uploaded but indexing failed", variant: "destructive" });
        } else {
          toast({ title: "Document uploaded and indexed successfully" });
        }
      }
      setUploadDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["leader-uploads", leaderId] });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload document", variant: "destructive" });
    }
  };

  const handleUploadDelete = (uploadId: string) => {
    deleteUploadMutation?.mutate(uploadId);
  };

  const handleReviewFile = (upload: LeaderUpload) => {
    setReviewUpload(upload);
    setFileReviewOpen(true);
  };

  const handleGenerateTrends = () => {
    generateTrendsMutation?.mutate();
  };

  const handleSavePrompt = () => {
    if (agentTemplate && editedPrompt) {
      updateTemplateMutation.mutate({ id: agentTemplate.id, system_prompt: editedPrompt });
    }
  };

  const handleCancelEdit = () => {
    if (agentTemplate) {
      setEditedPrompt(agentTemplate.system_prompt);
    }
    setIsEditingPrompt(false);
  };

  const handleRegenerate = (post: GeneratedPost) => {
    if (post.sourceType === "custom") {
      handleOpenGenerateSheet();
      return;
    }
    if (generatePostMutation && post.sourceReference && post.sourceType === "trend") {
      generatePostMutation.mutate({ sourceType: "trend", sourceId: post.sourceReference });
    }
  };

  const handleEditPost = (post: GeneratedPost) => {
    setSelectedPost(post);
  };

  const handleSavePost = async (payload: { postTitle?: string; postBody?: string }) => {
    if (!updatePostMutation) return;
    await updatePostMutation.mutateAsync(payload);
    setSelectedPost(null);
  };

  const handleDeletePost = (post: GeneratedPost) => {
    if (!leaderId) return;
    deletePostMutation.mutate(post.id);
  };

  const handleDeleteLeader = () => {
    if (!leaderId) return;
    deleteLeaderMutation.mutate(leaderId, {
      onSuccess: () => {
        navigate(`${location.pathname.split('/').slice(0, -1).join('/')}`);
      }
    });
  };

  const pageTitle = leader ? `${leader.name} – LinkedIn Content` : "LinkedIn Content";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back to list">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
          {leader && leader.updatedAt && (
            <p className="text-sm text-muted-foreground">
              Updated {formatDistanceToNow(new Date(leader.updatedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      {leaderLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading leader details…
        </div>
      )}

      {!leaderLoading && leader && (
        <>
          {/* Leader Profile Card */}
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{leader.name}</CardTitle>
                <CardDescription>{leader.title}</CardDescription>
                {leader.linkedinUrl && (
                  <a
                    href={leader.linkedinUrl}
                    className="inline-flex items-center text-sm text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View LinkedIn profile <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{leader.personaTone}</Badge>
                <Button variant="outline" onClick={() => setLeaderDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit profile
                </Button>
                <Button onClick={() => handleOpenGenerateSheet()}>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate post
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setLeaderDialogOpen(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Leader
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {leader.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the leader profile along with all uploads, weekly trends, and generated posts.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteLeader}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
          </Card>

          {/* Main Tabs - Simplified 4-Tab Structure */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="ideas" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Ideas
                {trends.length > 0 && <Badge variant="secondary" className="ml-1">{trends.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-2">
                <FileEdit className="h-4 w-4" />
                Drafts
                {posts.length > 0 && <Badge variant="secondary" className="ml-1">{posts.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              {leaderId && leaderSlug && (
                <LeaderDashboardTab
                  leaderName={leader.name}
                  leaderSlug={leaderSlug}
                  leaderId={leaderId}
                  trends={trends.map(t => ({ ...t, status: (t as any).status }))}
                  posts={posts}
                  analyticsSummary={analyticsSummary}
                  onGeneratePost={handleOpenGenerateSheet}
                  onOpenTrend={handleGenerateFromTrend}
                />
              )}
            </TabsContent>

            {/* Ideas Tab - Merged Research + Topic Ideas */}
            <TabsContent value="ideas">
              {leaderId && leaderSlug && (
                <UnifiedIdeasTab
                  leaderId={leaderId}
                  leaderSlug={leaderSlug}
                  leaderName={leader.name}
                  trends={trends}
                  trendsLoading={trendsLoading}
                  onGenerateTrends={handleGenerateTrends}
                  isGeneratingTrends={generateTrendsMutation?.isPending ?? false}
                />
              )}
            </TabsContent>

            {/* Drafts Tab */}
            <TabsContent value="drafts" className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">LinkedIn Drafts</h2>
                <p className="text-sm text-muted-foreground">Iterate, polish, and handoff final copy for publishing.</p>
              </div>
              {postsLoading ? (
                <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading drafts…
                </div>
              ) : (
                <PostsList posts={posts} onEdit={handleEditPost} onRegenerate={handleRegenerate} onDelete={handleDeletePost} />
              )}
            </TabsContent>

            {/* Settings Tab - Consolidated */}
            <TabsContent value="settings" className="space-y-6">
              {/* Content Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Strategy</CardTitle>
                  <CardDescription>Configure content focus and weekly rhythm</CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderId && leader && (
                    <ContentStrategySection 
                      leaderId={leaderId}
                      leaderData={{
                        niche_keyword: (leader as any).nicheKeyword,
                        niche_domain: (leader as any).nicheDomain,
                        content_phase: (leader as any).contentPhase,
                        content_phase_start_date: (leader as any).contentPhaseStartDate,
                        weekly_rhythm: (leader as any).weeklyRhythm,
                        posts_this_week: (leader as any).postsThisWeek,
                        posts_week_start: (leader as any).postsWeekStart,
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Knowledge Documents */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Knowledge Documents</CardTitle>
                    <CardDescription>Ground each post in the sources that shape this leader's POV.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {uploads && uploads.length > 0 && (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => bulkIndexMutation.mutate()}
                        disabled={bulkIndexMutation.isPending || uploads.every(u => u.openaiFileId)}
                      >
                        {bulkIndexMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : uploads.every(u => u.openaiFileId) ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <FileUp className="mr-2 h-4 w-4" />
                        )}
                        {uploads.every(u => u.openaiFileId) ? "All Indexed" : `Index ${uploads.filter(u => !u.openaiFileId).length}`}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                      Add Document
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {uploadsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <UploadList uploads={uploads} onDelete={handleUploadDelete} onReview={handleReviewFile} />
                  )}
                </CardContent>
              </Card>

              {/* Target Audience */}
              <Card>
                <CardHeader>
                  <CardTitle>Target Audience</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderAudience(leader.targetAudience)}
                </CardContent>
              </Card>

              {/* Agent Prompt */}
              {leader.agentTemplateId && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          AI Agent Prompt
                        </CardTitle>
                        <CardDescription>
                          {agentTemplate?.template_name || "Custom prompt configuration"}
                        </CardDescription>
                      </div>
                      {!isEditingPrompt && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingPrompt(true)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {templateLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : agentTemplate ? (
                      isEditingPrompt ? (
                        <div className="space-y-4">
                          <Textarea
                            value={editedPrompt}
                            onChange={(e) => setEditedPrompt(e.target.value)}
                            className="min-h-[300px] font-mono text-sm"
                          />
                          <div className="flex gap-2">
                            <Button onClick={handleSavePrompt} disabled={updateTemplateMutation.isPending}>
                              {updateTemplateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {agentTemplate.system_prompt}
                          </pre>
                        </ScrollArea>
                      )
                    ) : (
                      <p className="text-muted-foreground">No agent prompt configured.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Analytics */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Analytics
                    </CardTitle>
                    <CardDescription>Historical data to improve future content</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAnalyticsUploadOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> Upload CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading analytics…
                    </div>
                  ) : analyticsSummary ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-2xl font-bold">{analyticsSummary.totalPosts}</div>
                        <p className="text-xs text-muted-foreground">Total Posts</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-2xl font-bold">{analyticsSummary.avgEngagement}</div>
                        <p className="text-xs text-muted-foreground">Avg Engagement</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-2xl font-bold">{analyticsSummary.avgImpressions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Avg Impressions</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-2xl font-bold capitalize">{analyticsSummary.topPostType || "—"}</div>
                        <p className="text-xs text-muted-foreground">Top Format</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No analytics data yet. Upload a CSV to get started.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Dialogs */}
      {leader && (
        <LeaderFormDialog
          open={isLeaderDialogOpen}
          onOpenChange={setLeaderDialogOpen}
          onSubmit={handleLeaderSubmit}
          isSaving={updateLeaderMutation.isPending}
          leader={leader}
        />
      )}

      {leaderId && (
        <UploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onSubmit={handleUploadSubmit}
          onFileUpload={handleFileUpload}
          isSaving={createUploadMutation?.isPending}
        />
      )}

      {selectedPost && leaderId && (
        <EditPostDialog
          open={!!selectedPost}
          onOpenChange={(open) => {
            if (!open) setSelectedPost(null);
          }}
          post={selectedPost}
          onSubmit={handleSavePost}
          isSaving={updatePostMutation?.isPending}
        />
      )}

      {leaderId && (
        <AnalyticsUploadDialog
          open={isAnalyticsUploadOpen}
          onOpenChange={setAnalyticsUploadOpen}
          leaderId={leaderId}
          onSuccess={() => refetchAnalytics()}
        />
      )}

      <FileReviewDialog
        upload={reviewUpload}
        open={isFileReviewOpen}
        onOpenChange={setFileReviewOpen}
      />

      {/* Generate Post Sheet - Inline generation */}
      {leaderId && leaderSlug && (
        <GeneratePostSheet
          open={isGenerateSheetOpen}
          onOpenChange={setGenerateSheetOpen}
          leaderId={leaderId}
          leaderName={leader?.name || ""}
          leaderSlug={leaderSlug}
          trends={trends}
          defaultTrend={selectedTrendForGeneration}
          customIdea={customIdeaForGeneration}
        />
      )}
    </div>
  );
};

export default LinkedInLeaderDetailPage;
