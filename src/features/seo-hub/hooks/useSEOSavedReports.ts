import { useQuery } from '@tanstack/react-query';
import { listSEOSavedReports } from '../api';

export function useSEOSavedReports(brandId?: string) {
  return useQuery({
    queryKey: ['seo-saved-reports', brandId ?? 'all'],
    queryFn: () => listSEOSavedReports(brandId),
    staleTime: 30_000,
  });
}
