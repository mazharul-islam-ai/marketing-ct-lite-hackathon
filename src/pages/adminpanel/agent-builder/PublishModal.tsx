import { useState } from "react";
import { Globe, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "./types";

interface PublishModalProps {
  agent: Agent;
  currentVersionId: string | null;
  onPublish: () => Promise<void>;
  onClose: () => void;
}

export function PublishModal({ agent, currentVersionId, onPublish, onClose }: PublishModalProps) {
  const [permissions, setPermissions] = useState("workspace");
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[380px] border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
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
            <Label className="text-xs font-medium text-slate-600">Permissions</Label>
            <Select value={permissions} onValueChange={setPermissions}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Workspace Users</SelectItem>
                <SelectItem value="admin">Admin Only</SelectItem>
                <SelectItem value="public">Public (anyone with link)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!currentVersionId && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              You need to generate a flow before publishing.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
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
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}
