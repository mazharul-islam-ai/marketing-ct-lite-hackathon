import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  Users,
  Plug,
  Settings,
  Menu,
  X,
  LogOut,
  Bot,
  ArrowLeft,
  Home,
  UserCheck,
  TrendingUp,
  Calendar,
  Database,
  MessageSquare,
  Package,
  Key,
  RefreshCw,
  Mail,
  Video,
  Calculator,
  ImageIcon,
  Workflow,
  Zap,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-sji.png";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebarProvider, useAdminSidebar } from "@/contexts/AdminSidebarContext";

type UserRole = "super_admin" | "manager" | "pm" | "content_creator" | "marketing" | "user";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  isExternal?: boolean;
  minRole?: "manager" | "super_admin";
}

const baseNavigation: Array<{ section: string; items: NavigationItem[] }> = [
  {
    section: "Quick Access",
    items: [{ name: "Back to Dashboard", href: "/", icon: ArrowLeft, isExternal: true }],
  },
  {
    section: "Administration",
    items: [
      { name: "Admin Panel", href: "/adminpanel", icon: Home, exact: true, minRole: "super_admin" },
      { name: "Feedback Moderation", href: "/adminpanel/feedback", icon: MessageSquare, minRole: "manager" },
      { name: "Team Management", href: "/adminpanel/team", icon: Users, minRole: "super_admin" },
      { name: "Brand Management", href: "/adminpanel/brands", icon: Building2, minRole: "super_admin" },
      { name: "KPI Configuration", href: "/adminpanel/kpis", icon: TrendingUp, minRole: "super_admin" },
      { name: "EOD Review", href: "/adminpanel/eod-review", icon: Calendar, minRole: "super_admin" },
      { name: "EOD Management", href: "/adminpanel/eod-management", icon: UserCheck, minRole: "super_admin" },
      { name: "Newsletter Sources", href: "/adminpanel/newsletter-sources", icon: Mail, minRole: "manager" },
      { name: "System Settings", href: "/adminpanel/settings", icon: Settings, minRole: "super_admin" },
    ],
  },
  {
    section: "Control Tower",
    items: [
      { name: "Employees", href: "/adminpanel/control-tower/employees", icon: Users, minRole: "manager" },
      { name: "PODs & Teams", href: "/adminpanel/control-tower/pods", icon: Package, minRole: "manager" },
      { name: "Meetings", href: "/adminpanel/control-tower/meetings", icon: Video, minRole: "manager" },
      { name: "API Keys", href: "/adminpanel/control-tower/api-keys", icon: Key, minRole: "super_admin" },
    ],
  },
  {
    section: "Automations",
    items: [
      { name: "All Automations", href: "/i420/automations", icon: Workflow, minRole: "super_admin" },
      { name: "Automation Logs", href: "/i420/automations/logs", icon: Zap, minRole: "super_admin" },
    ],
  },
  {
    section: "Integrations & AI",
    items: [
      { name: "Integrations Hub", href: "/adminpanel/integrations", icon: Plug, minRole: "super_admin" },
      { name: "AI Control", href: "/adminpanel/ai-control", icon: Bot, minRole: "super_admin" },
      { name: "i420 Studio", href: "/i420", icon: Bot, minRole: "super_admin" },
      { name: "Image Analytics", href: "/adminpanel/image-analytics", icon: ImageIcon, minRole: "manager" },
      { name: "Knowledge Base", href: "/adminpanel/knowledgebase", icon: Database, minRole: "super_admin" },
    ],
  },
  {
    section: "Data Sync",
    items: [
      { name: "ActiveCollab Sync", href: "/adminpanel/data-sync/activecollab", icon: RefreshCw, minRole: "manager" },
    ],
  },
  {
    section: "Sales Tools",
    items: [
      { name: "Service Catalog", href: "/adminpanel/quotes/services", icon: Calculator, minRole: "super_admin" },
    ],
  },
];

const AdminLayoutContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed, toggle, collapse } = useAdminSidebar();
  const location = useLocation();
  const { user, logout } = useAuth();

  const currentRole: UserRole = user?.role ?? "user";

  const roleHierarchy: Record<UserRole, number> = {
    user: 1,
    content_creator: 2,
    marketing: 2,
    pm: 3,
    manager: 4,
    super_admin: 5,
  };

  const formatRoleLabel = (role: UserRole) =>
    role
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2)
    : "AD";

  const canViewItem = (item: NavigationItem) => {
    if (!item.minRole) return true;
    return roleHierarchy[currentRole] >= roleHierarchy[item.minRole];
  };

  const navigation = baseNavigation
    .map((section) => ({
      section: section.section,
      items: section.items.filter(canViewItem),
    }))
    .filter((section) => section.items.length > 0);

  const isActiveRoute = (href: string, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r border-border transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        !isCollapsed && "lg:translate-x-0",
        isCollapsed && "lg:-translate-x-full",
      )}>
        <div className="flex h-full flex-col">
          {/* Logo — compact header */}
          <div className="relative flex h-auto items-center gap-3 px-4 py-3 border-b border-border">
            <img src={logo} alt="SJ Innovation" className="h-10 w-auto shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">Marketing Hub</p>
              <p className="text-xs text-muted-foreground leading-tight">
                Admin Panel · {formatRoleLabel(currentRole)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex h-8 w-8 shrink-0"
              onClick={collapse}
              title="Hide navigation"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden absolute top-3 right-3 h-8 w-8"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-4 px-4 py-6">
            {navigation.map((section) => (
              <div key={section.section}>
                <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.section}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = !item.isExternal && isActiveRoute(item.href, item.exact);
                    
                    if (item.isExternal) {
                      return (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          className={cn(
                            "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                            item.name === 'Back to Dashboard'
                              ? "bg-success text-success-foreground hover:bg-success/90"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon
                            className={cn(
                              "mr-3 h-5 w-5 flex-shrink-0",
                              item.name === 'Back to Dashboard'
                                ? "text-success-foreground"
                                : "text-muted-foreground"
                            )}
                          />
                          {item.name}
                        </NavLink>
                      );
                    }
                    
                    return (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={cn(
                          "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon
                          className={cn(
                            "mr-3 h-5 w-5 flex-shrink-0",
                            isActive ? "text-primary-foreground" : "text-muted-foreground"
                          )}
                        />
                        {item.name}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-sm font-medium">{userInitials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{user?.name ?? "Admin"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? "admin@sjinnovation.com"}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" title="Logout" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn("lg:pl-64 transition-[padding] duration-300", isCollapsed && "lg:pl-0")}>
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex h-8 w-8 shrink-0"
                  onClick={toggle}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isCollapsed ? "Show navigation" : "Hide navigation"}
              </TooltipContent>
            </Tooltip>

            <h1 className="text-xl font-semibold text-foreground truncate hidden lg:block">
              Marketing Intelligence Dashboard - Administration
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <NavLink to="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </NavLink>
            </Button>
            <Button variant="ghost" size="sm" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AdminLayout = () => (
  <AdminSidebarProvider>
    <AdminLayoutContent />
  </AdminSidebarProvider>
);

export default AdminLayout;