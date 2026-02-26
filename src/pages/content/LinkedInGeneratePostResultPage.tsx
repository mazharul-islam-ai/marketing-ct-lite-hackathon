import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Eye, RefreshCw, Edit, Copy, CheckCircle, Save, Loader2, Info, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { updateGeneratedPost } from "@/features/linkedin-content/api";
import { EditPostDialog } from "@/features/linkedin-content/components/EditPostDialog";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GeneratePostResponse } from "@/hooks/useGenerateLinkedInPost";
import type { UpdatePostInput, GeneratedPost } from "@/features/linkedin-content/types";

const LinkedInGeneratePostResultPage = () => {
  const { leaderSlug } = useParams<{ leaderSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const result = (location.state as { result?: GeneratePostResponse; form?: any })?.result;
  const form = (location.state as { result?: GeneratePostResponse; form?: any })?.form;
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [currentPost, setCurrentPost] = useState<GeneratedPost | null>(null);
  const [reconstructedPrompt, setReconstructedPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Get actual leader ID from slug
  const { data: leader } = useQuery({
    queryKey: ['linkedin-leader', leaderSlug],
    queryFn: async () => {
      if (!leaderSlug) return null;
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaderSlug);
      
      if (isUUID) {
        const { data, error } = await supabase
          .from('thought_leaders')
          .select('*')
          .eq('id', leaderSlug)
          .single();
        if (error) throw error;
        return data;
      }
      
      const { data, error } = await supabase
        .from('thought_leaders')
        .select('*')
        .eq('url_slug', leaderSlug)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!leaderSlug,
  });

  const leaderId = leader?.id;

  // Redirect from UUID to slug URL
  useEffect(() => {
    if (leader && leaderSlug && leader.url_slug && leaderSlug !== leader.url_slug) {
      const currentPath = location.pathname;
      const newPath = currentPath.replace(leaderSlug, leader.url_slug);
      navigate(newPath, { replace: true });
    }
  }, [leader, leaderSlug, navigate, location.pathname]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!result || !leaderId) throw new Error("Missing data");
      
      const { data, error } = await supabase
        .from('generated_posts')
        .insert({
          leader_id: leaderId,
          source_type: form?.sourceType || "custom",
          source_reference: form?.sourceId ?? null,
          post_title: result.post.post_title,
          post_body: result.post.post_body,
          extra_payload: {
            carousel_outline: result.post.carousel_outline || [],
            caption_ideas: result.post.caption_ideas || [],
            generated_via: 'manual_save'
          }
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const savedPost: GeneratedPost = {
        id: data.id,
        leaderId: data.leader_id,
        sourceType: data.source_type,
        sourceReference: data.source_reference ?? null,
        postTitle: data.post_title,
        postBody: data.post_body,
        extraPayload: (data.extra_payload as Record<string, unknown>) ?? {},
        generatedAt: data.generated_at,
        updatedAt: data.updated_at,
      };
      setCurrentPost(savedPost);
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["generated-posts", leaderId] });
      toast({
        title: "Draft saved",
        description: "Your LinkedIn post draft has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdatePostInput) => {
      if (!leaderId || !currentPost?.id) throw new Error("Missing required IDs");
      return updateGeneratedPost(leaderId, currentPost.id, payload);
    },
    onSuccess: (updatedPost) => {
      setCurrentPost(updatedPost);
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["generated-posts", leaderId] });
      toast({
        title: "Post updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No generation result found</p>
          <Button onClick={() => navigate(`/content/linkedin/${leaderSlug}`)}>
            Back to Leader
          </Button>
        </div>
      </div>
    );
  }

  const handleSaveDraft = () => {
    saveDraftMutation.mutate();
  };

  const handleBack = () => {
    navigate(`/content/linkedin/${leaderSlug}`, { replace: true });
  };

  const handleRegenerate = () => {
    navigate(`/content/linkedin/${leaderSlug}/generate`, { 
      state: { regenerate: true },
      replace: true 
    });
  };

  const handleCopyPost = async () => {
    const textToCopy = currentPost?.postBody || result.post.post_body;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied to clipboard",
        description: "Post content copied successfully.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (payload: UpdatePostInput) => {
    await updateMutation.mutateAsync(payload);
  };

  const handleGeneratePrompt = async () => {
    if (!leaderId) return;
    
    setIsLoadingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconstruct-linkedin-prompt', {
        body: {
          leaderId,
          sourceType: form?.sourceType || 'custom',
          sourceId: form?.sourceId,
          briefText: form?.briefText,
          influencerStyle: form?.influencerStyle,
        }
      });

      if (error) throw error;
      
      setReconstructedPrompt(data.prompt);
      toast({
        title: "Prompt generated",
        description: `Reconstructed ${data.characterCount} characters across ${data.sections} sections`,
      });
    } catch (error) {
      toast({
        title: "Failed to generate prompt",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leader
          </Button>
          {!isSaved ? (
            <Badge variant="destructive">Unsaved</Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isSaved && (
            <Button onClick={handleSaveDraft} disabled={saveDraftMutation.isPending}>
              {saveDraftMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Draft
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleCopyPost}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setEditDialogOpen(true)}
            disabled={!isSaved}
          >
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" onClick={handleRegenerate}>
            <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="post" className="w-full">
        <TabsList>
          <TabsTrigger value="post">
            <FileText className="mr-2 h-4 w-4" />
            Generated Post
          </TabsTrigger>
          <TabsTrigger value="transparency">
            <Eye className="mr-2 h-4 w-4" />
            How It Was Created
          </TabsTrigger>
        </TabsList>

        {/* Generated Post Tab */}
        <TabsContent value="post" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{currentPost?.postTitle || result.post.post_title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{currentPost?.postBody || result.post.post_body}</ReactMarkdown>
              </div>

              {result.post.carousel_outline && result.post.carousel_outline.length > 0 && (
                <div className="border-t pt-6">
                  <h4 className="mb-3 font-semibold">📊 Carousel Outline</h4>
                  <div className="space-y-3">
                    {result.post.carousel_outline.map((slide: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {slide.slide_number || idx + 1}
                            </span>
                            <span className="font-semibold">
                              {typeof slide.headline === 'string' 
                                ? slide.headline 
                                : slide.title || `Slide ${idx + 1}`}
                            </span>
                          </div>
                          {slide.key_points && Array.isArray(slide.key_points) ? (
                            <ul className="ml-8 list-disc space-y-1 text-sm text-muted-foreground">
                              {slide.key_points.map((point: string, i: number) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          ) : slide.content ? (
                            <div className="ml-8 text-sm text-muted-foreground">{slide.content}</div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {result.post.caption_ideas && result.post.caption_ideas.length > 0 && (
                <div className="border-t pt-6">
                  <h4 className="mb-3 font-semibold">💡 Caption Ideas</h4>
                  <div className="space-y-2">
                    {result.post.caption_ideas.map((caption: string, idx: number) => (
                      <div key={idx} className="rounded-lg border bg-muted/30 p-3 text-sm">
                        {caption}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transparency Tab */}
        <TabsContent value="transparency" className="space-y-6">
          {(result.meta as any).context_breakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  What We Submitted to AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <strong className="text-sm">Leader:</strong>
                  <p className="text-sm text-muted-foreground">{(result.meta as any).context_breakdown?.leader_context?.name || 'N/A'}</p>
                </div>
                
                <div>
                  <strong className="text-sm">Source:</strong>
                  <p className="text-sm text-muted-foreground">{form?.sourceType === "trend" && "📈 Weekly Trend"}</p>
                  <p className="text-sm text-muted-foreground">{form?.sourceType === "influencer" && "📄 Influencer Upload"}</p>
                  <p className="text-sm text-muted-foreground">{form?.sourceType === "custom" && "✍️ Custom Brief"}</p>
                </div>
                
                {(result.meta as any).context_breakdown?.knowledge_docs?.length > 0 && (
                  <div>
                    <strong className="text-sm">Knowledge Documents Included:</strong>
                    <ul className="mt-2 space-y-1 pl-4">
                      {(result.meta as any).context_breakdown.knowledge_docs.map((doc: any, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          • {doc.fileName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {(result.meta as any).context_breakdown?.analytics_data && (
                  <div>
                    <strong className="text-sm">Analytics Data:</strong>
                    <p className="text-sm text-muted-foreground">
                      Weekly trend analysis included (posts, engagement patterns)
                    </p>
                  </div>
                )}
                
                <div>
                  <strong className="text-sm">Company Knowledge:</strong>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const companyKnowledge = (result.meta as any).context_breakdown?.company_knowledge;
                      if (!companyKnowledge || companyKnowledge === '0 sections included') {
                        return '0 sections included';
                      }
                      // If it's already formatted with token info, show as is
                      if (typeof companyKnowledge === 'string' && companyKnowledge.includes('entries')) {
                        return companyKnowledge;
                      }
                      // Otherwise count sections
                      const sectionCount = companyKnowledge.split('###').length - 1;
                      return `${sectionCount} sections included`;
                    })()}
                  </p>
                </div>
                
                <div>
                  <strong className="text-sm">Performance Insights:</strong>
                  <p className="text-sm text-muted-foreground">
                    {(result.meta as any).context_breakdown?.performance_insights || 'No historical data'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Token & Performance Metrics - Enhanced Display */}
          <Card className="border-primary/20 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                ⚡ API Usage & Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Total Tokens</div>
                  <div className="text-2xl font-bold text-blue-600">{result.meta.tokens_used.toLocaleString()}</div>
                  {(result.meta as any).prompt_tokens && (result.meta as any).completion_tokens && (
                    <div className="text-xs text-muted-foreground">
                      In: {(result.meta as any).prompt_tokens.toLocaleString()} | Out: {(result.meta as any).completion_tokens.toLocaleString()}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Model</div>
                  <div className="text-lg font-semibold">{result.meta.model_used}</div>
                  <div className="text-xs text-muted-foreground">OpenAI API</div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Generation Time</div>
                  <div className="text-2xl font-bold text-green-600">{(result.meta.generation_time_ms / 1000).toFixed(2)}s</div>
                  <div className="text-xs text-muted-foreground">
                    {result.meta.generation_time_ms}ms
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Estimated Cost</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    ${((result.meta as any).estimated_cost ?? 0.015).toFixed(4)} USD
                  </div>
                  <div className="text-xs text-muted-foreground">Per generation</div>
                </div>
              </div>
              
              {/* Context Breakdown */}
              {(result.meta as any).context_breakdown && (
                <div className="border-t pt-4">
                  <h4 className="mb-3 text-sm font-semibold">📊 Context Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    {(result.meta as any).context_breakdown.company_knowledge && (
                      <div className="flex justify-between rounded-lg bg-white p-2">
                        <span className="text-muted-foreground">Company knowledge</span>
                        <span className="font-medium">{(result.meta as any).context_breakdown.company_knowledge}</span>
                      </div>
                    )}
                    {(result.meta as any).context_breakdown.leader_documents && (
                      <div className="flex justify-between rounded-lg bg-white p-2">
                        <span className="text-muted-foreground">Leader documents</span>
                        <span className="font-medium">{(result.meta as any).context_breakdown.leader_documents}</span>
                      </div>
                    )}
                    {(result.meta as any).context_breakdown.performance_insights && (
                      <div className="flex justify-between rounded-lg bg-white p-2">
                        <span className="text-muted-foreground">Performance insights</span>
                        <span className="font-medium">{(result.meta as any).context_breakdown.performance_insights}</span>
                      </div>
                    )}
                    {(result.meta as any).context_breakdown.system_prompt && (
                      <div className="flex justify-between rounded-lg bg-white p-2">
                        <span className="text-muted-foreground">System prompt</span>
                        <span className="font-medium">{(result.meta as any).context_breakdown.system_prompt}</span>
                      </div>
                    )}
                    {(result.meta as any).context_breakdown.user_brief && (
                      <div className="flex justify-between rounded-lg bg-white p-2">
                        <span className="text-muted-foreground">User brief</span>
                        <span className="font-medium">{(result.meta as any).context_breakdown.user_brief}</span>
                      </div>
                    )}
                    
                    {(result.meta as any).context_breakdown.total_estimated_input_tokens && (
                      <div className="flex justify-between rounded-lg bg-primary/10 p-2 font-semibold">
                        <span>Total estimated input</span>
                        <span className="text-blue-600">
                          {(result.meta as any).context_breakdown.total_estimated_input_tokens.toLocaleString()} tokens
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="full-prompt">
              <AccordionTrigger>View Full Prompt Sent to AI</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {!reconstructedPrompt && !isLoadingPrompt && (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Click below to reconstruct the full prompt that was sent to the AI
                      </p>
                      <Button onClick={handleGeneratePrompt} variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate Full Prompt
                      </Button>
                    </div>
                  )}
                  {isLoadingPrompt && (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Reconstructing prompt...</p>
                    </div>
                  )}
                  {reconstructedPrompt && (
                    <ScrollArea className="h-[400px] w-full rounded border bg-muted p-4">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{reconstructedPrompt}</pre>
                    </ScrollArea>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {(result.meta as any).context_breakdown?.system_prompt && (
              <AccordionItem value="system-prompt">
                <AccordionTrigger>View System Prompt (Agent Master Prompt)</AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="h-[400px] w-full rounded border bg-muted p-4">
                    <pre className="text-xs whitespace-pre-wrap">{(result.meta as any).context_breakdown.system_prompt}</pre>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            )}
            
            <AccordionItem value="source-context">
              <AccordionTrigger>View Source Material</AccordionTrigger>
              <AccordionContent>
                <div className="rounded border bg-muted p-4">
                  <pre className="text-xs whitespace-pre-wrap">{(result.meta as any).source_context || 'Source context not available in new agent format'}</pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="grid gap-6 md:grid-cols-2">
            {/* AI Reasoning */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🤖 AI Decision Process</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">{(result.meta as any).reasoning || 'Generated using unified AI Agent framework'}</div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">⚙️ Generation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Model:</dt>
                    <dd className="font-medium">{result.meta.model_used}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tokens:</dt>
                    <dd className="font-medium">{result.meta.tokens_used.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Time:</dt>
                    <dd className="font-medium">{result.meta.generation_time_ms}ms</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditPostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        post={currentPost}
        onSubmit={handleEditSubmit}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
};

export default LinkedInGeneratePostResultPage;
