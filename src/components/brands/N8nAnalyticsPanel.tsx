import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const N8nAnalyticsPanel = ({ brandId }: { brandId: string }) => {
  const { analyticsData, loading, fetchAnalyticsData, saveAnalyticsData } = useGoogleAnalytics(brandId);
  const { toast } = useToast();
  const [lastError, setLastError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load GA configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("brand_analytics_integrations")
          .select("ga4_property_id, is_active")
          .eq("brand_id", brandId)
          .in("integration_type", ["n8n_analytics", "google_analytics", "ga4"])
          .single();

        if (error) throw error;

        if (data && data.is_active && data.ga4_property_id) {
          setPropertyId(data.ga4_property_id);
          setIsConfigured(true);
        }
      } catch (error) {
        // No config - component will show appropriate message
        setIsConfigured(false);
      }
    };

    loadConfig();
  }, [brandId]);

  const handleFetchAnalytics = async () => {
    if (!propertyId) {
      toast({
        title: "Configuration missing",
        description: "Please configure Google Analytics first",
        variant: "destructive",
      });
      return;
    }

    setLastError(null);
    setDiagnostics(null);
    try {
      const result = await fetchAnalyticsData(propertyId);
      
      // Auto-save the fetched data
      if (result && result.length > 0) {
        await saveAnalyticsData(result);
        toast({
          title: "Success",
          description: `Analytics data fetched and saved: ${result.length} records`,
        });
      } else {
        toast({
          title: "Success",
          description: `Analytics data fetched: ${result?.length || 0} records`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch analytics data";
      setLastError(errorMessage);
      
      // Extract diagnostics if available
      if (error instanceof Error && error.message.includes('Service Account:')) {
        const diagInfo: any = {};
        const matches = error.message.match(/Service Account: (.+)/);
        if (matches) diagInfo.serviceAccount = matches[1].trim();
        const dateMatches = error.message.match(/Date Range: (.+)/);
        if (dateMatches) diagInfo.dateRange = dateMatches[1].trim();
        setDiagnostics(diagInfo);
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const formattedData = analyticsData.map(item => ({
    date: item.date,
    users: parseInt(item.totalUsers),
    pageViews: parseInt(item.screenPageViews),
    activeUsers: parseInt(item.active1DayUsers),
  })).sort((a, b) => a.date.localeCompare(b.date));

  if (!isConfigured) {
    return null; // Don't show panel if not configured
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Google Analytics Data</CardTitle>
          {propertyId && (
            <p className="text-xs text-muted-foreground mt-1">
              Property: {propertyId}
            </p>
          )}
        </div>
        <Button
          onClick={handleFetchAnalytics} 
          disabled={loading}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Analytics
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {lastError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Error Details:</p>
                <pre className="text-xs whitespace-pre-wrap bg-destructive/10 p-2 rounded">{lastError}</pre>
                {diagnostics && (
                  <div className="text-xs mt-2">
                    <p><strong>Service Account:</strong> {diagnostics.serviceAccount}</p>
                    <p><strong>Date Range:</strong> {diagnostics.dateRange}</p>
                  </div>
                )}
                <div className="text-xs mt-2">
                  <p className="font-semibold">Possible issues:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Property ID "{propertyId}" may be incorrect</li>
                    <li>Service account lacks Viewer access to GA4 property</li>
                    <li>No data collected in last 30 days</li>
                    <li>Wrong GA4 property connected</li>
                  </ul>
                  <p className="mt-2 font-semibold">How to fix:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verify property ID in GA4: Admin → Property Settings</li>
                    <li>Grant access: GA4 Admin → Property Access Management → Add service account email with Viewer role</li>
                    <li>Confirm website is sending data to this property</li>
                  </ul>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {analyticsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No analytics data available. Click the button above to fetch data from Google Analytics.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tickFormatter={(value) => {
                  const year = value.substring(0, 4);
                  const month = value.substring(4, 6);
                  const day = value.substring(6, 8);
                  return `${month}/${day}`;
                }}
              />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem'
                }}
                labelFormatter={(value) => {
                  const year = value.substring(0, 4);
                  const month = value.substring(4, 6);
                  const day = value.substring(6, 8);
                  return `Date: ${year}-${month}-${day}`;
                }}
              />
              <Legend />
              <Bar dataKey="users" fill="hsl(var(--primary))" name="Total Users" />
              <Bar dataKey="pageViews" fill="hsl(var(--chart-2))" name="Page Views" />
              <Bar dataKey="activeUsers" fill="hsl(var(--chart-3))" name="Active Users" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
