import { Settings, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import type { IntegrationStatus } from "@/types/integration-status";
import { getComplexityColor } from "@/lib/integration-utils";

interface ProviderCardIntegration {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_available: boolean;
  is_enabled: boolean;
  setup_complexity: "easy" | "medium" | "complex";
  required_fields: string[];
  status?: IntegrationStatus;
}

interface ProviderCardProps {
  integration: ProviderCardIntegration;
  /** If set, the Configure button renders as a router Link instead of a button */
  configureHref?: string;
  /** Custom label for the test/action button */
  testLabel?: string;
  onConfigure?: () => void;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
}

export function ProviderCard({
  integration,
  configureHref,
  testLabel,
  onConfigure,
  onTest,
  onToggle,
}: ProviderCardProps) {
  return (
    <Card className="relative flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.icon}</span>
            <div>
              <CardTitle className="text-lg leading-tight">{integration.name}</CardTitle>
              <Badge className={`mt-1 text-xs ${getComplexityColor(integration.setup_complexity)}`}>
                {integration.setup_complexity}
              </Badge>
            </div>
          </div>
          <Switch
            checked={integration.is_enabled}
            onCheckedChange={onToggle}
            disabled={!integration.status?.configured}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        <CardDescription>{integration.description}</CardDescription>

        <div className="flex items-center justify-between min-h-[24px]">
          {integration.status ? (
            <IntegrationStatusBadge
              configured={integration.status.configured}
              connected={integration.status.connected}
              enabled={integration.status.enabled}
              error={integration.status.error}
              lastChecked={integration.status.lastChecked}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={integration.is_available ? "default" : "secondary"}>
                {integration.is_available ? "Available" : "Unavailable"}
              </Badge>
              <Badge variant={integration.is_enabled ? "default" : "outline"}>
                {integration.is_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Required Configuration
          </p>
          <div className="flex flex-wrap gap-1">
            {integration.required_fields.map((field) => (
              <Badge key={field} variant="outline" className="text-xs">
                {field.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          {configureHref ? (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={configureHref}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1" onClick={onConfigure}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={onTest}
            disabled={!integration.is_available}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {testLabel ?? "Test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
