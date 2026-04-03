import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, TrendingUp, Target, BookOpen, Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAdminBrands } from '@/hooks/useAdminBrands';
import {
  useKeywordSuggestions,
  useKeywords,
  useSaveKeyword,
  useDeleteKeyword,
  type KeywordSuggestion,
  type SavedKeyword,
} from '@/hooks/useKeywordResearch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KeywordResearchProps {
  brandId?: string;
  brandName?: string;
}

export default function KeywordResearch({ brandId, brandName }: KeywordResearchProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedBrandId, setSelectedBrandId] = useState(brandId || '');
  const [seedKeyword, setSeedKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false);

  const { brands } = useAdminBrands();
  const { data: keywords, isLoading: loadingKeywords } = useKeywords(
    selectedBrandId,
    filterStatus,
    filterPriority
  );

  const suggestMutation = useKeywordSuggestions();
  const saveMutation = useSaveKeyword();
  const deleteMutation = useDeleteKeyword();

  const handleSuggest = async () => {
    try {
      const results = await suggestMutation.mutateAsync({
        brandId: selectedBrandId,
        seedKeyword,
      });
      setSuggestions(results);
      setShowSuggestionsDialog(true);
      toast({
        title: 'Suggestions ready!',
        description: `Found ${results.length} keyword suggestions`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get suggestions',
        variant: 'destructive',
      });
    }
  };

  const handleSaveKeyword = async (suggestion: KeywordSuggestion) => {
    try {
      await saveMutation.mutateAsync({
        brand_id: selectedBrandId,
        keyword: suggestion.keyword,
        search_volume: suggestion.search_volume,
        competition: suggestion.competition,
        priority: 'medium',
      });
      toast({
        title: 'Keyword saved!',
        description: `"${suggestion.keyword}" is now being tracked`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save keyword',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKeyword = async (keywordId: string) => {
    if (!confirm('Are you sure you want to delete this keyword?')) return;
    
    try {
      await deleteMutation.mutateAsync({ keywordId, brandId: selectedBrandId });
      toast({
        title: 'Keyword deleted',
        description: 'Keyword removed from tracking',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete keyword',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl">
                Keyword Research{brandName ? `: ${brandName}` : ''}
              </CardTitle>
              <CardDescription>
                Find, track, and optimize keywords for your SEO strategy
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>




      {/* Brand Selection & Keyword Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>Get Keyword Suggestions</CardTitle>
          <CardDescription>Use AI to discover related keywords</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 ${brandId ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
            {/* Only show brand selector when not in brand context */}
            {!brandId && (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand..." />
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

            <Input
              placeholder="Enter seed keyword..."
              value={seedKeyword}
              onChange={(e) => setSeedKeyword(e.target.value)}
              disabled={!selectedBrandId}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && seedKeyword) {
                  handleSuggest();
                }
              }}
            />

            <Button
              onClick={handleSuggest}
              disabled={!seedKeyword || suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Get Suggestions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyword List */}
      {selectedBrandId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tracked Keywords</CardTitle>
                <CardDescription>
                  {keywords?.length || 0} keywords being monitored
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="targeting">Targeting</SelectItem>
                    <SelectItem value="achieved">Achieved</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingKeywords ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : keywords?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No keywords tracked yet. Get suggestions to start!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keywords?.map((keyword) => (
                  <KeywordCard 
                    key={keyword.id} 
                    keyword={keyword}
                    onDelete={() => handleDeleteKeyword(keyword.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestions Dialog */}
      <Dialog open={showSuggestionsDialog} onOpenChange={setShowSuggestionsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Keyword Suggestions for "{seedKeyword}"</DialogTitle>
            <DialogDescription>
              Select keywords to add to your tracking list
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-semibold">{suggestion.keyword}</h4>
                      {suggestion.competition && (
                        <Badge variant="outline">{suggestion.competition}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {suggestion.search_volume && (
                        <span>Vol: {suggestion.search_volume.toLocaleString()}/mo</span>
                      )}
                      <span>Relevance: {suggestion.relevance_score}/100</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveKeyword(suggestion)}
                    disabled={saveMutation.isPending}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Save
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KeywordCard({ 
  keyword, 
  onDelete 
}: { 
  keyword: SavedKeyword;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-semibold">{keyword.keyword}</h4>
          <Badge variant={
            keyword.priority === 'high' ? 'destructive' : 
            keyword.priority === 'medium' ? 'default' : 
            'secondary'
          }>
            {keyword.priority}
          </Badge>
          <Badge variant="outline">{keyword.status}</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {keyword.search_volume && (
            <span>Vol: {keyword.search_volume.toLocaleString()}</span>
          )}
          {keyword.competition && (
            <span>Comp: {keyword.competition}</span>
          )}
          {keyword.current_rank && (
            <span>Rank: #{keyword.current_rank}</span>
          )}
          {keyword.used_in_blog_count > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {keyword.used_in_blog_count} blogs
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
