import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { KeywordResultRow } from '../../types';

interface KeywordResultsTableProps {
  data: KeywordResultRow[];
  isLoading?: boolean;
  error?: string | null;
  onSave?: (row: KeywordResultRow) => void;
  savingKeyword?: string | null;
}

export function KeywordResultsTable({
  data,
  isLoading = false,
  error = null,
  onSave,
  savingKeyword = null,
}: KeywordResultsTableProps) {
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
    return (
      <p className="text-sm text-destructive py-4 text-center">{error}</p>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No keyword suggestions yet. Enter a seed keyword to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead>Volume</TableHead>
          <TableHead>Competition</TableHead>
          <TableHead>Relevance</TableHead>
          {onSave && <TableHead className="text-right">Action</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.keyword}>
            <TableCell className="font-medium">{row.keyword}</TableCell>
            <TableCell>
              {row.search_volume != null
                ? row.search_volume.toLocaleString()
                : '—'}
            </TableCell>
            <TableCell>
              {row.competition ? (
                <Badge variant="outline">{row.competition}</Badge>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>{row.relevance_score}/100</TableCell>
            {onSave && (
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSave(row)}
                  disabled={savingKeyword === row.keyword}
                >
                  {savingKeyword === row.keyword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-1 h-3 w-3" />
                      Save
                    </>
                  )}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
