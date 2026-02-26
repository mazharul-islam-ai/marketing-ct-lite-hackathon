import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import LinkedInGeneratePostPage from "@/pages/content/LinkedInGeneratePostPage";

const LinkedInContentGeneratorPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leaderSlug } = useParams<{ leaderSlug?: string }>();
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");

  // Load all brands for selection (admin context)
  const { data: brands, isLoading: brandsLoading } = useQuery({
    queryKey: ['all-brands-linkedin', user?.role],
    enabled: !!user,
    queryFn: async () => {
      // For admins, load all brands
      if (user?.role === 'super_admin' || user?.role === 'manager') {
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, slug')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data;
      }
      return [];
    },
  });

  // Load all leaders across all brands for admin (or filtered by brand if selected)
  const { data: allLeaders, isLoading: allLeadersLoading } = useQuery({
    queryKey: ['all-leaders-linkedin', selectedBrandId, user?.role],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('thought_leaders')
        .select('id, name, url_slug, title, brand_id');
      
      if (selectedBrandId) {
        query = query.eq('brand_id', selectedBrandId);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Load leaders for selected brand (for filtering)
  const { data: leaders, isLoading: leadersLoading } = useQuery({
    queryKey: ['leaders-for-brand-linkedin', selectedBrandId],
    enabled: !!selectedBrandId,
    queryFn: async () => {
      if (!selectedBrandId) return [];
      const { data, error } = await supabase
        .from('thought_leaders')
        .select('id, name, url_slug, title, brand_id')
        .eq('brand_id', selectedBrandId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Use filtered leaders if brand selected, otherwise all leaders
  const availableLeaders = selectedBrandId ? leaders : allLeaders;
  const isLoadingLeaders = selectedBrandId ? leadersLoading : allLeadersLoading;

  // Get selected leader
  const selectedLeader = availableLeaders?.find(l => l.id === selectedLeaderId);

  // When leader is selected, navigate to include leader slug in URL
  useEffect(() => {
    if (selectedLeader?.url_slug && selectedLeaderId) {
      navigate(`/adminpanel/ai-control/run/linkedin-content-gen/${selectedLeader.url_slug}`, { replace: true });
    }
  }, [selectedLeaderId, selectedLeader, navigate]);

  // If a leader slug is in URL params, render the LinkedIn Generate Post Page
  // LinkedInGeneratePostPage uses useParams to get leaderSlug, so it should work
  if (leaderSlug) {
    // LinkedInGeneratePostPage expects the route to be /content/linkedin/:leaderSlug/generate
    // But we're in /adminpanel/ai-control/run/linkedin-content-gen/:leaderSlug
    // So we need to render it with the leaderSlug context
    // Since LinkedInGeneratePostPage uses useParams, we can just render it
    // The component will get leaderSlug from the URL params
    return <LinkedInGeneratePostPage />;
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl">LinkedIn Content Generator</CardTitle>
              <CardDescription>
                Generate LinkedIn posts for thought leaders using AI-powered content creation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Brand Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Brand</CardTitle>
          <CardDescription>Choose the brand to generate LinkedIn content for</CardDescription>
        </CardHeader>
        <CardContent>
          {brandsLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading brands...</span>
            </div>
          ) : (
            <Select value={selectedBrandId} onValueChange={(value) => {
              setSelectedBrandId(value);
              setSelectedLeaderId(""); // Reset leader when brand changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a brand..." />
              </SelectTrigger>
              <SelectContent>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Leader Selection - show after brand is selected or always show (all leaders) */}
      <Card>
        <CardHeader>
          <CardTitle>Select Thought Leader</CardTitle>
          <CardDescription>
            {selectedBrandId 
              ? "Choose which thought leader to generate content for"
              : "Choose which thought leader to generate content for (or select a brand above to filter)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLeaders ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading leaders...</span>
            </div>
          ) : availableLeaders && availableLeaders.length > 0 ? (
            <Select value={selectedLeaderId} onValueChange={setSelectedLeaderId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a thought leader..." />
              </SelectTrigger>
              <SelectContent>
                {availableLeaders.map((leader) => {
                  const brandName = brands?.find(b => b.id === leader.brand_id)?.name || '';
                  return (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.name} {leader.title ? `- ${leader.title}` : ''} {brandName ? `(${brandName})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {selectedBrandId 
                ? "No thought leaders found for this brand. Please add a thought leader first."
                : "No thought leaders found. Please add thought leaders to brands first."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show selected brand and leader */}
      {selectedLeader && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Generating for: <strong className="text-foreground">
                {selectedLeader.name}
                {selectedLeader.brand_id && ` (${brands?.find(b => b.id === selectedLeader.brand_id)?.name})`}
              </strong>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LinkedInContentGeneratorPage;

