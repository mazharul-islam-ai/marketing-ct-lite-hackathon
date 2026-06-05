import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOScoreRing } from '../SEOScoreRing';
import type { CompetitorResultCard } from '../../types';

interface CompetitorResultsCardsProps {
  data: CompetitorResultCard[];
  isLoading?: boolean;
  error?: string | null;
}

export function CompetitorResultsCards({
  data,
  isLoading = false,
  error = null,
}: CompetitorResultsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Enter competitor domains to run analysis.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((competitor) => (
        <Card key={competitor.domain}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">{competitor.domain}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {competitor.overlap_keywords} overlapping keywords
              </p>
            </div>
            <SEOScoreRing
              score={competitor.gap_score}
              size={56}
              showLabel={false}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {competitor.summary && (
              <p className="text-sm text-muted-foreground">{competitor.summary}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {competitor.top_keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
