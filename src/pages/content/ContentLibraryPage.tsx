import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, ExternalLink, Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type FilterType = "all" | "leaders" | "influencers";

interface LeaderUpload {
  id: string;
  file_name: string;
  file_url: string;
  file_summary: string | null;
  created_at: string;
  leader_id: string;
  leader?: {
    id: string;
    name: string;
    persona_tone: string;
  };
}

interface InfluencerStyle {
  id: string;
  influencer_name: string;
  platform: string;
  style_description: string;
  sample_posts: string[];
  is_active: boolean;
}

interface LeaderData {
  id: string;
  name: string;
  persona_tone: string;
}

export default function ContentLibraryPage() {
  const [filter, setFilter] = useState<FilterType>("all");

  // Fetch all leader uploads with leader info
  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ['all-leader-uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_uploads')
        .select(`
          id,
          file_name,
          file_url,
          file_summary,
          created_at,
          leader_id,
          thought_leaders!inner(id, name, persona_tone)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(upload => ({
        ...upload,
        leader: upload.thought_leaders as unknown as LeaderData
      })) as LeaderUpload[];
    },
    enabled: filter === "all" || filter === "leaders"
  });

  // Fetch influencer styles
  const { data: influencers, isLoading: influencersLoading } = useQuery({
    queryKey: ['influencer-style-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_style_library')
        .select('*')
        .order('influencer_name');
      if (error) throw error;
      return data as InfluencerStyle[];
    },
    enabled: filter === "all" || filter === "influencers"
  });

  // Group uploads by leader
  const uploadsByLeader = uploads?.reduce((acc, upload) => {
    const leaderId = upload.leader_id;
    if (!acc[leaderId]) {
      acc[leaderId] = {
        leader: upload.leader!,
        uploads: []
      };
    }
    acc[leaderId].uploads.push(upload);
    return acc;
  }, {} as Record<string, { leader: LeaderData; uploads: LeaderUpload[] }>);

  const isLoading = uploadsLoading || influencersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showLeaders = filter === "all" || filter === "leaders";
  const showInfluencers = filter === "all" || filter === "influencers";

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Content Library</h1>
          <p className="text-muted-foreground">
            Centralized hub for leader knowledge documents and influencer writing styles
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Content</TabsTrigger>
            <TabsTrigger value="leaders">Leader Knowledge</TabsTrigger>
            <TabsTrigger value="influencers">Influencer Styles</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-8">
        {/* Leader Knowledge Section */}
        {showLeaders && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Leader Knowledge Base</h2>
                <Badge variant="secondary">{Object.keys(uploadsByLeader || {}).length} leaders</Badge>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="../linkedin">Manage Leaders</Link>
              </Button>
            </div>

            {!uploadsByLeader || Object.keys(uploadsByLeader).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No knowledge documents yet. Add documents to your leaders to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {Object.values(uploadsByLeader).map(({ leader, uploads }) => (
                  <Card key={leader.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Link 
                              to={`../linkedin/${leader.id}`}
                              className="hover:underline"
                            >
                              {leader.name}
                            </Link>
                            <Badge variant="outline" className="text-xs font-normal">
                              {uploads.length} {uploads.length === 1 ? 'document' : 'documents'}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{leader.persona_tone}</p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`../linkedin/${leader.id}`}>
                            View Profile →
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {uploads.slice(0, 3).map((upload) => (
                          <div key={upload.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <a 
                                  href={upload.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:underline truncate"
                                >
                                  {upload.file_name}
                                </a>
                                <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              </div>
                              {upload.file_summary && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {upload.file_summary}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                        {uploads.length > 3 && (
                          <Button variant="ghost" size="sm" asChild className="w-full mt-2">
                            <Link to={`../linkedin/${leader.id}`}>
                              View all {uploads.length} documents →
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {showLeaders && showInfluencers && <Separator />}

        {/* Influencer Styles Section */}
        {showInfluencers && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Influencer Style Library</h2>
                <Badge variant="secondary">{influencers?.length || 0} styles</Badge>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/adminpanel/linkedin-agent-config">Manage Styles</Link>
              </Button>
            </div>

            {!influencers || influencers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No influencer styles yet. Add styles from the Admin Panel to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {influencers.map((influencer) => (
                  <Card key={influencer.id} className={!influencer.is_active ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{influencer.influencer_name}</CardTitle>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {influencer.platform}
                          </Badge>
                        </div>
                        {!influencer.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {influencer.style_description || 'No description available'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>{influencer.sample_posts?.length || 0} sample posts</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
