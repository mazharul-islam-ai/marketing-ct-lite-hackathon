import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw } from 'lucide-react';
import GoldExamplesEditor from '@/components/adminpanel/reel-hook-config/GoldExamplesEditor';
import PlatformRulesEditor from '@/components/adminpanel/reel-hook-config/PlatformRulesEditor';
import PsychologyMappingEditor from '@/components/adminpanel/reel-hook-config/PsychologyMappingEditor';
import HardRulesEditor from '@/components/adminpanel/reel-hook-config/HardRulesEditor';

export default function ReelHookConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('gold-examples');

  // Load agent config
  const { data: agent, isLoading } = useQuery({
    queryKey: ['reel-hook-generator-agent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('slug', 'reel-hook-generator')
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Save config mutation
  const saveConfig = useMutation({
    mutationFn: async (config: any) => {
      const { error } = await supabase
        .from('ai_agents')
        .update({
          config,
          updated_at: new Date().toISOString(),
        })
        .eq('slug', 'reel-hook-generator');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reel-hook-generator-agent'] });
      toast({
        title: 'Configuration saved',
        description: 'Reel Hook Generator settings have been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save configuration',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = (updatedConfig: any) => {
    saveConfig.mutate(updatedConfig);
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container max-w-7xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Reel Hook Generator agent not found. Please run the database migration first.
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = agent.config as Record<string, any>;

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reel Hook Generator Configuration</CardTitle>
              <CardDescription>
                Manage gold examples, platform rules, psychology mapping, and hard rules for the AI agent
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['reel-hook-generator-agent'] })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gold-examples">Gold Examples</TabsTrigger>
              <TabsTrigger value="platform-rules">Platform Rules</TabsTrigger>
              <TabsTrigger value="psychology">Psychology Mapping</TabsTrigger>
              <TabsTrigger value="hard-rules">Hard Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="gold-examples" className="space-y-6 mt-6">
              <GoldExamplesEditor
                goldExamples={config.gold_examples || {}}
                onSave={(updated) => handleSave({ ...config, gold_examples: updated })}
                isSaving={saveConfig.isPending}
              />
            </TabsContent>

            <TabsContent value="platform-rules" className="space-y-6 mt-6">
              <PlatformRulesEditor
                platformRules={config.platform_rules || {}}
                onSave={(updated) => handleSave({ ...config, platform_rules: updated })}
                isSaving={saveConfig.isPending}
              />
            </TabsContent>

            <TabsContent value="psychology" className="space-y-6 mt-6">
              <PsychologyMappingEditor
                viewerPsychology={config.viewer_psychology || {}}
                hookStrategyMatrix={config.hook_strategy_matrix || []}
                antiPatterns={config.anti_patterns || []}
                alwaysPair={config.always_pair || []}
                onSave={(updated) => handleSave({ ...config, ...updated })}
                isSaving={saveConfig.isPending}
              />
            </TabsContent>

            <TabsContent value="hard-rules" className="space-y-6 mt-6">
              <HardRulesEditor
                hardRules={config.hard_rules || {}}
                scoringCriteria={config.scoring_criteria || {}}
                modelConfig={{
                  model_provider: config.model_provider || 'openai',
                  model_version: config.model_version || 'gpt-4o',
                  fallback_provider: config.fallback_provider || 'gemini:2.0-pro',
                  scoring_model: config.scoring_model || 'gpt-4o-mini',
                  min_quality_score: config.min_quality_score || 7.5,
                  max_regeneration_attempts: config.max_regeneration_attempts || 2,
                  hooks_per_generation: config.hooks_per_generation || 5,
                }}
                onSave={(updated) => handleSave({ ...config, ...updated })}
                isSaving={saveConfig.isPending}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
