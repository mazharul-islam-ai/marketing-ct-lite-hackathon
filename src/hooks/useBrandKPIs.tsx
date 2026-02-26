import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export interface BrandKPI {
  id: string;
  brand_id: string;
  name: string;
  type: string;
  description: string | null;
  current_value: number;
  target_value: number | null;
  source: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string | null;
  active_integrations: string[];
  is_active: boolean;
}

export const useBrandKPIs = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [kpis, setKpis] = useState<BrandKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBrands((data || []) as any);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error fetching brands",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const fetchKPIs = async (brandId?: string) => {
    try {
      let query = (supabase as any)
        .from('brand_kpis')
        .select('*')
        .order('display_order');

      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setKpis((data || []) as any);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error fetching KPIs",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const createKPI = async (kpiData: Omit<BrandKPI, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await (supabase as any)
        .from('brand_kpis')
        .insert(kpiData)
        .select()
        .single();

      if (error) throw error;
      
      setKpis(prev => [...prev, data] as any);
      toast({
        title: "KPI created successfully",
        description: `${(data as any).name || data.kpi_name} has been added to the brand.`
      });
      
      return data;
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error creating KPI",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const updateKPI = async (id: string, updates: Partial<BrandKPI>) => {
    try {
      const { data, error } = await (supabase as any)
        .from('brand_kpis')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setKpis(prev => prev.map(kpi => kpi.id === id ? data : kpi) as any);
      toast({
        title: "KPI updated successfully",
        description: `${(data as any).name || data.kpi_name} has been updated.`
      });
      
      return data;
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error updating KPI",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const deleteKPI = async (id: string) => {
    try {
      const { error } = await supabase
        .from('brand_kpis')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setKpis(prev => prev.filter(kpi => kpi.id !== id));
      toast({
        title: "KPI deleted successfully",
        description: "The KPI has been removed from the brand."
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error deleting KPI",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const getKPIsByBrand = (brandId: string) => {
    return kpis.filter(kpi => kpi.brand_id === brandId);
  };

  const refreshData = async (brandId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchBrands(),
        fetchKPIs(brandId)
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    const brandKPIsChannel = supabase
      .channel('brand_kpis_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brand_kpis'
        },
        () => {
          fetchKPIs();
        }
      )
      .subscribe();

    const brandsChannel = supabase
      .channel('brands_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brands'
        },
        () => {
          fetchBrands();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(brandKPIsChannel);
      supabase.removeChannel(brandsChannel);
    };
  }, []);

  return {
    brands,
    kpis,
    loading,
    error,
    createKPI,
    updateKPI,
    deleteKPI,
    getKPIsByBrand,
    refreshData
  };
};