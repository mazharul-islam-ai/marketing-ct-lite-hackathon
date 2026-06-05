import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { useAdminBrands } from '@/hooks/useAdminBrands';
import { SEOHubOverview } from '../components/SEOHubOverview';
import { SEOSavedReportsList } from '../components/SEOSavedReportsList';

export default function SEOHubPage() {
  const [searchParams] = useSearchParams();
  const brandParam = searchParams.get('brand');
  const { brands, loading: brandsLoading } = useAdminBrands();
  const [selectedBrandId, setSelectedBrandId] = useState('');

  useEffect(() => {
    if (!brands?.length) return;

    if (brandParam) {
      const match = brands.find((b) => b.slug === brandParam);
      if (match) {
        setSelectedBrandId(match.id);
        return;
      }
    }

    if (!selectedBrandId && brands.length === 1) {
      setSelectedBrandId(brands[0].id);
    }
  }, [brands, brandParam, selectedBrandId]);

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl">SEO Hub</CardTitle>
                <CardDescription>
                  Keyword research, site audits, backlinks, and competitor analysis
                </CardDescription>
              </div>
            </div>
            <Select
              value={selectedBrandId}
              onValueChange={setSelectedBrandId}
              disabled={brandsLoading}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select brand..." />
              </SelectTrigger>
              <SelectContent>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Saved Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <SEOHubOverview
            brandId={selectedBrandId || undefined}
            brandSlug={selectedBrand?.slug}
          />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <SEOSavedReportsList brandId={selectedBrandId || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
