import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Contact {
  id: string;
  client_id: string;
  hubspot_id?: string;
  hubspot_sync_status?: string;
  hubspot_last_sync?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  title?: string;
  lifecycle_stage?: string;
  lead_status?: string;
  is_primary?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContactData {
  client_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  title?: string;
  is_primary?: boolean;
}

export interface UpdateContactData extends Partial<CreateContactData> {}

export function useContacts(clientId?: string) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setContacts((data || []) as any);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch contacts');
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (contactData: CreateContactData): Promise<Contact> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await (supabase as any)
      .from('contacts')
      .insert([contactData])
      .select()
      .single();

    if (error) throw error;

    toast.success("Contact created successfully");
    await fetchContacts();
    return data as Contact;
  };

  const updateContact = async (contactId: string, contactData: UpdateContactData): Promise<Contact> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await (supabase as any)
      .from('contacts')
      .update(contactData)
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    toast.success("Contact updated successfully");
    await fetchContacts();
    return data as any;
  };

  const deleteContact = async (contactId: string): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) throw error;

    toast.success("Contact deleted successfully");
    await fetchContacts();
  };

  const getContactById = async (contactId: string): Promise<Contact | null> => {
    if (!user?.id) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();

    if (error) throw error;
    return data as any;
  };

  useEffect(() => {
    if (user?.id) {
      fetchContacts();
    }
  }, [user?.id, clientId]);

  return {
    contacts,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    getContactById,
    refetch: fetchContacts
  };
}
