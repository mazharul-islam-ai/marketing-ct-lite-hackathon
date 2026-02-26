import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TestimonialType = "google_review" | "written_quote" | "video" | "linkedin" | "case_study";
export type TestimonialStatus =
  | "pending_outreach"
  | "requested"
  | "received"
  | "approved"
  | "published"
  | "dismissed";

export interface TestimonialRecord {
  id: string;
  clientName: string;
  companyName: string;
  type: TestimonialType;
  status: TestimonialStatus;
  sentimentScore: number;
  detectedFrom: "meeting" | "email" | "task_comment" | "manual";
  positiveSignals: string[];
  lastSignal: string;
  assignedTo: string;
  requestedAt?: string;
  receivedAt?: string;
  content?: string;
  externalUrl?: string;
  clientId?: string;
  brandId?: string;
  projectId?: string;
}

export interface TestimonialCounts {
  pendingOutreach: number;
  requested: number;
  received: number;
  approved: number;
  published: number;
}

// Seed data for demo purposes when database is empty
const seedTestimonials: TestimonialRecord[] = [
  {
    id: "tm-001",
    clientName: "Avery Johnson",
    companyName: "Cloudpeak Health",
    type: "google_review",
    status: "pending_outreach",
    sentimentScore: 86,
    detectedFrom: "meeting",
    positiveSignals: ["Best onboarding experience", "Loved the weekly updates"],
    lastSignal: "Team said the rollout was seamless and appreciated the proactive comms.",
    assignedTo: "Maya Lopez",
  },
  {
    id: "tm-002",
    clientName: "Jordan Wells",
    companyName: "Northwind Partners",
    type: "written_quote",
    status: "requested",
    sentimentScore: 79,
    detectedFrom: "email",
    positiveSignals: ["Exceeded expectations", "Looking forward to phase two"],
    lastSignal: "Client praised the reporting dashboards in the latest recap email.",
    assignedTo: "Ethan Patel",
    requestedAt: "2026-01-10",
  },
  {
    id: "tm-003",
    clientName: "Priya Singh",
    companyName: "Summit Logistics",
    type: "video",
    status: "received",
    sentimentScore: 91,
    detectedFrom: "task_comment",
    positiveSignals: ["Fantastic support", "Fast turnaround"],
    lastSignal: "Highlighted how quickly the team implemented feedback.",
    assignedTo: "Maya Lopez",
    receivedAt: "2026-01-12",
    content: "The team made us feel heard every step of the way."
  },
  {
    id: "tm-004",
    clientName: "Luis Martinez",
    companyName: "Brightpath Realty",
    type: "written_quote",
    status: "approved",
    sentimentScore: 88,
    detectedFrom: "manual",
    positiveSignals: ["Outstanding creativity", "More leads in week one"],
    lastSignal: "Account manager marked this client as highly satisfied.",
    assignedTo: "Ethan Patel",
    content: "Their creative direction helped us stand out immediately."
  },
];

// Transform database record to app format
const transformDbRecord = (record: any): TestimonialRecord => ({
  id: record.id,
  clientName: record.client_name,
  companyName: record.company_name || "",
  type: record.type as TestimonialType,
  status: record.status as TestimonialStatus,
  sentimentScore: record.sentiment_score || 0,
  detectedFrom: (record.detected_from || "manual") as TestimonialRecord["detectedFrom"],
  positiveSignals: record.positive_signals || [],
  lastSignal: record.last_signal || "",
  assignedTo: record.assigned_user?.first_name 
    ? `${record.assigned_user.first_name} ${record.assigned_user.last_name || ""}`.trim()
    : "Unassigned",
  requestedAt: record.requested_at,
  receivedAt: record.received_at,
  content: record.content,
  externalUrl: record.external_url,
  clientId: record.client_id,
  brandId: record.brand_id,
  projectId: record.project_id,
});

export const useTestimonials = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dbTestimonials, isLoading, error } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select(`*`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching testimonials:", error);
        throw error;
      }

      return data?.map(transformDbRecord) || [];
    },
  });

  // Use database data if available, otherwise use seed data for demo
  const testimonials = dbTestimonials?.length ? dbTestimonials : seedTestimonials;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TestimonialStatus }) => {
      // If it's a seed ID, skip database update
      if (id.startsWith("tm-")) {
        return;
      }

      const updateData: Record<string, any> = { status };
      
      // Set timestamp based on status
      if (status === "requested") {
        updateData.requested_at = new Date().toISOString();
      } else if (status === "received") {
        updateData.received_at = new Date().toISOString();
      } else if (status === "approved") {
        updateData.approved_at = new Date().toISOString();
      } else if (status === "published") {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("testimonials")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
      toast({ title: "Status updated", description: "Testimonial status has been updated." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error updating status", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateStatus = useCallback((id: string, status: TestimonialStatus) => {
    updateStatusMutation.mutate({ id, status });
  }, [updateStatusMutation]);

  const counts = useMemo<TestimonialCounts>(() => {
    return {
      pendingOutreach: testimonials.filter((item) => item.status === "pending_outreach").length,
      requested: testimonials.filter((item) => item.status === "requested").length,
      received: testimonials.filter((item) => item.status === "received").length,
      approved: testimonials.filter((item) => item.status === "approved").length,
      published: testimonials.filter((item) => item.status === "published").length,
    };
  }, [testimonials]);

  const opportunities = testimonials.filter((item) => item.status === "pending_outreach");
  const collection = testimonials.filter((item) =>
    ["requested", "received"].includes(item.status)
  );
  const repository = testimonials.filter((item) =>
    ["approved", "published"].includes(item.status)
  );

  return {
    testimonials,
    opportunities,
    collection,
    repository,
    counts,
    updateStatus,
    isLoading,
    error,
  };
};
