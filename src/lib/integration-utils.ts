import { Brain, HardDrive, BarChart3, Briefcase, Users, Video, Mail, type LucideIcon } from "lucide-react";

export interface IntegrationCategory {
  slug: string;
  name: string;
  icon: LucideIcon;
  display_order: number;
}

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  { slug: "ai", name: "AI & Intelligence", icon: Brain, display_order: 1 },
  { slug: "meetings", name: "Meeting & Collaboration", icon: Video, display_order: 2 },
  { slug: "storage", name: "Storage", icon: HardDrive, display_order: 3 },
  { slug: "crm", name: "CRM", icon: Users, display_order: 4 },
  { slug: "email", name: "Email Delivery", icon: Mail, display_order: 5 },
  { slug: "analytics", name: "Analytics", icon: BarChart3, display_order: 6 },
  { slug: "project-management", name: "Project Management", icon: Briefcase, display_order: 7 },
];

export function getComplexityColor(complexity: string): string {
  switch (complexity) {
    case "easy":
      return "bg-success text-success-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "complex":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
