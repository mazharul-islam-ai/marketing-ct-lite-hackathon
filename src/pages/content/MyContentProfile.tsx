import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, PenTool, BarChart3, Upload, Sparkles, Lightbulb, BookOpen, Copy, Check, Wand2, ExternalLink, Target, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { WeeklyRhythmTracker } from "@/features/linkedin-content/components/WeeklyRhythmTracker";
import { QuickIdeaCapture } from "@/features/linkedin-content/components/QuickIdeaCapture";

interface ThoughtLeader {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  persona_tone: string | null;
  linkedin_url: string | null;
  url_slug: string | null;
  brand_id: string | null;
  niche_keyword: string | null;
  niche_domain: string | null;
  content_phase: string | null;
  weekly_rhythm: { teaching: number; opinion: number; how_to: number } | null;
  posts_this_week: { teaching: number; opinion: number; how_to: number } | null;
  posts_week_start: string | null;
  brands?: {
    name: string;
    slug: string;
  } | null;
}

interface GeneratedPost {
  id: string;
  post_title: string;
  post_body: string;
  source_type: string;
  generated_at: string;
}

interface ReadyIdea {
  id: string;
  topic_title: string;
  topic_summary: string;
  week_start: string;
  created_at: string;
  status: string;
}

interface KnowledgeDoc {
  id: string;
  file_name: string;
  file_summary: string | null;
  source_type: string | null;
  created_at: string;
}

