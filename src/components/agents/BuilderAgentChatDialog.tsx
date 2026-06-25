import { AgentChatPanel } from "./AgentChatPanel";

interface BuilderAgentChatDialogProps {
  agentId: string;
  agentName: string;
  versionId: string | null;
  onClose: () => void;
}

export function BuilderAgentChatDialog({
  agentId,
  agentName,
  versionId,
  onClose,
}: BuilderAgentChatDialogProps) {
  return (
    <AgentChatPanel
      agentId={agentId}
      agentName={agentName}
      versionId={versionId}
      variant="dialog"
      onClose={onClose}
    />
  );
}
