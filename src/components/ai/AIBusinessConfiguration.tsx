import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BusinessContext {
  company_name: string;
  industry: string;
  company_size: string;
  seasonal_rules: {
    Q1: string;
    Q2: string;
    Q3: string;
    Q4: string;
  };
  office_rules: Record<string, string>;
  company_policies: string;
}

export function AIBusinessConfiguration() {
  const { toast } = useToast();
  const [config, setConfig] = useState<BusinessContext>({
    company_name: '',
    industry: '',
    company_size: '',
    seasonal_rules: { Q1: '', Q2: '', Q3: '', Q4: '' },
    office_rules: {},
    company_policies: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_configurations')
        .select('configuration_data')
        .eq('configuration_type', 'business_context')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.configuration_data) {
        setConfig(data.configuration_data as unknown as BusinessContext);
      }
    } catch (error) {
      console.error('Error loading business configuration:', error);
    }
  };

  const saveConfiguration = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ai_configurations')
        .upsert({
          configuration_type: 'business_context',
          configuration_data: config as any,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'configuration_type'
        });

      if (error) throw error;

      toast({
        title: "Configuration Saved",
        description: "Business context configuration has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save business configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Context Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={config.company_name}
              onChange={(e) => setConfig(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Your Company Name"
            />
          </div>
          
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select 
              value={config.industry} 
              onValueChange={(value) => setConfig(prev => ({ ...prev, industry: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="company_size">Company Size</Label>
          <Select 
            value={config.company_size} 
            onValueChange={(value) => setConfig(prev => ({ ...prev, company_size: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small (1-50 employees)</SelectItem>
              <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
              <SelectItem value="large">Large (201-1000 employees)</SelectItem>
              <SelectItem value="enterprise">Enterprise (1000+ employees)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Seasonal Business Rules</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => (
              <div key={quarter}>
                <Label htmlFor={quarter}>{quarter} Rules</Label>
                <Textarea
                  id={quarter}
                  value={config.seasonal_rules[quarter]}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    seasonal_rules: { ...prev.seasonal_rules, [quarter]: e.target.value }
                  }))}
                  placeholder={`${quarter} business considerations...`}
                  rows={2}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="company_policies">Company Policies</Label>
          <Textarea
            id="company_policies"
            value={config.company_policies}
            onChange={(e) => setConfig(prev => ({ ...prev, company_policies: e.target.value }))}
            placeholder="Key company policies and procedures that should guide AI analysis..."
            rows={4}
          />
        </div>

        <Button onClick={saveConfiguration} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}