import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  HackathonEvent, 
  HackathonParticipant,
  HackathonTeam,
  HackathonSubmission 
} from "@/types/hackathon";

// Fetch all events
export const useHackathonEvents = () => {
  return useQuery({
    queryKey: ["hackathon-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hackathon_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown) as HackathonEvent[];
    },
  });
};

// Fetch single event
export const useHackathonEvent = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ["hackathon-event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      
      const { data, error } = await supabase
        .from("hackathon_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return (data as unknown) as HackathonEvent;
    },
    enabled: !!eventId,
  });
};

// Fetch participant data
export const useParticipant = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ["hackathon-participant", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("hackathon_participants")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return (data as unknown) as HackathonParticipant | null;
    },
    enabled: !!eventId,
  });
};

// Fetch teams for an event
export const useEventTeams = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ["event-teams", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from("hackathon_teams")
        .select(`
          *,
          captain:hackathon_participants!hackathon_teams_captain_id_fkey(
            id,
            employee:employees(first_name, last_name, email)
          ),
          team_members:hackathon_team_members(
            id,
            participant:hackathon_participants(
              id,
              employee:employees(first_name, last_name, email)
            )
          )
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!eventId,
  });
};

// Fetch all teams (no event filter) - simple structure
export const useAllTeams = () => {
  return useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teams")
        .select(`
          *,
          members:team_members(
            id,
            is_captain,
            employee:employees(id, first_name, last_name, email, title)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
};

// Create team (simple - no event required)
export const useCreateTeamSimple = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      teamName: string;
      description: string;
      memberIds: string[]; // employee IDs
    }) => {
      // Create team
      const { data: team, error: teamError } = await (supabase as any)
        .from("teams")
        .insert({
          team_name: data.teamName,
          description: data.description,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add members
      if (data.memberIds.length > 0) {
        const memberInserts = data.memberIds.map((employeeId, index) => ({
          team_id: team.id,
          employee_id: employeeId,
          is_captain: index === 0, // First member is captain
        }));

        const { error: membersError } = await (supabase as any)
          .from("team_members")
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-teams"] });
      toast.success("Team created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create team: " + error.message);
    },
  });
};

// Register participant
export const useRegisterParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      skills: string[];
      interests: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get employee mapping
      const { data: mapping } = await supabase
        .from("employee_user_mapping")
        .select("employee_id")
        .eq("user_id", user.id)
        .single();

      if (!mapping) throw new Error("Employee mapping not found");

      const { error } = await (supabase as any)
        .from("hackathon_participants")
        .update({
          status: "registered",
          registered_at: new Date().toISOString(),
          onboarding_completed: true,
          skills: data.skills,
          interests: data.interests,
        })
        .eq("event_id", data.eventId)
        .eq("employee_id", mapping.employee_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-participant", variables.eventId] });
      toast.success("Registration complete!");
    },
    onError: (error) => {
      toast.error("Registration failed: " + error.message);
    },
  });
};

// Create team (legacy - requires participant)
export const useCreateTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      teamName: string;
      description: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get participant ID
      const { data: participant } = await supabase
        .from("hackathon_participants")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("user_id", user.id)
        .single();

      if (!participant) throw new Error("Participant not found");

      // Create team
      const { data: team, error: teamError } = await supabase
        .from("hackathon_teams")
        .insert({
          event_id: data.eventId,
          team_name: data.teamName,
          description: data.description,
          captain_id: participant.id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add captain as team member
      const { error: memberError } = await supabase
        .from("hackathon_team_members")
        .insert({
          team_id: team.id,
          participant_id: participant.id,
          role: "captain",
        });

      if (memberError) throw memberError;

      return team;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event-teams", variables.eventId] });
      toast.success("Team created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create team: " + error.message);
    },
  });
};