export default function MyContentProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leader, setLeader] = useState<ThoughtLeader | null>(null);
  const [recentPosts, setRecentPosts] = useState<GeneratedPost[]>([]);
  const [readyIdeas, setReadyIdeas] = useState<ReadyIdea[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderProfile() {
      if (!user?.id) return;

      try {
        // Fetch the thought leader profile linked to this user
        const { data, error } = await supabase
          .from("thought_leaders")
          .select(`
            id,
            name,
            title,
            department,
            persona_tone,
            linkedin_url,
            url_slug,
            brand_id,
            niche_keyword,
            niche_domain,
            content_phase,
            weekly_rhythm,
            posts_this_week,
            posts_week_start,
            brands (
              name,
              slug
            )
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching leader profile:", error);
          toast({
            title: "Error",
            description: "Failed to load your content profile",
            variant: "destructive",
          });
          return;
        }

        if (!data) {
          toast({
            title: "No Profile Found",
            description: "You don't have a thought leader profile linked to your account. Please contact an administrator.",
            variant: "destructive",
          });
          return;
        }

        setLeader({
          ...data,
          weekly_rhythm: (data.weekly_rhythm as { teaching: number; opinion: number; how_to: number } | null),
          posts_this_week: (data.posts_this_week as { teaching: number; opinion: number; how_to: number } | null),
        });

        // Fetch recent posts for this leader
        setPostsLoading(true);
        const { data: posts, error: postsError } = await supabase
          .from("generated_posts")
          .select("id, post_title, post_body, source_type, generated_at")
          .eq("leader_id", data.id)
          .order("generated_at", { ascending: false })
          .limit(5);

        if (postsError) {
          console.error("Error fetching posts:", postsError);
        } else {
          setRecentPosts(posts || []);
        }
        setPostsLoading(false);

        // Fetch ready ideas (weekly_trends with status = 'ready')
        setIdeasLoading(true);
        const { data: ideas, error: ideasError } = await supabase
          .from("weekly_trends")
          .select("id, topic_title, topic_summary, week_start, created_at, status")
          .eq("leader_id", data.id)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(5);

        if (ideasError) {
          console.error("Error fetching ideas:", ideasError);
        } else {
          setReadyIdeas(ideas || []);
        }
        setIdeasLoading(false);

        // Fetch knowledge docs (leader_uploads)
        setDocsLoading(true);
        const { data: docs, error: docsError } = await supabase
          .from("leader_uploads")
          .select("id, file_name, file_summary, source_type, created_at")
          .eq("leader_id", data.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (docsError) {
          console.error("Error fetching docs:", docsError);
        } else {
          setKnowledgeDocs(docs || []);
        }
        setDocsLoading(false);

      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderProfile();
  }, [user?.id, toast]);

  const handleCopyPost = async (post: GeneratedPost) => {
    await navigator.clipboard.writeText(post.post_body);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Post copied to clipboard" });
  };

  const handleMarkIdeaUsed = async (ideaId: string) => {
    const { error } = await supabase
      .from("weekly_trends")
      .update({ status: "used" })
      .eq("id", ideaId);

    if (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    } else {
      setReadyIdeas(prev => prev.filter(i => i.id !== ideaId));
      toast({ title: "Marked as used" });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!leader) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No thought leader profile found for your account.
              Please contact an administrator to set up your profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = leader.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{leader.name}</h1>
              {leader.title && (
                <p className="text-muted-foreground">{leader.title}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {leader.department && (
                  <Badge variant="secondary">{leader.department}</Badge>
                )}
                {leader.brands?.name && (
                  <Badge variant="outline">{leader.brands.name}</Badge>
                )}
                {leader.niche_keyword && (
                  <Badge variant="outline" className="bg-primary/5 border-primary/20">
                    <Target className="h-3 w-3 mr-1" />
                    {leader.niche_keyword}
                  </Badge>
                )}
                {leader.niche_domain && (
                  <Badge variant="outline" className="bg-amber-500/5 border-amber-200">
                    <Zap className="h-3 w-3 mr-1" />
                    {leader.niche_domain.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate(`/content/linkedin/${leader.url_slug}`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                View Dashboard
              </Button>
              <Button
                onClick={() => navigate(`/content/linkedin/${leader.url_slug}/generate`)}
                className="bg-gradient-primary"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate New Post
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Rhythm Tracker + Quick Idea */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <WeeklyRhythmTracker
            leaderId={leader.id}
            weeklyRhythm={leader.weekly_rhythm || { teaching: 2, opinion: 1, how_to: 1 }}
            postsThisWeek={leader.posts_this_week || { teaching: 0, opinion: 0, how_to: 0 }}
            weekStart={leader.posts_week_start}
          />
        </div>
        <div>
          <QuickIdeaCapture leaderId={leader.id} variant="inline" />
        </div>
      </div>

      {/* Ready Ideas Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Ready Ideas
            {readyIdeas.length > 0 && (
              <Badge variant="default" className="ml-2">{readyIdeas.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Content topics curated by the marketing team, ready for you to create posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ideasLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : readyIdeas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No ready ideas at the moment.</p>
              <p className="text-sm mt-1">The marketing team will add new topics here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {readyIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{idea.topic_title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {idea.topic_summary}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Added {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/content/linkedin/${leader.url_slug}/generate`, {
                          state: {
                            defaultSource: {
                              sourceType: "trend",
                              sourceId: idea.id,
                              customContent: idea.topic_summary,
                              headlineIdea: idea.topic_title,
                            },
                          },
                        })}
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkIdeaUsed(idea.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Posts
            </CardTitle>
            <CardDescription>
              Your latest AI-generated content - copy and post to LinkedIn
            </CardDescription>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No posts generated yet.</p>
                <Button
                  variant="link"
                  onClick={() => navigate(`/content/linkedin/${leader.url_slug}/generate`)}
                >
                  Create your first post
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{post.post_title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {post.post_body.substring(0, 100)}...
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(post.generated_at), { addSuffix: true })} •{" "}
                            <Badge variant="outline" className="text-xs">
                              {post.source_type}
                            </Badge>
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyPost(post)}
                        >
                          {copiedId === post.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {recentPosts.length > 0 && (
              <div className="text-center pt-4 border-t mt-4">
                <Button
                  variant="link"
                  onClick={() => navigate(`/content/linkedin/${leader.url_slug}`)}
                >
                  View all posts →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Docs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              My Knowledge Base
            </CardTitle>
            <CardDescription>
              Research materials and reference documents for content creation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : knowledgeDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No knowledge documents yet.</p>
                <p className="text-sm mt-1">The marketing team adds research here.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {knowledgeDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.file_name}</p>
                          {doc.file_summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {doc.file_summary}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {doc.source_type || 'manual'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {knowledgeDocs.length > 0 && (
              <div className="text-center pt-4 border-t mt-4">
                <Button
                  variant="link"
                  onClick={() => navigate(`/content/linkedin/${leader.url_slug}`)}
                >
                  View all documents →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/content/linkedin/${leader.url_slug}/generate`)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Create Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Generate LinkedIn posts from ideas, documents, or custom topics
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/content/linkedin/${leader.url_slug}`)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Manage Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Upload reference materials, past posts, and knowledge files
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/content/linkedin/${leader.url_slug}`)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              View Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Track post performance and engagement metrics
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Floating Action Button for Mobile Quick Idea */}
      <QuickIdeaCapture leaderId={leader.id} variant="fab" />
    </div>
  );
}
