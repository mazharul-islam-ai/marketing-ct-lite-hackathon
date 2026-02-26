import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  Trophy, 
  Users, 
  Rocket, 
  ClipboardCheck, 
  Gavel, 
  Settings,
  UserPlus,
  Calendar,
  ArrowRight
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";

export const HackathonBrandTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "super_admin";

  // Fetch active hackathon events
  const { data: activeEvents, isLoading } = useQuery({
    queryKey: ["active-hackathon-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hackathon_events")
        .select("*")
        .in("status", ["upcoming", "active", "judging"])
        .order("start_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const participantActions = [
    {
      title: "Onboarding",
      description: "Complete your hackathon profile and get started",
      icon: Rocket,
      href: "/hackathon/onboard",
      variant: "default" as const,
    },
    {
      title: "My Dashboard",
      description: "View your hackathon participation status",
      icon: Trophy,
      href: "/hackathon/dashboard",
      variant: "outline" as const,
    },
    {
      title: "Teams",
      description: "Form or join a team for the hackathon",
      icon: Users,
      href: "/hackathon/teams",
      variant: "outline" as const,
    },
    {
      title: "Submit Project",
      description: "Submit your hackathon project for review",
      icon: ClipboardCheck,
      href: "/hackathon/submission",
      variant: "outline" as const,
    },
    {
      title: "Judging",
      description: "View judging criteria and results",
      icon: Gavel,
      href: "/hackathon/judging",
      variant: "outline" as const,
    },
  ];

  const adminActions = [
    {
      title: "Event Management",
      description: "Create and manage hackathon events",
      icon: Settings,
      href: "/adminpanel/hackathon/events",
    },
    {
      title: "Invite Employees",
      description: "Send invitations to employees",
      icon: UserPlus,
      href: "/adminpanel/hackathon/invite",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success text-success-foreground">Active</Badge>;
      case "upcoming":
        return <Badge variant="secondary">Upcoming</Badge>;
      case "judging":
        return <Badge className="bg-warning text-warning-foreground">Judging</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Events Section */}
      {activeEvents && activeEvents.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Active Hackathon Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-card border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{(event as any).title || event.name}</h4>
                      {getStatusBadge(event.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_date), "MMM d, yyyy")} -{" "}
                      {format(new Date(event.end_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/hackathon/dashboard")}
                  >
                    View <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participant Actions */}
      <Accordion type="single" collapsible defaultValue="participant">
        <AccordionItem value="participant" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">Participant Hub</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {participantActions.map((action) => (
                <Card
                  key={action.title}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                  onClick={() => navigate(action.href)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <action.icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{action.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Admin Actions - Only for super_admin */}
        {isSuperAdmin && (
          <AccordionItem value="admin" className="border rounded-lg mt-4">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-destructive" />
                <span className="font-semibold">Admin Controls</span>
                <Badge variant="destructive" className="ml-2 text-xs">
                  Super Admin
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {adminActions.map((action) => (
                  <Card
                    key={action.title}
                    className="cursor-pointer hover:shadow-md transition-all hover:border-destructive/50 border-destructive/20"
                    onClick={() => navigate(action.href)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-destructive/10">
                          <action.icon className="h-5 w-5 text-destructive" />
                        </div>
                        <CardTitle className="text-base">{action.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{action.description}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Empty state when no active events */}
      {!isLoading && (!activeEvents || activeEvents.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Active Hackathons</h3>
            <p className="text-sm text-muted-foreground mb-4">
              There are no active hackathon events at the moment. Check back later!
            </p>
            {isSuperAdmin && (
              <Button onClick={() => navigate("/adminpanel/hackathon/events")}>
                Create New Event
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HackathonBrandTab;
