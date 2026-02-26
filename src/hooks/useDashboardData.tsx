import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface DashboardKPI {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  performance: number;
  tasksCompleted: number;
  availability: 'available' | 'busy' | 'unavailable';
}

interface BrandPerformance {
  id: string;
  name: string;
  slug: string;
  type: 'internal' | 'client';
  description: string;
  owner_id: string;
  owner_name?: string;
  is_active: boolean;
  team_members: string[];
  active_integrations: string[];
  monthly_budget?: number;
  revenue: number;
  growth: number;
  status: 'growing' | 'stable' | 'declining';
  activeTasks: number;
  kpis: Array<{
    id?: string;
    name: string;
    current_value: number;
    target_value: number | null;
  }>;
}

interface DashboardData {
  // General KPIs
  teamEffortKPIs: DashboardKPI[];
  socialMediaKPIs: DashboardKPI[];
  websiteKPIs: DashboardKPI[];
  paidCampaignKPIs: DashboardKPI[];
  
  // Team & Performance
  teamMembers: TeamMember[];
  brandPerformance: BrandPerformance[];
  
  // Stats
  totalUsers: number;
  activeBrands: number;
  totalRevenue: number;
  teamEfficiency: number;
  
  loading: boolean;
  error: string | null;
}

export function useDashboardData() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    teamEffortKPIs: [],
    socialMediaKPIs: [],
    websiteKPIs: [],
    paidCampaignKPIs: [],
    teamMembers: [],
    brandPerformance: [],
    totalUsers: 0,
    activeBrands: 0,
    totalRevenue: 0,
    teamEfficiency: 0,
    loading: true,
    error: null
  });

  const resolveOwnerName = (brand: any) => {
    if (brand?.owner_name && brand.owner_name !== 'Unknown') {
      return brand.owner_name;
    }

    const owner = brand?.owner;
    if (owner) {
      const fullName = `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim();
      if (fullName) {
        return fullName;
      }

      if (owner.email) {
        return owner.email;
      }
    }

    if (brand?.owner_email) {
      return brand.owner_email;
    }

    return 'Unknown';
  };

  const fetchUserBrands = async () => {
    if (!user?.id) return [];

    // Get user's assigned brands based on role
    if (user.role === 'super_admin' || user.role === 'manager') {
      const { data: brands, error } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (brands || []).map(brand => ({
        ...brand,
        owner_name: resolveOwnerName(brand)
      }));
    } else {
      // Regular users only see their assigned brands
      const { data: userBrands, error } = await supabase
        .from('user_brands')
        .select('brands(*)')
        .eq('user_id', user.id);

      if (error) throw error;
      return (
        userBrands?.map(ub => {
          if (!ub.brands) return null;
          const brandWithOwner = {
            ...ub.brands,
            owner_name: resolveOwnerName(ub.brands)
          };
          return brandWithOwner;
        }).filter(Boolean) || []
      );
    }
  };

  const calculateKPIsFromBrands = (brands: any[]) => {
    const totalBrands = brands.length;
    const totalBudget = brands.reduce((sum, brand) => sum + (brand.monthly_budget || 0), 0);
    const activeBrands = brands.filter(brand => {
      if (typeof brand.is_active === 'boolean') {
        return brand.is_active;
      }
      return brand.status === 'active';
    }).length;
    
    // Calculate growth based on active vs total brands
    const growthRate = totalBrands > 0 ? ((activeBrands / totalBrands) * 100) - 85 : 0;
    
    return {
      teamEffort: [
        {
          title: "Active Brands",
          value: activeBrands,
          change: Math.round(growthRate),
          changeType: (growthRate > 0 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral',
          description: "managed brands"
        },
        {
          title: "Total Budget",
          value: `$${(totalBudget / 1000).toFixed(0)}K`,
          change: 8,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "monthly allocation"
        },
        {
          title: "Team Members",
          value: brands.reduce((sum, brand) => sum + (brand.team_members?.length || 0), 0),
          change: 0,
          changeType: 'neutral' as 'positive' | 'negative' | 'neutral',
          description: "across all brands"
        },
        {
          title: "Performance Score",
          value: `${Math.min(95, 75 + (activeBrands * 3))}%`,
          change: 12,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "overall efficiency"
        }
      ] as DashboardKPI[],
      socialMedia: [
        {
          title: "Total Reach",
          value: `${Math.round(activeBrands * 45)}K`,
          change: 18,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "across all brands"
        },
        {
          title: "Engagement Rate",
          value: `${(3.2 + (activeBrands * 0.2)).toFixed(1)}%`,
          change: 8,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "avg performance"
        },
        {
          title: "Brand Growth",
          value: `+${Math.round(activeBrands * 200)}`,
          change: 22,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "new followers"
        },
        {
          title: "Social ROI",
          value: `$${(6.50 + (activeBrands * 0.3)).toFixed(2)}`,
          change: activeBrands > 3 ? 5 : -3,
          changeType: (activeBrands > 3 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral',
          description: "per engagement"
        }
      ] as DashboardKPI[],
      website: [
        {
          title: "Total Sessions",
          value: `${Math.round(activeBrands * 3.2)}K`,
          change: 25,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "this month"
        },
        {
          title: "Conversion Rate",
          value: `${(2.8 + (activeBrands * 0.15)).toFixed(1)}%`,
          change: 12,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "visitors to leads"
        },
        {
          title: "Bounce Rate",
          value: `${Math.max(35, 50 - (activeBrands * 2))}%`,
          change: -8,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "improved retention"
        },
        {
          title: "Lead Value",
          value: `$${Math.round(150 + (activeBrands * 8))}`,
          change: 5,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "avg per lead"
        }
      ] as DashboardKPI[],
      paidCampaigns: [
        {
          title: "Click-Through Rate",
          value: `${(2.1 + (activeBrands * 0.1)).toFixed(1)}%`,
          change: 15,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "across all ads"
        },
        {
          title: "Cost Per Click",
          value: `$${Math.max(0.85, 1.5 - (activeBrands * 0.08)).toFixed(2)}`,
          change: -10,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "lower is better"
        },
        {
          title: "ROAS",
          value: `${(3.2 + (activeBrands * 0.15)).toFixed(1)}x`,
          change: 20,
          changeType: 'positive' as 'positive' | 'negative' | 'neutral',
          description: "return on ad spend"
        },
        {
          title: "Ad Spend",
          value: `$${(totalBudget * 0.4 / 1000).toFixed(1)}K`,
          change: -5,
          changeType: 'neutral' as 'positive' | 'negative' | 'neutral',
          description: "this month"
        }
      ] as DashboardKPI[]
    };
  };

  const fetchBrandKPIs = async (brands: any[]) => {
    const brandPerformanceData = await Promise.all(brands.map(async (brand) => {
      const { data: kpis, error } = await supabase
        .from('brand_kpis')
        .select('*')
        .eq('brand_id', brand.id);

      if (error) {
        throw new Error(`Failed to fetch KPIs for ${brand.name ?? brand.id}: ${error.message}`);
      }

      const revenue = (brand.monthly_budget || 50000) * (0.8 + Math.random() * 0.4);
      const growth = -10 + Math.random() * 30; // Random growth between -10% and 20%

      let status: 'growing' | 'stable' | 'declining';
      if (growth > 5) status = 'growing';
      else if (growth > -5) status = 'stable';
      else status = 'declining';

      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug || '',
        type: brand.type || 'internal',
        description: brand.description || '',
        owner_id: brand.owner_id || '',
        owner_name: resolveOwnerName(brand),
        is_active: Boolean(brand.is_active),
        team_members: brand.team_members || [],
        active_integrations: brand.active_integrations || [],
        monthly_budget: brand.monthly_budget,
        revenue: Math.round(revenue),
        growth: Math.round(growth * 10) / 10,
        status,
        activeTasks: Math.round(15 + Math.random() * 30),
        kpis: (kpis || []).map(kpi => ({
          id: kpi.id,
          name: (kpi as any).name || kpi.kpi_name,
          current_value: kpi.current_value,
          target_value: kpi.target_value
        }))
      } as BrandPerformance;
    }));

    return brandPerformanceData;
  };

  const fetchTeamMembers = async (): Promise<TeamMember[]> => {
    if (!user?.id) return [];
    
    // Fetch users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .limit(20);
    
    if (usersError) throw usersError;
    if (!users) return [];

    // Fetch roles for all users
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', users.map(u => u.id));

    if (rolesError) throw rolesError;

    // Filter based on current user's role
    const usersWithRoles = users.map(u => {
      const roleData = rolesData?.find(r => r.user_id === u.id);
      return {
        ...u,
        role: roleData?.role || 'user'
      };
    });

    let filteredUsers = usersWithRoles;
    if (user.role === 'manager') {
      // Managers see manager level and below
      filteredUsers = usersWithRoles.filter(u => ['manager', 'pm', 'user'].includes(u.role));
    } else if (user.role !== 'super_admin') {
      // Other users see only themselves
      filteredUsers = usersWithRoles.filter(u => u.id === user.id);
    }

    return filteredUsers.map(user => ({
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      role: user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      performance: Math.round(75 + Math.random() * 25),
      tasksCompleted: Math.round(15 + Math.random() * 35),
      availability: (Math.random() > 0.3 ? 'available' : Math.random() > 0.5 ? 'busy' : 'unavailable') as 'available' | 'busy' | 'unavailable'
    }));
  };

  const fetchDashboardData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const [brands, allUsers] = await Promise.all([
        fetchUserBrands(),
        supabase.from('users').select('*').limit(100)
      ]);

      if (allUsers.error) {
        throw allUsers.error;
      }

      const kpis = calculateKPIsFromBrands(brands);
      const brandPerformance = await fetchBrandKPIs(brands);
      const teamMembers = await fetchTeamMembers();

      const totalRevenue = brandPerformance.reduce((sum, brand) => sum + brand.revenue, 0);
      const activeBrands = brands.filter(brand => {
        if (typeof brand.is_active === 'boolean') {
          return brand.is_active;
        }
         return (brand as any).status === 'active';
      }).length;

      setData({
        teamEffortKPIs: kpis.teamEffort,
        socialMediaKPIs: kpis.socialMedia,
        websiteKPIs: kpis.website,
        paidCampaignKPIs: kpis.paidCampaigns,
        teamMembers,
        brandPerformance,
        totalUsers: allUsers.data?.length || 0,
        activeBrands,
        totalRevenue,
        teamEfficiency: Math.round(75 + (activeBrands * 2.5)),
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      }));
      toast.error('Failed to load dashboard data');
    }
  };

  const refreshData = () => {
    fetchDashboardData();
  };

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id]);

  // Set up real-time subscriptions for data updates
  useEffect(() => {
    if (!user?.id) return;

    const brandSubscription = supabase
      .channel('brands-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brands'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    const kpiSubscription = supabase
      .channel('brand-kpis-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brand_kpis'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(brandSubscription);
      supabase.removeChannel(kpiSubscription);
    };
  }, [user?.id]);

  return {
    ...data,
    refreshData
  };
}
