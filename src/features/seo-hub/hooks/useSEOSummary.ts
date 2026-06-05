import { useQuery } from '@tanstack/react-query';
import { getSEOSummary } from '../api';

export function useSEOSummary(brandId?: string) {
  return useQuery({
    queryKey: ['seo-summary', brandId ?? 'all'],
    queryFn: () => getSEOSummary(brandId),
    staleTime: 60_000,
  });
}
