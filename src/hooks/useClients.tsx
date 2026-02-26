import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  industry?: string;
  status: 'active' | 'inactive' | 'prospect' | 'archived';
  satisfaction_score?: number;
  total_revenue?: number;
  assigned_manager?: string;
  notes?: string;
  hubspot_id?: string;
  hubspot_sync_status?: string;
  hubspot_last_sync?: string;
  hubspot_sync_metadata?: any;
  source?: string;
  data_completeness_score?: number;
  company_revenue?: number;
  monthly_billing?: number;
  team_size?: number;
  founded_year?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  country?: string;
  industry?: string;
  status?: 'active' | 'inactive' | 'prospect' | 'archived';
  satisfaction_score?: number;
  assigned_manager?: string;
  notes?: string;
}

export interface UpdateClientData extends Partial<CreateClientData> {}

interface ClientsResponse {
  data: Client[];
  count: number;
}

interface UseClientsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export function useClients(params: UseClientsParams = {}) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const { page = 1, limit = 10, status, search } = params;

  const fetchClients = async (): Promise<ClientsResponse> => {
    if (!user?.id) throw new Error("User not authenticated");

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as Client[],
      count: count || 0
    };
  };

  const createClient = async (clientData: CreateClientData): Promise<Client> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await (supabase as any)
      .from('clients')
      .insert([{
        ...clientData,
        assigned_manager: clientData.assigned_manager || user.id
      }])
      .select()
      .single();

    if (error) throw error;
    
    toast.success("Client created successfully");
    await loadClients();
    return data as Client;
  };

  const updateClient = async (clientId: string, clientData: UpdateClientData): Promise<Client> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;

    toast.success("Client updated successfully");
    await loadClients();
    return data as Client;
  };

  const deleteClient = async (clientId: string): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) throw error;

    toast.success("Client deleted successfully");
    await loadClients();
  };

  const getClientById = async (clientId: string): Promise<Client | null> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    if (error) throw error;
    return data as Client | null;
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchClients();
      setClients(response.data);
      setTotalCount(response.count);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch clients');
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadClients();
    }
  }, [user?.id, page, limit, status, search]);

  const searchHubSpotCompanies = async (searchTerm: string) => {
    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: { action: 'search_companies', searchTerm }
    });
    if (error) throw error;
    return data;
  };

  const fetchHubSpotCompanyById = async (companyId: string) => {
    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: { action: 'fetch_company_by_id', companyId }
    });
    if (error) throw error;
    return data;
  };

  const importHubSpotCompany = async (company: any, contacts: any[]) => {
    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: { action: 'import_company', company, contacts }
    });
    if (error) throw error;
    toast.success("Company imported successfully");
    await loadClients();
    return data;
  };

  const syncClientFromHubSpot = async (clientId: string) => {
    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: { action: 'sync_client', clientId }
    });
    if (error) throw error;
    toast.success("Client synced successfully");
    await loadClients();
    return data;
  };

  const linkClientToHubSpot = async (clientId: string, hubspotId: string) => {
    const { data, error } = await supabase.functions.invoke('hubspot-sync', {
      body: { action: 'link_client', clientId, hubspotId }
    });
    if (error) throw error;
    toast.success("Client linked to HubSpot");
    await loadClients();
    return data;
  };

  return {
    clients,
    loading,
    error,
    totalCount,
    createClient,
    updateClient,
    deleteClient,
    getClientById,
    searchHubSpotCompanies,
    fetchHubSpotCompanyById,
    importHubSpotCompany,
    syncClientFromHubSpot,
    linkClientToHubSpot,
    refetch: loadClients
  };
}