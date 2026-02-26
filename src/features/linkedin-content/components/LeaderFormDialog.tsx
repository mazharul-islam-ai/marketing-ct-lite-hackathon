import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkedInLeader, LeaderInput } from "../types";
import { Loader2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const leaderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  department: z.string().optional(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  personaTone: z.string().min(1, "Persona tone is required"),
  targetAudience: z.string().optional(),
  agentTemplateId: z.string().optional(),
  userId: z.string().optional(),
});

type LeaderFormSchema = z.infer<typeof leaderSchema>;

const serializeAudience = (audience: Record<string, unknown>) => {
  if (!audience || Object.keys(audience).length === 0) {
    return "";
  }
  return JSON.stringify(audience, null, 2);
};

const parseAudience = (value: string): Record<string, unknown> => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    console.warn("Falling back to description-based audience", error);
    return { description: trimmed };
  }
};

interface UserOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

const NO_USER_VALUE = "__no_user__";

export interface LeaderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: LeaderInput) => Promise<void> | void;
  isSaving?: boolean;
  leader?: LinkedInLeader | null;
}

export const LeaderFormDialog = ({ open, onOpenChange, onSubmit, isSaving, leader }: LeaderFormDialogProps) => {
  // Fetch users for linking
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["users-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      
      if (error) throw error;
      return (data || []) as UserOption[];
    },
    enabled: open,
  });

  // Get existing linked user_id from thought_leaders if editing
  const { data: existingUserId } = useQuery({
    queryKey: ["leader-user-id", leader?.id],
    queryFn: async () => {
      if (!leader?.id) return null;
      const { data, error } = await (supabase as any)
        .from("thought_leaders")
        .select("user_id")
        .eq("id", leader.id)
        .single();
      
      if (error) return null;
      return data?.user_id || null;
    },
    enabled: open && !!leader?.id,
  });

  const defaultValues = useMemo<LeaderFormSchema>(() => ({
    name: leader?.name ?? "",
    title: leader?.title ?? "",
    department: leader?.department ?? "",
    linkedinUrl: leader?.linkedinUrl ?? "",
    personaTone: leader?.personaTone ?? "",
    targetAudience: serializeAudience(leader?.targetAudience ?? {}),
    agentTemplateId: leader?.agentTemplateId ?? "",
    userId: existingUserId ?? "",
  }), [leader, existingUserId]);

  const form = useForm<LeaderFormSchema>({
    resolver: zodResolver(leaderSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        ...defaultValues,
        userId: existingUserId ?? "",
      });
    }
  }, [open, defaultValues, existingUserId, form]);

  const handleSubmit = async (values: LeaderFormSchema) => {
    const payload: LeaderInput = {
      name: values.name.trim(),
      title: values.title.trim(),
      department: values.department?.trim() ? values.department.trim() : null,
      linkedinUrl: values.linkedinUrl?.trim() ? values.linkedinUrl.trim() : null,
      personaTone: values.personaTone.trim(),
      targetAudience: parseAudience(values.targetAudience ?? ""),
      agentTemplateId: values.agentTemplateId?.trim() ? values.agentTemplateId.trim() : null,
      userId: values.userId?.trim() ? values.userId.trim() : null,
    };

    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leader ? "Edit Thought Leader" : "Add Thought Leader"}</DialogTitle>
          <DialogDescription>
            Configure the persona details, prompts, and targeting used for LinkedIn content generation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Shahed Islam" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="CEO, SJ Innovation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="Leadership" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="linkedinUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.linkedin.com/in/username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="personaTone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona Tone</FormLabel>
                  <FormControl>
                    <Input placeholder="Visionary, authentic, reflective" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetAudience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder='{"industry": "Tech CEOs", "region": "USA"}'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agentTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Agent Prompt</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agent prompt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="d7c6a3c7-c8d3-4130-971e-89bbabd88f92">CEO Agent (Shahed Style)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* User Account Link Section */}
            <div className="border-t pt-4 mt-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Link to User Account
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value === NO_USER_VALUE ? "" : value);
                      }} 
                      value={field.value || NO_USER_VALUE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user account (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_USER_VALUE}>No user linked</SelectItem>
                        {users.map((user) => {
                          const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName} ({user.email})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this leader to a user account so they can access their content profile.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {leader ? "Save changes" : "Create leader"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
