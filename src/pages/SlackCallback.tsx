import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const SlackCallback = () => {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      if (window.opener) {
        window.opener.postMessage({ type: "slack-oauth-error", error }, "*");
        window.close();
      } else {
        toast({
          title: "Slack connection failed",
          description: error,
          variant: "destructive",
        });
        navigate("/adminpanel/integrations");
      }
      return;
    }

    if (code) {
      if (window.opener) {
        window.opener.postMessage({ type: "slack-oauth-callback", code }, "*");
        window.close();
      } else {
        const redirectUri = `${window.location.origin}/slack-oauth-callback`;
        supabase.functions
          .invoke("slack-oauth-callback", { body: { code, redirectUri } })
          .then(({ data, error: callbackError }) => {
            if (callbackError || data?.error) {
              toast({
                title: "Slack connection failed",
                description: callbackError?.message ?? data?.error ?? "Could not complete Slack OAuth.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Connected to Slack",
                description: data?.team?.name
                  ? `Workspace: ${data.team.name}`
                  : "Slack workspace connected successfully.",
              });
            }
            navigate("/adminpanel/integrations");
          })
          .catch(() => {
            toast({
              title: "Slack connection failed",
              description: "Could not complete Slack OAuth.",
              variant: "destructive",
            });
            navigate("/adminpanel/integrations");
          });
      }
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Completing Slack authentication...</p>
      </div>
    </div>
  );
};
