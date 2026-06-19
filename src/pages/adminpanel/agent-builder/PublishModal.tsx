import { useState } from "react";
import { Globe, X, Loader2, Copy, Check, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Agent, AgentVisibility } from "./types";
import { ab } from "./agentBuilderTheme";

export type { AgentVisibility };

interface PublishModalProps {
  agent: Agent;
  currentVersionId: string | null;
  onPublish: (visibility: AgentVisibility) => Promise<{ publicToken?: string } | void>;
  onClose: () => void;
}

const VISIBILITY_OPTIONS: { value: AgentVisibility; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "workspace",
    label: "Workspace Users",
    description: "All authenticated workspace members can view and run",
    icon: <Users className="w-3.5 h-3.5 text-blue-600" />,
  },
  {
    value: "admin_only",
    label: "Admin Only",
    description: "Only admins and managers can access in AI Control",
    icon: <Lock className="w-3.5 h-3.5 text-amber-600" />,
  },
  {
    value: "public",
    label: "Public (anyone with link)",
    description: "Generates a shareable link — no login required",
    icon: <Globe className="w-3.5 h-3.5 text-green-600" />,
  },
];

export function PublishModal({ agent, currentVersionId, onPublish, onClose }: PublishModalProps) {
  const [visibility, setVisibility] = useState<AgentVisibility>("workspace");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await onPublish(visibility);
      if (visibility === "public" && result && "publicToken" in result && result.publicToken) {
        const link = `${window.location.origin}/public/agents/${result.publicToken}`;
        setPublicLink(link);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedOption = VISIBILITY_OPTIONS.find((o) => o.value === visibility);

  // After publish for public — show the link screen
  if (publicLink) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className={cn("rounded-xl shadow-2xl w-[420px] border", ab.surfaceElevated)}>
          <div className={cn("flex items-center justify-between px-5 py-4 border-b", ab.borderSoft)}>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm">Agent Published</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 font-medium">
                {agent.name} is now public
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Shareable Link</Label>
              <div className="flex gap-2">
                <Input
                  value={publicLink}
                  readOnly
                  className={cn("h-9 text-xs font-mono", ab.input)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">Anyone with this link can view and run the agent without logging in.</p>
            </div>
          </div>

          <div className={cn("flex justify-end px-5 py-4 border-t rounded-b-xl", ab.toolbar)}>
            <Button size="sm" className="text-xs" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={cn("rounded-xl shadow-2xl w-[400px] border", ab.surfaceElevated)}>
        {/* Header */}
        <div className={cn("flex items-center justify-between px-5 py-4 border-b", ab.borderSoft)}>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-sm">Publish Agent</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <Field label="Agent Name" value={agent.name} />
          <Field label="Version" value={currentVersionId ? "Auto-incremented" : "No version yet"} />
          <Field label="Status" value="Will be set to Published" />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Access Level</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as AgentVisibility)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOption && (
              <p className="text-xs text-slate-500 mt-1">{selectedOption.description}</p>
            )}
          </div>

          {!currentVersionId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              You need to generate a flow before publishing.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={cn("flex items-center justify-between px-5 py-4 border-t rounded-b-xl", ab.toolbar)}>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5 bg-green-600 hover:bg-green-700"
            onClick={handlePublish}
            disabled={isPublishing || !currentVersionId}
          >
            {isPublishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
            Publish →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5 border-b", ab.borderSoft)}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}
