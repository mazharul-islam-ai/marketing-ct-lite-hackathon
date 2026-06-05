import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowUpRight, Link2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSEOSummary } from '../hooks/useSEOSummary';
import { SEOScoreRing } from './SEOScoreRing';

export function SEODashboardSection() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useSEOSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const s = summary!;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              SEO Hub
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Keyword tracking, audits, and backlink insights across clients.
            </p>
          </div>
          {s.latestScanScore != null && (
            <SEOScoreRing
              score={s.latestScanScore}
              size={64}
              label="Latest scan"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {s.isDemo && (
            <Badge variant="outline" className="text-xs">Demo data</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate('/seo-hub')}>
            Open SEO Hub
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Latest Scan Score</p>
          <p className="text-2xl font-semibold text-foreground">
            {s.latestScanScore != null ? `${s.latestScanScore}/100` : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Tracked Keywords</p>
          <p className="text-2xl font-semibold text-foreground">{s.keywordCount}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3 w-3" /> Backlinks
          </p>
          <p className="text-2xl font-semibold text-foreground">{s.backlinkCount}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Reports This Month
          </p>
          <p className="text-2xl font-semibold text-foreground">{s.reportsThisMonth}</p>
        </div>
      </CardContent>
    </Card>
  );
}
