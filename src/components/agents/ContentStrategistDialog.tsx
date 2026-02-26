import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCalendarView } from "./ContentCalendarView";

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', provider: 'openai' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'claude' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

interface ContentStrategistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  brandId?: string;
  brandName?: string;
}

export function ContentStrategistDialog({ open, onOpenChange, userId, brandId, brandName }: ContentStrategistDialogProps) {
  const { toast } = useToast();
  const [selectedBrand, setSelectedBrand] = useState<string>(brandId || "");
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [contentType, setContentType] = useState("all");
  const [runResult, setRunResult] = useState<any>(null);

  // Lock to brand if passed
  const isBrandLocked = Boolean(brandId);

  // Fetch available brands (only when not locked)
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-for-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !isBrandLocked,
  });

  // Fetch thought leaders for selected brand
  const { data: leaders = [] } = useQuery({
    queryKey: ["leaders-for-brand", selectedBrand],
    queryFn: async () => {
      if (!selectedBrand) return [];
      const { data, error } = await (supabase as any)
        .from("thought_leaders")
        .select("id, name")
        .eq("brand_id", selectedBrand)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBrand,
  });

  // Direct call to content-strategist-agent edge function
  const runAgentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("content-strategist-agent", {
        body: {
          brand_id: selectedBrand,
          leader_id: selectedLeader && selectedLeader !== "all-leaders" ? selectedLeader : undefined,
          content_type: contentType !== "all" ? contentType : undefined,
          model: selectedModel,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Content strategy generated", description: "Processing complete" });
      setRunResult(data);
    },
    onError: (error) => {
      toast({
        title: "Failed to run agent",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleRun = async () => {
    if (!selectedBrand) {
      toast({ title: "Please select a brand", variant: "destructive" });
      return;
    }
    runAgentMutation.mutate();
  };

  const handleClose = () => {
    if (!runAgentMutation.isPending) {
      setRunResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Content Strategist
          </DialogTitle>
          <DialogDescription>
            Generate content ideas, hooks, and a repurposing calendar from uploaded transcripts.
          </DialogDescription>
        </DialogHeader>

        {runResult?.content_outputs ? (
          <ContentCalendarView
            contentOutputs={runResult.content_outputs}
            brandId={selectedBrand}
            onApprove={(selected) => {
              toast({ title: `Approved ${selected.length} assets` });
            }}
          />
        ) : (
          <>
            <div className="space-y-4 py-4">
              {isBrandLocked ? (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <Label className="text-xs text-muted-foreground">Running for</Label>
                  <p className="font-semibold">{brandName}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Brand *</Label>
                  <Select value={selectedBrand} onValueChange={(v) => {
                    setSelectedBrand(v);
                    setSelectedLeader("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedBrand && leaders.length > 0 && (
                <div className="space-y-2">
                  <Label>Thought Leader (optional)</Label>
                  <Select value={selectedLeader} onValueChange={setSelectedLeader}>
                    <SelectTrigger>
                      <SelectValue placeholder="All leaders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-leaders">All leaders</SelectItem>
                      {leaders.map((leader) => (
                        <SelectItem key={leader.id} value={leader.id}>
                          {leader.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Filter to content from a specific thought leader
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video_transcript">Video Transcript</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">What this agent will do:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Analyze uploaded transcripts and documents</li>
                  <li>Generate hook ideas with performance reasoning</li>
                  <li>Create multi-channel repurpose assets</li>
                  <li>Build a suggested content calendar</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={runAgentMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleRun} disabled={runAgentMutation.isPending || !selectedBrand}>
                {runAgentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Strategy
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
