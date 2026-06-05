import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, ExternalLink, FileSearch } from 'lucide-react';
import { useSEOSavedReports } from '../hooks/useSEOSavedReports';
import { SEOScoreRing } from './SEOScoreRing';
import type { SEOToolType } from '../types';

const TOOL_LABELS: Record<SEOToolType, string> = {
  site_audit: 'Site Audit',
  keyword_research: 'Keyword Research',
  backlink: 'Backlink Check',
  competitor: 'Competitor Analysis',
};

interface SEOSavedReportsListProps {
  brandId?: string;
}

export function SEOSavedReportsList({ brandId }: SEOSavedReportsListProps) {
  const navigate = useNavigate();
  const { data: reports, isLoading } = useSEOSavedReports(brandId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reports?.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileSearch className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            No scans yet — run your first audit from a brand&apos;s SEO workspace.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Reports</CardTitle>
        <p className="text-sm text-muted-foreground">
          Past SEO scans across clients and projects
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow
                key={report.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => report.result_url && navigate(report.result_url)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {report.input_value}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{report.brand_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{TOOL_LABELS[report.tool_type]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(report.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {report.score != null ? (
                    <SEOScoreRing score={report.score} size={40} showLabel={false} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {report.result_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(report.result_url!)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" disabled>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
