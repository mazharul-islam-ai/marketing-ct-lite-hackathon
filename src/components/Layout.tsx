import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  Users,
  Menu,
  X,
  FolderOpen,
  Building2,
  Target,
  Shield,
  Sparkles,
  Video,
  History,
  Calendar,
  ImageIcon,
  MessageSquare,
  MessageSquareQuote,
  Bug,
  Mail,
  FileText,
  Eye,
  BookOpen,
  Calculator,
  UsersRound,
  Search,
  Bot,
} from "lucide-react";
import { useState } from "react";
import ProfileDropdown from "./ProfileDropdown";
import FeedbackButton from "./FeedbackButton";
import logo from "@/assets/logo-sji.png";

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  current: boolean;
  isHeader?: boolean;
  isAdmin?: boolean;
  isI420?: boolean;
  subItems?: NavigationItem[];
  minRole?: 'user' | 'pm' | 'manager' | 'super_admin';
}

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentRole = user?.role || 'user';

  // Role hierarchy for permission checks
  const roleHierarchy: Record<string, number> = {
    user: 1,
    content_creator: 2,
    marketing: 2,
    pm: 3,
    manager: 4,
    super_admin: 5,
  };

  // Check if user can view item based on minRole
  const canViewItem = (item: NavigationItem): boolean => {
    if (!item.minRole) return true;
    const userLevel = roleHierarchy[currentRole] || 0;
    const requiredLevel = roleHierarchy[item.minRole] || 0;
    return userLevel >= requiredLevel;
  };

  // Get navigation - organized into logical groups
  const getNavigation = (role: string): NavigationItem[] => {
    const navigation: NavigationItem[] = [];

    // 1. WORKSPACE - Daily quick-access working area
    navigation.push(
      { name: "WORKSPACE", href: "", icon: null, current: false, isHeader: true },
      { name: "Dashboard", href: "/", icon: LayoutDashboard, current: false }
    );

    // Add Actions & Tasks for all authenticated users
    // RLS policies handle actual data access control
    navigation.push({
      name: "Actions & Tasks",
      href: "/tasks",
      icon: CheckSquare,
      current: false,
      subItems: [
        { name: "My Tasks", href: "/tasks", icon: CheckSquare, current: false },
        { name: "Team Dashboard", href: "/tasks/team-dashboard", icon: UsersRound, current: false, minRole: 'pm' },
        { name: "Submit EOD", href: "/eod-submission", icon: Calendar, current: false },
        { name: "My EOD History", href: "/my-eod-submissions", icon: History, current: false, minRole: 'pm' },
      ]
    });

    // 2. AI TOOLS - All creation tools grouped by media format
    navigation.push(
      { name: "SEPARATOR", href: "", icon: null, current: false, isHeader: true },
      { name: "AI TOOLS", href: "", icon: null, current: false, isHeader: true },
      { name: "Video AI", href: "/workspace", icon: Video, current: false },
      { name: "Image AI", href: "/image-ai", icon: ImageIcon, current: false }
    );

    // Add Post Generation for PM and above
    if (['pm', 'manager', 'super_admin'].includes(role)) {
      navigation.push({
        name: "Post Generation",
        href: "/content/linkedin",
        icon: FileText,
        current: false
      });
    }

    // 3. PROJECTS & TEAMS - Collaboration and project oversight
    navigation.push(
      { name: "SEPARATOR", href: "", icon: null, current: false, isHeader: true },
      { name: "PROJECTS & TEAMS", href: "", icon: null, current: false, isHeader: true }
    );

    // Add Projects, Clients, and Quotes for PM and above
    if (['pm', 'manager', 'super_admin'].includes(role)) {
      navigation.push(
        { name: "Projects", href: "/projects", icon: Target, current: false, minRole: 'pm' },
        { name: "Clients", href: "/clients", icon: FolderOpen, current: false, minRole: 'pm' },
        { name: "Quotes", href: "/quotes", icon: Calculator, current: false, minRole: 'pm' }
      );
    }

    // AI Agents for all authenticated users
    navigation.push(
      { name: "AI Agents", href: "/ai-agents", icon: Bot, current: false }
    );

    // Add Brands for all users
    navigation.push(
      { name: "Brands", href: "/brands", icon: Building2, current: false },
      { name: "Knowledge Base", href: "/knowledge", icon: BookOpen, current: false }
    );

    // 4. MARKETING - Growth and testimonial workflows
    if (['pm', 'manager', 'super_admin'].includes(role)) {
      navigation.push(
        { name: "SEPARATOR", href: "", icon: null, current: false, isHeader: true },
        { name: "MARKETING", href: "", icon: null, current: false, isHeader: true },
        { name: "Testimonials", href: "/testimonials", icon: MessageSquareQuote, current: false, minRole: 'pm' },
        { name: "SEO Hub", href: "/seo-hub", icon: Search, current: false, minRole: 'pm' }
      );
    }

    // 5. SUPPORT & FEEDBACK - User support section
    navigation.push(
      { name: "SEPARATOR", href: "", icon: null, current: false, isHeader: true },
      { name: "SUPPORT & FEEDBACK", href: "", icon: null, current: false, isHeader: true },
      { name: "Bugs/Feedback", href: "/feedback/history", icon: MessageSquare, current: false },
      { name: "Vision", href: "/vision", icon: Eye, current: false }
    );

    // Add Send Weekly Email for PM and above
    if (['pm', 'manager', 'super_admin'].includes(role)) {
      navigation.push(
        { name: "Send Weekly Email", href: "/weekly-client-email-summary", icon: Mail, current: false, minRole: 'pm' }
      );
    }

    // Super admin only — i420 Studio + Admin Panel
    if (role === 'super_admin') {
      navigation.push(
        { name: "SEPARATOR", href: "", icon: null, current: false, isHeader: true },
        { name: "i420 Studio", href: "/i420", icon: Sparkles, current: false, isI420: true },
        { name: "Admin Panel", href: "/adminpanel", icon: Shield, current: false, isAdmin: true }
      );
    }

    return navigation;
  };

  const navigation = getNavigation(currentRole);

  const isLinkedInGenerateRoute = location.pathname.includes('/content/linkedin/') && location.pathname.endsWith('/generate');
  const isFullWidthRoute = location.pathname === '/image-ai' || location.pathname === '/workspace';

  if (isLinkedInGenerateRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card/95 backdrop-blur-sm border-r border-border
        transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        transition-transform duration-300 ease-in-out lg:translate-x-0
      `}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-auto items-center justify-center px-6 py-4 border-b border-border">
            <div className="flex flex-col items-center gap-2">
              <img src={logo} alt="SJ Innovation" className="h-20 w-auto" />
              <p className="text-[18px] font-bold text-foreground tracking-tight">Marketing Hub</p>
              <p className="text-xs text-muted-foreground capitalize">{currentRole.replace('_', ' ')} Dashboard</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {navigation.map((item, index) => {
              // Handle separator
              if (item.name === "SEPARATOR") {
                return (
                  <div key={`separator-${index}`} className="my-4">
                    <div className="border-t border-border/50"></div>
                  </div>
                );
              }

              // Handle header items (non-clickable)
              if (item.isHeader) {
                return (
                  <div key={item.name} className="flex items-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.icon && <item.icon className="mr-3 h-4 w-4" />}
                    {item.name}
                  </div>
                );
              }

              // Handle items with sub-navigation
              if (item.subItems && item.subItems.length > 0) {
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.name}
                    </div>
                    {item.subItems
                      .filter(canViewItem)
                      .map((subItem) => {
                        const isSubActive = location.pathname === subItem.href;
                        return (
                          <NavLink
                            key={subItem.name}
                            to={subItem.href}
                            className={`
                              flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-smooth
                              ${isSubActive
                                ? 'bg-gradient-primary text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                              }
                            `}
                          >
                            <subItem.icon className="mr-3 h-4 w-4" />
                            {subItem.name}
                          </NavLink>
                        );
                      })}
                  </div>
                );
              }

              // Special styling for i420 Studio, Admin Panel, and Vision
              const isAdminPanel = item.isAdmin;
              const isI420Studio = item.isI420;
              const isVision = item.name === "Vision";

              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) => `
                    flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-smooth
                    ${isActive
                      ? isAdminPanel
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25'
                        : isI420Studio
                          ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                          : isVision
                            ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/30 animate-pulse'
                            : 'bg-gradient-primary text-white shadow-md'
                      : isAdminPanel
                        ? 'text-red-500 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-orange-500 hover:shadow-md hover:shadow-red-500/25 border border-red-200 dark:border-red-800'
                        : isI420Studio
                          ? 'text-indigo-600 hover:text-white hover:bg-gradient-to-r hover:from-indigo-500 hover:to-violet-500 hover:shadow-md hover:shadow-indigo-500/25 border border-indigo-200 dark:border-indigo-800'
                          : isVision
                            ? 'bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-300 dark:border-fuchsia-700 hover:from-violet-500 hover:via-fuchsia-500 hover:to-pink-500 hover:text-white hover:shadow-lg hover:shadow-fuchsia-500/30 hover:border-transparent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }
                  `}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isAdminPanel && !location.pathname.includes(item.href) ? 'text-red-500' : ''} ${isI420Studio && !location.pathname.startsWith(item.href) ? 'text-indigo-500' : ''} ${isVision && !location.pathname.includes(item.href) ? 'text-fuchsia-500' : ''}`} />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 border-t border-border">
            <ProfileDropdown />
          </div>
        </div>

        {/* Mobile close button */}
        <button
          className="absolute top-4 right-4 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-6 w-6 text-muted-foreground" />
        </button>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center gap-x-4 border-b border-border bg-card/95 backdrop-blur-sm px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-muted-foreground" />
          </button>

          <div className="flex flex-1 items-center">
            <h2 className="text-lg font-semibold text-foreground">
              {navigation.find(item => location.pathname === item.href)?.name || 'Dashboard'}
            </h2>
          </div>
        </div>

        {/* Page content */}
        <main className={isFullWidthRoute ? "py-4" : "py-6"}>
          <div className={isFullWidthRoute ? "px-4" : "w-full px-4 sm:px-6 lg:px-8"}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Feedback Button */}
      <FeedbackButton />
    </div>
  );
};

export default Layout;
