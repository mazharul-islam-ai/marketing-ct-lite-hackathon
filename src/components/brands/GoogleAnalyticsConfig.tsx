import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle2, AlertCircle, Trash2, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleAnalyticsConfigProps {
  brandId: string;
  onConfigured?: () => void;
}

interface GAConfig {
  propertyId: string;
  serviceAccountEmail: string;
  configured: boolean;
  updatedAt?: string;
}

export const GoogleAnalyticsConfig = ({ brandId, onConfigured }: GoogleAnalyticsConfigProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<GAConfig | null>(null);
  const [propertyId, setPropertyId] = useState("");

  // Load existing config (check multiple integration types for backwards compatibility)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("brand_analytics_integrations")
          .select("ga4_property_id, service_account_email, updated_at, integration_type")
          .eq("brand_id", brandId)
          .in("integration_type", ["google_analytics", "ga4", "n8n_analytics"])
          .order("updated_at", { ascending: false })
          .maybeSingle();

        if (error && error.code !== "PGRST116") throw error;

        if (data) {
          setConfig({
            propertyId: data.ga4_property_id || "",
            serviceAccountEmail: data.service_account_email || "",
            configured: true,
            updatedAt: data.updated_at,
          });
          setPropertyId(data.ga4_property_id || "");
        }
      } catch (error) {
        console.log("No existing config or error loading:", error);
      }
    };

    loadConfig();
  }, [brandId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const trimmedPropertyId = propertyId.trim();
    
    if (!trimmedPropertyId) {
      toast({
        title: "Property ID required",
        description: "Please enter your GA4 Property ID first",
        variant: "destructive",
      });
      return;
    }

    // Validate property ID is numeric
    if (!/^\d+$/.test(trimmedPropertyId)) {
      toast({
        title: "Invalid Property ID",
        description: "GA4 Property ID must be numeric (e.g., 479039040)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Read the JSON file
      const text = await file.text();
      console.log("File read successfully, length:", text.length);
      
      let serviceAccountKey;
      try {
        serviceAccountKey = JSON.parse(text);
        console.log("JSON parsed successfully, type:", serviceAccountKey.type);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error("Invalid JSON file. Please upload a valid service account key file.");
      }

      // Validate it's a service account key
      if (!serviceAccountKey.type || serviceAccountKey.type !== "service_account") {
        console.error("Invalid type:", serviceAccountKey.type);
        throw new Error("Invalid service account key file. Expected type 'service_account'.");
      }

      if (!serviceAccountKey.client_email) {
        throw new Error("Service account key missing client_email field.");
      }

      console.log("Validation passed, attempting database upsert...");

      // Check if record exists for any of the GA integration types
      const { data: existing } = await supabase
        .from("brand_analytics_integrations")
        .select("id")
        .eq("brand_id", brandId)
        .in("integration_type", ["google_analytics", "ga4", "n8n_analytics"])
        .order("updated_at", { ascending: false })
        .maybeSingle();

      console.log("Existing record:", existing);

      // Store the configuration with normalized integration_type
      const payload = {
        brand_id: brandId,
        integration_type: "google_analytics",
        ga4_property_id: trimmedPropertyId,
        service_account_email: serviceAccountKey.client_email,
        service_account_key_encrypted: JSON.stringify(serviceAccountKey),
        is_active: true,
        data_sources: { google_analytics: true },
        webhook_url: "internal",
      };

      console.log("Payload prepared:", { ...payload, service_account_key_encrypted: "[REDACTED]" });

      const { data, error } = existing
        ? await supabase
            .from("brand_analytics_integrations")
            .update(payload)
            .eq("id", existing.id)
            .select()
        : await supabase
            .from("brand_analytics_integrations")
            .insert(payload)
            .select();

      if (error) {
        console.error("Database error:", error);
        throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
      }

      console.log("Database operation successful:", data);

      setConfig({
        propertyId: trimmedPropertyId,
        serviceAccountEmail: serviceAccountKey.client_email,
        configured: true,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: "Configuration saved",
        description: "Google Analytics is now configured for this brand",
      });

      onConfigured?.();
    } catch (error) {
      console.error("Upload error details:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process service account key",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleRemoveConfig = async () => {
    try {
      // Delete all GA-related integration types for this brand
      const { error } = await supabase
        .from("brand_analytics_integrations")
        .delete()
        .eq("brand_id", brandId)
        .in("integration_type", ["google_analytics", "ga4", "n8n_analytics"]);

      if (error) throw error;

      setConfig(null);
      setPropertyId("");

      toast({
        title: "Configuration removed",
        description: "Google Analytics configuration has been deleted",
      });

      onConfigured?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove configuration",
        variant: "destructive",
      });
    }
  };

  const handleTestConnection = async () => {
    if (!config?.propertyId) return;

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-google-analytics", {
        body: {
          brandId,
          propertyId: config.propertyId,
          startDate: "7daysAgo",
          endDate: "today",
        },
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        toast({
          title: "Connection successful",
          description: `Retrieved ${data.length} days of analytics data`,
        });
      } else if (data?.diagnostics) {
        toast({
          title: "No data returned",
          description: data.message || "Check diagnostics in console",
          variant: "default",
        });
        console.log("GA Test diagnostics:", data.diagnostics);
      } else {
        toast({
          title: "No data returned",
          description: "Connection works but no analytics data available",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      toast({
        title: "Connection test failed",
        description: error.message || "Check console for details",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Analytics Configuration</CardTitle>
        <CardDescription>
          Upload your service account JSON key to enable analytics for this brand
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config?.configured ? (
          <>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">Google Analytics Configured</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Property ID: {config.propertyId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Service Account: {config.serviceAccountEmail}
                    </p>
                    {config.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Updated: {new Date(config.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveConfig}
                    className="ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                <TestTube className="h-4 w-4 mr-2" />
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Setup Required</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Go to Google Cloud Console</li>
                  <li>Enable Google Analytics Data API</li>
                  <li>Create a Service Account</li>
                  <li>Download the JSON key file</li>
                  <li>Add service account email to your GA4 property with Viewer access</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="propertyId">GA4 Property ID</Label>
              <Input
                id="propertyId"
                placeholder="e.g., 455161426"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Find this in GA4: Admin → Property Settings → Property ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jsonFile">Service Account JSON Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="jsonFile"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <Button disabled={uploading} size="icon" variant="outline" asChild>
                  <label htmlFor="jsonFile" className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                  </label>
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