// Create team with members (simple - directly adds employees as members)
export const useCreateTeamWithMembers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      teamName: string;
      description: string;
      memberIds: string[]; // employee IDs
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Helper to get or create participant
      const getOrCreateParticipant = async (employeeId: string): Promise<string> => {
        const { data: existing } = await supabase
          .from("hackathon_participants")
          .select("id")
          .eq("event_id", data.eventId)
          .eq("employee_id", employeeId)
          .single();

        if (existing) return existing.id;

        const { data: newParticipant, error } = await supabase
          .from("hackathon_participants")
          .insert({
            event_id: data.eventId,
            employee_id: employeeId,
            user_id: user.id,
            status: "registered",
            registered_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error) throw error;
        return newParticipant.id;
      };

      // Need at least one member to be captain
      if (data.memberIds.length === 0) {
        throw new Error("Please select at least one team member");
      }

      // Create captain first
      const captainId = await getOrCreateParticipant(data.memberIds[0]);

      // Create team with captain
      const { data: team, error: teamError } = await supabase
        .from("hackathon_teams")
        .insert({
          event_id: data.eventId,
          team_name: data.teamName,
          description: data.description,
          captain_id: captainId,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add captain as team member
      await supabase.from("hackathon_team_members").insert({
        team_id: team.id,
        participant_id: captainId,
        role: "captain",
      });

      // Add remaining members
      for (let i = 1; i < data.memberIds.length; i++) {
        const participantId = await getOrCreateParticipant(data.memberIds[i]);
        await supabase.from("hackathon_team_members").insert({
          team_id: team.id,
          participant_id: participantId,
          role: "member",
        });
      }

      return team;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event-teams", variables.eventId] });
      toast.success("Team created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create team: " + error.message);
    },
  });
};

// Join as participant (self-registration)
export const useJoinAsParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { eventId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user has an employee mapping
      const { data: mapping } = await supabase
        .from("employee_user_mapping")
        .select("employee_id")
        .eq("user_id", user.id)
        .single();

      // If no mapping exists, we'll create a participant directly with user_id
      const participantData: any = {
        event_id: data.eventId,
        user_id: user.id,
        status: "registered",
        registered_at: new Date().toISOString(),
        onboarding_completed: true,
      };

      // Add employee_id if mapping exists
      if (mapping) {
        participantData.employee_id = mapping.employee_id;
      } else {
        // Use user.id as a placeholder for employee_id if no mapping
        participantData.employee_id = user.id;
      }

      const { error } = await supabase
        .from("hackathon_participants")
        .insert(participantData);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-participant", variables.eventId] });
      toast.success("You've joined the hackathon!");
    },
    onError: (error) => {
      toast.error("Failed to join: " + error.message);
    },
  });
};

// Join an existing team
export const useJoinTeam = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { teamId: string; eventId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get participant ID
      const { data: participant } = await supabase
        .from("hackathon_participants")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("user_id", user.id)
        .single();

      if (!participant) throw new Error("You must be a participant first");

      // Check if already on a team
      const { data: existingMember } = await supabase
        .from("hackathon_team_members")
        .select("id")
        .eq("participant_id", participant.id)
        .single();

      if (existingMember) throw new Error("You're already on a team");

      // Join the team
      const { error } = await supabase
        .from("hackathon_team_members")
        .insert({
          team_id: data.teamId,
          participant_id: participant.id,
          role: "member",
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event-teams", variables.eventId] });
      toast.success("You've joined the team!");
    },
    onError: (error) => {
      toast.error("Failed to join team: " + error.message);
    },
  });
};

// Submit project
export const useSubmitProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      teamId: string;
      projectTitle: string;
      description: string;
      demoVideoUrl?: string;
      githubUrl?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: participant } = await supabase
        .from("hackathon_participants")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("user_id", user.id)
        .single();

      if (!participant) throw new Error("Participant not found");

      const { error } = await (supabase as any)
        .from("hackathon_submissions")
        .upsert({
          event_id: data.eventId,
          team_id: data.teamId,
          project_title: data.projectTitle,
          description: data.description,
          demo_video_url: data.demoVideoUrl,
          github_url: data.githubUrl,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: participant.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-submissions"] });
      toast.success("Project submitted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to submit project: " + error.message);
    },
  });
};
