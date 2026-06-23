import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useSlackAuth = (onConnected?: () => void) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const processingRef = useRef(false);

  const initiateAuth = async (): Promise<boolean> => {
    setIsAuthenticating(true);
    try {
      const redirectUri = `${window.location.origin}/slack-oauth-callback`;

      const { data, error } = await supabase.functions.invoke("slack-oauth-init", {
        body: { redirectUri },
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(
          data.error.includes("Integrations Hub")
            ? data.error
            : data.error,
        );
      }
      if (!data?.authUrl) {
        throw new Error("Configure Client ID and Client Secret in Integrations Hub first.");
      }

      const popup = window.open(data.authUrl, "SlackAuth", "width=600,height=700");

      return await new Promise<boolean>((resolve) => {
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === "slack-oauth-error") {
            window.removeEventListener("message", handleMessage);
            toast({
              title: "Slack connection failed",
              description: event.data.error ?? "Authorization was denied or failed.",
              variant: "destructive",
            });
            resolve(false);
            return;
          }

          if (event.data?.type === "slack-oauth-callback" && event.data?.code) {
            if (processingRef.current) return;
            processingRef.current = true;
            window.removeEventListener("message", handleMessage);
            popup?.close();

            try {
              const { data: callbackData, error: callbackError } = await supabase.functions.invoke(
                "slack-oauth-callback",
                { body: { code: event.data.code, redirectUri } },
              );

              if (callbackError) throw callbackError;
              if (callbackData?.error) throw new Error(callbackData.error);

              toast({
                title: "Connected to Slack",
                description: callbackData?.team?.name
                  ? `Workspace: ${callbackData.team.name}`
                  : "Slack workspace connected successfully.",
              });

              onConnected?.();
              resolve(true);
            } catch (err: unknown) {
              toast({
                title: "Slack connection failed",
                description: err instanceof Error ? err.message : "Could not complete Slack OAuth.",
                variant: "destructive",
              });
              resolve(false);
            } finally {
              processingRef.current = false;
            }
          }
        };

        window.addEventListener("message", handleMessage);

        if (!popup) {
          window.location.assign(data.authUrl);
          resolve(false);
        }
      });
    } catch (error: unknown) {
      toast({
        title: "Slack connection failed",
        description: error instanceof Error ? error.message : "Failed to start Slack OAuth.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  return { isAuthenticating, initiateAuth };
};
