import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { BacklinkResultRow } from '../../types';

interface BacklinkResultsTableProps {
  data: BacklinkResultRow[];
  isLoading?: boolean;
  error?: string | null;
}

export function BacklinkResultsTable({
  data,
  isLoading = false,
  error = null,
}: BacklinkResultsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive py-4 text-center">{error}</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No backlinks found. Enter a domain to check backlinks.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source Domain</TableHead>
          <TableHead>Target URL</TableHead>
          <TableHead>Link Type</TableHead>
          <TableHead>Anchor Text</TableHead>
          <TableHead>DR</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, idx) => (
          <TableRow key={`${row.source_domain}-${idx}`}>
            <TableCell className="font-medium">{row.source_domain}</TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">
              {row.target_url}
            </TableCell>
            <TableCell>
              <Badge
                variant={row.link_type === 'dofollow' ? 'default' : 'outline'}
              >
                {row.link_type}
              </Badge>
            </TableCell>
            <TableCell>{row.anchor_text}</TableCell>
            <TableCell>
              {row.domain_rating != null ? row.domain_rating : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
