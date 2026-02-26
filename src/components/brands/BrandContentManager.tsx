import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Users, Wand2, Loader2 } from "lucide-react";
import { BrandKnowledgeFiles } from "./BrandKnowledgeFiles";
import { BrandPostGenerator } from "./BrandPostGenerator";
import { BrandLeadersList } from "./BrandLeadersList";
import { useBrandKnowledge } from "@/hooks/useBrandKnowledge";

interface BrandContentManagerProps {
  brandId: string;
  brandSlug: string;
}

export const BrandContentManager = ({ brandId, brandSlug }: BrandContentManagerProps) => {
  const { indexFiles, indexedFilesCount, totalFilesCount } = useBrandKnowledge(brandId);
  const [isIndexing, setIsIndexing] = useState(false);

  const { data: brand } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: brandLeaders } = useQuery({
    queryKey: ['brand-leaders', brandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('thought_leaders')
        .select('*')
        .eq('brand_id', brandId);

      if (error) throw error;
      return data;
    },
  });

  const handleBulkIndex = async () => {
    setIsIndexing(true);
    try {
      await indexFiles.mutateAsync({ brandSlug });
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand Content Management</CardTitle>
          <CardDescription>
            Manage knowledge base, team members, and generate LinkedIn posts for {brand?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex-1">
              <div className="text-sm font-medium">Knowledge Base Status</div>
              <div className="text-2xl font-bold">
                {indexedFilesCount} / {totalFilesCount}
              </div>
              <div className="text-xs text-muted-foreground">files indexed</div>
            </div>
            <Button
              onClick={handleBulkIndex}
              disabled={isIndexing || totalFilesCount === 0}
              variant="outline"
            >
              {isIndexing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Index All Files
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="knowledge">
            <Upload className="h-4 w-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />
            Team Leaders
          </TabsTrigger>
          <TabsTrigger value="generate">
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Post
          </TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-4">
          <BrandKnowledgeFiles brandId={brandId} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <BrandLeadersList 
            brandId={brandId} 
            brandSlug={brandSlug}
            leaders={(brandLeaders || []) as any} 
          />
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <BrandPostGenerator
            brandId={brandId}
            brandSlug={brandSlug}
            brandName={brand?.name || ''}
            leaders={(brandLeaders || []) as any}
            indexedFilesCount={indexedFilesCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
