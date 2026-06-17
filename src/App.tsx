import React, { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import UserDashboard from "./pages/UserDashboard";
import PMDashboard from "./pages/PMDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import HubSpotImport from "@/pages/HubSpotImport";
import MyTasksIndex from "./pages/tasks/MyTasksIndex";
import TaskDetailPage from "./pages/tasks/TaskDetailPage";
import PMTaskDashboard from "./pages/tasks/PMTaskDashboard";
import EODSubmission from "./pages/EODSubmission";
import MyEODSubmissions from "./pages/MyEODSubmissions";
import AIWorkspace from "./pages/AIWorkspace";
import TeamManagement from "./pages/admin/TeamManagement";
import ClientsAndProjects from "./pages/ClientsAndProjects";
import ClientDetail from "./pages/ClientDetail";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectManagement from "./pages/ProjectManagement";
import ImportedProjectDetail from "./pages/ImportedProjectDetail";
import BrandManagement from "./pages/admin/BrandManagement";
import BrandDetail from "./pages/admin/BrandDetail";
import IntegrationManager from "./pages/admin/IntegrationManager";
import KPIConfigurator from "./pages/admin/KPIConfigurator";
import AdminSettings from "./pages/admin/AdminSettings";
import EODManagement from "./pages/admin/EODManagement";
import UserDetail from "./pages/admin/UserDetail";
import AdminPanel from "./pages/admin/AdminPanel";
import UserBrands from "./pages/UserBrands";
import MyAgentsPage from "./pages/my-agents";
import PeopleReviewDashboard from "./pages/PeopleReviewDashboard";
import UserProfile from "./pages/UserProfile";
import SubmitFeedbackPage from "./pages/SubmitFeedbackPage";
import MyFeedbackPage from "./pages/MyFeedbackPage";
import FeedbackAdminPage from "./pages/adminpanel/feedback/FeedbackAdminPage";
import WeeklyClientEmailSummary from "./pages/WeeklyClientEmailSummary";
import TestimonialsPage from "./pages/TestimonialsPage";
import TestimonialSubmitPage from "./pages/TestimonialSubmitPage";
import VisionPage from "./pages/VisionPage";

import AIControl from "./pages/adminpanel/ai-control";
import AdminAgentRunPage from "./pages/adminpanel/ai-control/AdminAgentRunPage";
import ReelHookConfig from "./pages/adminpanel/ReelHookConfig";
import UnifiedVideoStudioPage from "./pages/video/UnifiedVideoStudioPage";
import ImageAI from "./pages/ImageAI";
import LinkedInLeaderListPage from "./pages/content/LinkedInLeaderListPage";
import LinkedInLeaderDetailPage from "./pages/content/LinkedInLeaderDetailPage";
import LinkedInGeneratePostPage from "./pages/content/LinkedInGeneratePostPage";
import LinkedInGeneratePostResultPage from "./pages/content/LinkedInGeneratePostResultPage";
import ContentLibraryPage from "./pages/content/ContentLibraryPage";
import MyContentProfile from "./pages/content/MyContentProfile";
import LinkedInAgentConfig from "./pages/admin/LinkedInAgentConfig";
import KnowledgeBase from "./pages/adminpanel/knowledgebase/KnowledgeBase";
import BrandPublicPage from "./pages/brands/BrandPublicPage";
import BrandAgentPage from "./pages/brands/BrandAgentPage";
import BrandSEOWorkspace from "./pages/brands/BrandSEOWorkspace";
import BrandKnowledgeBase from "./pages/brands/BrandKnowledgeBase";
import BrandPublicSEOPage from "./pages/brands/[slug]/seo";
import BrandBlogGenerator from "./pages/brands/[slug]/build-your-ai";
import BrandKeywordResearch from "./pages/brands/[slug]/keyword-research";
import { GoogleDriveCallback } from "./pages/GoogleDriveCallback";
import StreamingChatTest from "./pages/admin/StreamingChatTest";
import NewsletterSources from "./pages/admin/NewsletterSources";
import NewsletterGenerator from "./pages/content/NewsletterGenerator";
import SEOBlogGenerator from "./pages/content/SEOBlogGenerator";
import SEOBlogResult from "./pages/content/SEOBlogResult";
import HeroSectionOptimizer from "./pages/content/HeroSectionOptimizer";
import HeroSectionResult from "./pages/content/HeroSectionResult";
import BrandHeroSectionOptimizer from "./pages/brands/[slug]/hero-section-optimizer";
import ReelHookGenerator from "./pages/content/ReelHookGenerator";
import ReelHookResult from "./pages/content/ReelHookResult";
import BrandReelHookGenerator from "./pages/brands/[slug]/reel-hook-generator";
import KnowledgeBrowsePage from "./pages/KnowledgeBrowsePage";
import SEOHubPage from "./features/seo-hub/pages/SEOHubPage";

// Hackathon Module
import HackathonOnboarding from "./pages/hackathon/HackathonOnboarding";
import HackathonDashboard from "./pages/hackathon/HackathonDashboard";
import TeamFormation from "./pages/hackathon/TeamFormation";
import SubmissionForm from "./pages/hackathon/SubmissionForm";
import JudgingPanel from "./pages/hackathon/JudgingPanel";
// Hackathon Admin
import EventManagement from "./pages/adminpanel/hackathon/EventManagement";
import EmployeeInvitation from "./pages/adminpanel/hackathon/EmployeeInvitation";

// Control Tower Module
import EmployeesPage from "./pages/adminpanel/control-tower/EmployeesPage";
import PodsPage from "./pages/adminpanel/control-tower/PodsPage";
import PodDetailPage from "./pages/adminpanel/control-tower/PodDetailPage";
import MeetingsPage from "./pages/adminpanel/control-tower/MeetingsPage";
import ActiveCollabSyncDashboard from "./pages/adminpanel/data-sync/ActiveCollabSyncDashboard";

// Quote Builder Module
import ServiceCatalogPage from "./pages/adminpanel/quotes/ServiceCatalogPage";

// Agent Builder Module
import AgentBuilderList from "./pages/adminpanel/agent-builder/AgentBuilderList";
import AgentBuilderStudio from "./pages/adminpanel/agent-builder/AgentBuilderStudio";
import AgentBuilderSettings from "./pages/adminpanel/agent-builder/AgentBuilderSettings";

// AI Agents (Workspace + Public)
import AIAgentsPage from "./pages/ai-agents";
import AgentPublicPage from "./pages/public/AgentPublicPage";
import ImageAnalyticsDashboard from "./pages/adminpanel/image-analytics/ImageAnalyticsDashboard";
import EstimateListPage from "./pages/quotes/EstimateListPage";
import EstimateBuilderPage from "./pages/quotes/EstimateBuilderPage";
import EstimateViewPage from "./pages/quotes/EstimateViewPage";

const ProjectKnowledgeBase = lazy(() => import("./pages/ProjectKnowledgeBase"));

const queryClient = new QueryClient();

// Lazy load Documentation
const Documentation = lazy(() => import("./pages/admin/Documentation"));
const AnalyticsIntegration = lazy(() => import("./pages/admin/AnalyticsIntegration"));

// Smart redirect component based on user role
function DashboardRedirect() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  
  // Content creators go to their content profile
  if (user.role === 'content_creator') {
    return <Navigate to="/content/my-profile" replace />;
  }
  
  // Super admin goes to admin panel, everyone else to main dashboard
  if (user.role === 'super_admin') {
    return <Navigate to="/adminpanel" replace />;
  }
  
  return <Navigate to="/" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/google-drive-callback" element={<GoogleDriveCallback />} />
            <Route path="/testimonial/submit/:token" element={<TestimonialSubmitPage />} />
            {/* Public agent runner — no auth required */}
            <Route path="/public/agents/:publicToken" element={<AgentPublicPage />} />
            
            {/* Redirect /dashboard to appropriate location */}
            <Route path="/dashboard" element={<DashboardRedirect />} />
            
            {/* Authenticated User Routes (Base: /) */}
            <Route path="/" element={
              <ProtectedRoute requiredMinimumRole="user">
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Index />} />
              <Route path="my-profile" element={<UserProfile />} />
              <Route path="workspace" element={<AIWorkspace />} />
              <Route path="image-ai" element={<ImageAI />} />
              <Route path="reports" element={<Reports />} />
              <Route path="seo-hub" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <SEOHubPage />
                </ProtectedRoute>
              } />
              <Route path="knowledge" element={<KnowledgeBrowsePage />} />
              <Route path="brands" element={<UserBrands />} />
              <Route path="brands/:slug" element={<BrandPublicPage />} />
              {/* Specific brand routes MUST come before the generic :agentSlug route */}
              <Route path="brands/:slug/seo" element={<BrandPublicSEOPage />} />
              <Route path="brands/:slug/seo/workspace" element={<BrandSEOWorkspace />} />
              <Route path="brands/:slug/build-your-ai" element={<BrandBlogGenerator />} />
              <Route path="brands/:slug/hero-section-optimizer" element={<BrandHeroSectionOptimizer />} />
              <Route path="brands/:slug/reel-hook-generator" element={<BrandReelHookGenerator />} />
              <Route path="brands/:slug/keyword-research" element={<BrandKeywordResearch />} />
              {/* Generic catch-all route for other agents - MUST be last */}
              <Route path="brands/:slug/:agentSlug" element={<BrandAgentPage />} />
              <Route path="brands/:brandId/knowledge" element={<BrandKnowledgeBase />} />
              <Route path="clients" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <ClientsAndProjects />
                </ProtectedRoute>
              } />
              <Route path="clients/:slug" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <ClientDetail />
                </ProtectedRoute>
              } />
              <Route path="projects" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <ProjectManagement />
                </ProtectedRoute>
              } />
              <Route path="projects/:slug/details" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <ImportedProjectDetail />
                </ProtectedRoute>
              } />
              <Route path="projects/:slug" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <ProjectDetail />
                </ProtectedRoute>
              } />
              <Route path="projects/:slug/knowledge" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <React.Suspense fallback={<div>Loading...</div>}>
                    <ProjectKnowledgeBase />
                  </React.Suspense>
                </ProtectedRoute>
              } />
              <Route path="content/library" element={<ContentLibraryPage />} />
              <Route path="content/my-profile" element={<MyContentProfile />} />
              <Route path="newsletter" element={<NewsletterGenerator />} />
              {/* New standalone SEO Blog Generator route */}
              <Route path="seo-blog-generator" element={<SEOBlogGenerator />} />
              <Route path="content/seo-blog/:blogId" element={<SEOBlogResult />} />
              {/* Hero Section Optimizer routes */}
              <Route path="content/hero-section-optimizer" element={<HeroSectionOptimizer />} />
              <Route path="content/hero-section/:heroId" element={<HeroSectionResult />} />
              <Route path="content/linkedin" element={<LinkedInLeaderListPage />} />
              <Route path="content/linkedin/:leaderSlug" element={<LinkedInLeaderDetailPage />} />
              <Route path="content/linkedin/:leaderSlug/generate" element={<LinkedInGeneratePostPage />} />
              <Route path="content/linkedin/:leaderSlug/generate/result" element={<LinkedInGeneratePostResultPage />} />
              <Route path="tasks" element={<MyTasksIndex />} />
              <Route path="tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="tasks/team-dashboard" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <PMTaskDashboard />
                </ProtectedRoute>
              } />

              {/* Quote Builder Routes - All Authenticated Users */}
              <Route path="quotes" element={<EstimateListPage />} />
              <Route path="quotes/new" element={<EstimateBuilderPage />} />
              <Route path="quotes/:id" element={<EstimateViewPage />} />
              <Route path="quotes/:id/edit" element={<EstimateBuilderPage />} />
              <Route path="eod-submission" element={<EODSubmission />} />
              <Route path="my-eod-submissions" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <MyEODSubmissions />
                </ProtectedRoute>
              } />
              <Route path="my-agents" element={<MyAgentsPage />} />
              <Route path="ai-agents" element={<AIAgentsPage />} />
              <Route path="weekly-client-email-summary" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <WeeklyClientEmailSummary />
                </ProtectedRoute>
              } />
              <Route path="feedback/submit" element={<SubmitFeedbackPage />} />
              <Route path="feedback/history" element={<MyFeedbackPage />} />
              <Route path="vision" element={<VisionPage />} />
              <Route path="hubspot-import" element={<HubSpotImport />} />
              <Route path="testimonials" element={
                <ProtectedRoute requiredMinimumRole="pm">
                  <TestimonialsPage />
                </ProtectedRoute>
              } />

              {/* Hackathon Routes - Participant Facing */}
              <Route path="hackathon/onboard" element={<HackathonOnboarding />} />
              <Route path="hackathon/dashboard" element={<HackathonDashboard />} />
              <Route path="hackathon/teams" element={<TeamFormation />} />
              <Route path="hackathon/submission" element={<SubmissionForm />} />
              <Route path="hackathon/judging" element={<JudgingPanel />} />
            </Route>

            {/* Admin Panel Routes - Super Admin Only */}
            <Route path="/adminpanel/*" element={
              <ProtectedRoute requiredMinimumRole="manager">
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route
                index
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="brands"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <BrandManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="brands/:brandId"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <BrandDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="team"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <TeamManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="team/:userId"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <UserDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="eod-review"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <PeopleReviewDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="integrations"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <IntegrationManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="integrations/analytics"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <React.Suspense fallback={<div>Loading...</div>}>
                      <AnalyticsIntegration />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="kpis"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <KPIConfigurator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="documentation"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <React.Suspense fallback={<div>Loading...</div>}>
                      <Documentation />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="newsletter-sources"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <NewsletterSources />
                  </ProtectedRoute>
                }
              />
              <Route
                path="eod-management"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <EODManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-control"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AIControl />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-control/run/linkedin-content-gen/:leaderSlug"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AdminAgentRunPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-control/run/:agentSlug"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AdminAgentRunPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-control/streaming-test"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <StreamingChatTest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-control/reel-hook-config"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <ReelHookConfig />
                  </ProtectedRoute>
                }
              />
              <Route
                path="linkedin-agent-config"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <LinkedInAgentConfig />
                  </ProtectedRoute>
                }
              />
              <Route
                path="knowledgebase"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <KnowledgeBase />
                  </ProtectedRoute>
                }
              />
              <Route
                path="feedback"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <FeedbackAdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Image Analytics Route */}
              <Route
                path="image-analytics"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <ImageAnalyticsDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Data Sync Routes */}
              <Route
                path="data-sync/activecollab"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <ActiveCollabSyncDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Hackathon Admin Routes */}
              <Route
                path="hackathon/events"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <EventManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="hackathon/invite"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <EmployeeInvitation />
                  </ProtectedRoute>
                }
              />

              {/* Control Tower Routes */}
              <Route
                path="control-tower/employees"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="control-tower/pods"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <PodsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="control-tower/pods/:id"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <PodDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="control-tower/meetings"
                element={
                  <ProtectedRoute requiredMinimumRole="manager">
                    <MeetingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Quote Builder Admin Routes */}
              <Route
                path="quotes/services"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <ServiceCatalogPage />
                  </ProtectedRoute>
                }
              />

              {/* Agent Builder Routes */}
              <Route
                path="agent-builder"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AgentBuilderList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="agent-builder/new"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AgentBuilderStudio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="agent-builder/settings"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AgentBuilderSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="agent-builder/:agentId"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <AgentBuilderStudio />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
