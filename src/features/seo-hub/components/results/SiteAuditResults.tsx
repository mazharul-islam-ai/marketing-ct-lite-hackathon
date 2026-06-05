import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOScoreRing } from '../SEOScoreRing';
import type { SiteAuditResult } from '../../types';

interface SiteAuditResultsProps {
  data: SiteAuditResult | null;
  isLoading?: boolean;
  error?: string | null;
}

export function SiteAuditResults({
  data,
  isLoading = false,
  error = null,
}: SiteAuditResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Run a site audit to see results here.
      </p>
    );
  }

  const score = data.score ?? Math.min(100, Math.max(40, 100 - data.suggestions.length * 5));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-6">
        <SEOScoreRing score={score} size={96} label="Audit Score" />
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold">Audit Summary</h3>
          <p className="text-sm text-muted-foreground">
            {data.summary ?? 'Review the suggestions below to improve your SEO performance.'}
          </p>
          <Badge variant="secondary">{data.suggestions.length} suggestions</Badge>
        </div>
      </div>

      {data.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.suggestions.map((suggestion, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <span className="text-xs font-medium text-muted-foreground mt-0.5">
                    {idx + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{suggestion.text}</p>
                    {suggestion.confidence != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confidence: {Math.round(suggestion.confidence * 100)}%
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
