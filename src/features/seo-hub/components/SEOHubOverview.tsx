import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSEOSummary } from '../hooks/useSEOSummary';
import { SEOScoreRing } from './SEOScoreRing';
import { SEOToolLauncherCard } from './SEOToolLauncherCard';

interface SEOHubOverviewProps {
  brandId?: string;
  brandSlug?: string;
}

export function SEOHubOverview({ brandId, brandSlug }: SEOHubOverviewProps) {
  const { data: summary, isLoading } = useSEOSummary(brandId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const s = summary!;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SEO Summary</CardTitle>
            {s.isDemo && (
              <Badge variant="outline" className="mt-2 text-xs">
                Showing demo data — run a scan to see live metrics
              </Badge>
            )}
          </div>
          {s.latestScanScore != null && (
            <SEOScoreRing score={s.latestScanScore} size={80} label="Scan score" />
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Latest Scan</p>
            <p className="text-2xl font-semibold">
              {s.latestScanScore != null ? `${s.latestScanScore}/100` : '—'}
            </p>
            {s.lastScanDate && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(s.lastScanDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Keywords Tracked</p>
            <p className="text-2xl font-semibold">{s.keywordCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Backlinks Found</p>
            <p className="text-2xl font-semibold">{s.backlinkCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Reports This Month</p>
            <p className="text-2xl font-semibold">{s.reportsThisMonth}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">SEO Tools</h2>
        {!brandSlug ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a brand above to launch SEO tools.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SEOToolLauncherCard
              toolType="keyword_research"
              brandSlug={brandSlug}
            />
            <SEOToolLauncherCard
              toolType="site_audit"
              brandSlug={brandSlug}
              lastScore={s.latestScanScore}
            />
            <SEOToolLauncherCard
              toolType="backlink"
              brandSlug={brandSlug}
              lastScore={65}
            />
            <SEOToolLauncherCard
              toolType="competitor"
              brandSlug={brandSlug}
              lastScore={72}
            />
          </div>
        )}
      </div>
    </div>
  );
}
