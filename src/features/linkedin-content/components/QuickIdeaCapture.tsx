import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Lightbulb, Plus, Send, Loader2, Mic, MicOff, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickIdeaCaptureProps {
  leaderId: string;
  variant?: "dialog" | "inline" | "fab";
  onIdeaSaved?: () => void;
}

export const QuickIdeaCapture = ({ leaderId, variant = "dialog", onIdeaSaved }: QuickIdeaCaptureProps) => {
  const [open, setOpen] = useState(false);
  const [ideaText, setIdeaText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (idea: string) => {
      // Get current week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff)).toISOString().split("T")[0];

      const { error } = await (supabase as any).from("weekly_trends").insert({
        leader_id: leaderId,
        topic_title: idea.substring(0, 100),
        topic_summary: idea,
        week_start: weekStart,
        status: "draft",
        idea_source: "personal",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Idea saved!");
      setIdeaText("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["weekly-trends", leaderId] });
      onIdeaSaved?.();
    },
    onError: (error) => {
      toast.error("Failed to save idea: " + error.message);
    },
  });

  const handleSave = () => {
    if (!ideaText.trim()) {
      toast.error("Please enter your idea");
      return;
    }
    saveMutation.mutate(ideaText.trim());
  };

  // Voice-to-text using Web Speech API
  const toggleRecording = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setIdeaText((prev) => prev + " " + finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast.error("Voice recognition error");
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const IdeaForm = () => (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          placeholder="What's on your mind? Capture that idea before it escapes..."
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value)}
          className="min-h-[120px] pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute right-2 top-2 ${isRecording ? "text-red-500 animate-pulse" : ""}`}
          onClick={toggleRecording}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        {variant === "dialog" && (
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={saveMutation.isPending || !ideaText.trim()}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Save Idea
        </Button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Quick Idea Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IdeaForm />
        </CardContent>
      </Card>
    );
  }

  if (variant === "fab") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 md:hidden"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Capture an Idea
            </DialogTitle>
          </DialogHeader>
          <IdeaForm />
        </DialogContent>
      </Dialog>
    );
  }

  // Default: dialog variant
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lightbulb className="mr-2 h-4 w-4" />
          Quick Idea
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Capture an Idea
          </DialogTitle>
        </DialogHeader>
        <IdeaForm />
      </DialogContent>
    </Dialog>
  );
};
