import type { SEOSummary, SEOSavedReport } from '@/features/seo-hub/types';

// Mock data for Admin Panel
export interface Brand {
  id: string;
  name: string;
  slug: string;
  type: 'internal' | 'client';
  description: string;
  owner_id: string;
  owner_name: string;
  is_active: boolean;
  team_members: string[];
  active_integrations: string[];
  monthly_budget?: number;
  kpis: BrandKPI[];
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'manager' | 'pm' | 'user';
  avatar?: string;
  assigned_brands: string[];
  is_active: boolean;
  last_login?: string;
  created_at: string;
  permissions?: UserPermissions;
}

export interface UserPermissions {
  modules: {
    dashboard: boolean;
    taskHub: boolean;
    reports: boolean;
    settings: boolean;
    adminPanel: boolean;
  };
  brands: {
    [brandId: string]: {
      access: boolean;
      level: 'owner' | 'member' | 'viewer';
      permissions: {
        viewKPIs: boolean;
        editKPIs: boolean;
        manageTeam: boolean;
        editSettings: boolean;
      };
    };
  };
}

export interface Integration {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  is_available: boolean;
  is_enabled: boolean;
  setup_complexity: 'easy' | 'medium' | 'complex';
  required_fields: string[];
}

export interface BrandKPI {
  id: string;
  name: string;
  type: 'number' | 'percentage' | 'currency';
  description: string;
  current_value: number;
  target_value?: number;
  source: string;
  display_order: number;
}

export interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: string | boolean | number;
  description: string;
  type: 'text' | 'boolean' | 'number' | 'select';
  options?: string[];
}

// Mock Brands Data
export const mockBrands: Brand[] = [
  {
    id: '1',
    name: 'CollabAI',
    slug: 'collab-ai',
    type: 'internal',
    description: 'AI collaboration platform for teams',
    owner_id: '2',
    owner_name: 'Fozle Rahman',
    is_active: true,
    team_members: ['2', '3', '4'],
    active_integrations: ['google_analytics', 'linkedin', 'hubspot'],
    monthly_budget: 5000,
    kpis: [
      { id: '1', name: 'Website Sessions', type: 'number', description: 'Monthly website visits', current_value: 4200, target_value: 5000, source: 'google_analytics', display_order: 1 },
      { id: '2', name: 'LinkedIn Followers', type: 'number', description: 'Total LinkedIn followers', current_value: 1250, target_value: 2000, source: 'linkedin', display_order: 2 },
      { id: '3', name: 'Demo Requests', type: 'number', description: 'Monthly demo requests', current_value: 18, target_value: 25, source: 'hubspot', display_order: 3 },
      { id: '4', name: 'Conversion Rate', type: 'percentage', description: 'Demo to customer conversion', current_value: 12.5, target_value: 15, source: 'hubspot', display_order: 4 }
    ],
    created_at: '2024-01-15'
  },
  {
    id: '2',
    name: 'LeadsLift',
    slug: 'leads-lift',
    type: 'internal',
    description: 'Lead generation and nurturing platform',
    owner_id: '5',
    owner_name: 'Sarah Johnson',
    is_active: true,
    team_members: ['5', '6'],
    active_integrations: ['ghl', 'google_analytics', 'facebook'],
    monthly_budget: 3000,
    kpis: [
      { id: '5', name: 'Leads Generated', type: 'number', description: 'Monthly qualified leads', current_value: 127, target_value: 150, source: 'ghl', display_order: 1 },
      { id: '6', name: 'Cost Per Lead', type: 'currency', description: 'Average cost per qualified lead', current_value: 45, target_value: 40, source: 'facebook', display_order: 2 },
      { id: '7', name: 'Email Open Rate', type: 'percentage', description: 'Average email open rate', current_value: 28.5, target_value: 30, source: 'ghl', display_order: 3 }
    ],
    created_at: '2024-02-01'
  },
  {
    id: '3',
    name: 'Community Outreach',
    slug: 'community-outreach',
    type: 'internal',
    description: 'University and community partnerships',
    owner_id: '7',
    owner_name: 'Debanjan Bhaumik',
    is_active: true,
    team_members: ['7'],
    active_integrations: ['mailgun', 'eventbrite'],
    monthly_budget: 2000,
    kpis: [
      { id: '8', name: 'Events Organized', type: 'number', description: 'Monthly events organized', current_value: 3, target_value: 4, source: 'eventbrite', display_order: 1 },
      { id: '9', name: 'Event Attendance', type: 'number', description: 'Total event attendees', current_value: 127, target_value: 150, source: 'eventbrite', display_order: 2 },
      { id: '10', name: 'Partnership Outreach', type: 'number', description: 'Monthly outreach emails', current_value: 45, target_value: 60, source: 'mailgun', display_order: 3 }
    ],
    created_at: '2024-01-20'
  },
  {
    id: '4',
    name: 'BuildYourAI',
    slug: 'build-your-ai',
    type: 'internal',
    description: 'AI development platform and services',
    owner_id: '8',
    owner_name: 'Mike Chen',
    is_active: true,
    team_members: ['8', '9'],
    active_integrations: ['google_analytics', 'youtube', 'github'],
    monthly_budget: 4000,
    kpis: [
      { id: '11', name: 'GitHub Stars', type: 'number', description: 'Total GitHub repository stars', current_value: 1450, target_value: 2000, source: 'github', display_order: 1 },
      { id: '12', name: 'YouTube Subscribers', type: 'number', description: 'Total YouTube subscribers', current_value: 3200, target_value: 5000, source: 'youtube', display_order: 2 },
      { id: '13', name: 'API Usage', type: 'number', description: 'Monthly API calls', current_value: 125000, target_value: 150000, source: 'manual', display_order: 3 }
    ],
    created_at: '2024-02-10'
  },
  {
    id: '5',
    name: 'GHL Developer',
    slug: 'ghl-developer',
    type: 'internal',
    description: 'GoHighLevel development and consulting',
    owner_id: '10',
    owner_name: 'Alex Turner',
    is_active: true,
    team_members: ['10', '11'],
    active_integrations: ['ghl', 'calendly'],
    monthly_budget: 3500,
    kpis: [
      { id: '14', name: 'Client Projects', type: 'number', description: 'Active client projects', current_value: 12, target_value: 15, source: 'manual', display_order: 1 },
      { id: '15', name: 'Monthly Revenue', type: 'currency', description: 'Monthly recurring revenue', current_value: 18500, target_value: 25000, source: 'manual', display_order: 2 },
      { id: '16', name: 'Client Satisfaction', type: 'percentage', description: 'Client satisfaction score', current_value: 94, target_value: 95, source: 'manual', display_order: 3 }
    ],
    created_at: '2024-01-25'
  },
  {
    id: '6',
    name: 'Crafted.Email',
    slug: 'crafted-email',
    type: 'internal',
    description: 'Email marketing and automation solutions',
    owner_id: '12',
    owner_name: 'Emma Wilson',
    is_active: true,
    team_members: ['12', '13'],
    active_integrations: ['mailgun', 'stripe', 'google_analytics'],
    monthly_budget: 2500,
    kpis: [
      { id: '17', name: 'Email Templates', type: 'number', description: 'Active email templates', current_value: 45, target_value: 60, source: 'manual', display_order: 1 },
      { id: '18', name: 'Subscriber Growth', type: 'percentage', description: 'Monthly subscriber growth', current_value: 8.5, target_value: 10, source: 'mailgun', display_order: 2 },
      { id: '19', name: 'Template Sales', type: 'currency', description: 'Monthly template sales', current_value: 3200, target_value: 4000, source: 'stripe', display_order: 3 }
    ],
    created_at: '2024-02-05'
  },
  {
    id: '7',
    name: 'PlatePresence',
    slug: 'plate-presence',
    type: 'client',
    description: 'Restaurant marketing and social media management',
    owner_id: '14',
    owner_name: 'Lisa Garcia',
    is_active: true,
    team_members: ['14', '15'],
    active_integrations: ['instagram', 'facebook', 'google_analytics'],
    monthly_budget: 1500,
    kpis: [
      { id: '20', name: 'Instagram Engagement', type: 'percentage', description: 'Average Instagram engagement rate', current_value: 4.2, target_value: 5, source: 'instagram', display_order: 1 },
      { id: '21', name: 'Online Reservations', type: 'number', description: 'Monthly online reservations', current_value: 234, target_value: 300, source: 'manual', display_order: 2 },
      { id: '22', name: 'Social Media Reach', type: 'number', description: 'Monthly social media reach', current_value: 15600, target_value: 20000, source: 'facebook', display_order: 3 }
    ],
    created_at: '2024-01-30'
  },
  {
    id: '8',
    name: 'SJ Innovation',
    slug: 'sj-innovation',
    type: 'internal',
    description: 'Parent company and innovation hub',
    owner_id: '1',
    owner_name: 'Super Admin',
    is_active: true,
    team_members: ['1', '2', '3'],
    active_integrations: ['google_analytics', 'linkedin', 'hubspot'],
    monthly_budget: 10000,
    kpis: [
      { id: '23', name: 'Company Valuation', type: 'currency', description: 'Current company valuation', current_value: 2500000, target_value: 5000000, source: 'manual', display_order: 1 },
      { id: '24', name: 'Team Size', type: 'number', description: 'Total team members', current_value: 24, target_value: 35, source: 'manual', display_order: 2 },
      { id: '25', name: 'Innovation Projects', type: 'number', description: 'Active innovation projects', current_value: 8, target_value: 12, source: 'manual', display_order: 3 }
    ],
    created_at: '2024-01-01'
  }
];

// Mock Users Data
export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Super Admin',
    email: 'admin@sjinnovation.com',
    role: 'super_admin',
    assigned_brands: ['1', '2', '3', '4', '5', '6', '7', '8'],
    is_active: true,
    last_login: '2024-12-20T10:30:00Z',
    created_at: '2024-01-01',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: true,
      },
      brands: {
        '1': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '2': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '3': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '4': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '5': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '6': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '7': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
        '8': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  },
  {
    id: '2',
    name: 'Fozle Rahman',
    email: 'fozle@sjinnovation.com',
    role: 'manager',
    assigned_brands: ['1'],
    is_active: true,
    last_login: '2024-12-20T09:15:00Z',
    created_at: '2024-01-15',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: false,
      },
      brands: {
        '1': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  },
  {
    id: '3',
    name: 'John Smith',
    email: 'john@sjinnovation.com',
    role: 'user',
    assigned_brands: ['1', '2'],
    is_active: true,
    last_login: '2024-12-19T16:45:00Z',
    created_at: '2024-01-20',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: false,
        adminPanel: false,
      },
      brands: {
        '1': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
        '2': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
      }
    }
  },
  {
    id: '4',
    name: 'Alice Johnson',
    email: 'alice@sjinnovation.com',
    role: 'user',
    assigned_brands: ['1', '4'],
    is_active: true,
    last_login: '2024-12-20T08:20:00Z',
    created_at: '2024-01-25',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: false,
        adminPanel: false,
      },
      brands: {
        '1': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
        '4': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
      }
    }
  },
  {
    id: '5',
    name: 'Sarah Johnson',
    email: 'sarah@sjinnovation.com',
    role: 'manager',
    assigned_brands: ['2'],
    is_active: true,
    last_login: '2024-12-19T14:30:00Z',
    created_at: '2024-02-01',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: false,
      },
      brands: {
        '2': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  },
  {
    id: '6',
    name: 'Mark Wilson',
    email: 'mark@sjinnovation.com',
    role: 'user',
    assigned_brands: ['2', '6'],
    is_active: true,
    last_login: '2024-12-18T11:15:00Z',
    created_at: '2024-02-05',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: false,
        settings: false,
        adminPanel: false,
      },
      brands: {
        '2': { access: true, level: 'viewer', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
        '6': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
      }
    }
  },
  {
    id: '7',
    name: 'Debanjan Bhaumik',
    email: 'debanjan@sjinnovation.com',
    role: 'manager',
    assigned_brands: ['3'],
    is_active: true,
    last_login: '2024-12-20T07:45:00Z',
    created_at: '2024-01-20',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: false,
      },
      brands: {
        '3': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  },
  {
    id: '8',
    name: 'Mike Chen',
    email: 'mike@sjinnovation.com',
    role: 'manager',
    assigned_brands: ['4'],
    is_active: true,
    last_login: '2024-12-19T13:20:00Z',
    created_at: '2024-02-10',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: false,
      },
      brands: {
        '4': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  },
  {
    id: '9',
    name: 'David Kim',
    email: 'david@sjinnovation.com',
    role: 'user',
    assigned_brands: ['4', '5'],
    is_active: true,
    last_login: '2024-12-20T12:10:00Z',
    created_at: '2024-02-15',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: false,
        settings: false,
        adminPanel: false,
      },
      brands: {
        '4': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
        '5': { access: true, level: 'member', permissions: { viewKPIs: true, editKPIs: false, manageTeam: false, editSettings: false } },
      }
    }
  },
  {
    id: '10',
    name: 'Alex Turner',
    email: 'alex@sjinnovation.com',
    role: 'manager',
    assigned_brands: ['5'],
    is_active: true,
    last_login: '2024-12-19T15:30:00Z',
    created_at: '2024-01-25',
    permissions: {
      modules: {
        dashboard: true,
        taskHub: true,
        reports: true,
        settings: true,
        adminPanel: false,
      },
      brands: {
        '5': { access: true, level: 'owner', permissions: { viewKPIs: true, editKPIs: true, manageTeam: true, editSettings: true } },
      }
    }
  }
];

// Mock Global Integrations (Admin-only configuration)
export const mockGlobalIntegrations = [
  {
    id: 'global_1',
    name: 'CollabAI',
    type: 'collab_ai',
    description: 'Collaborative AI platform for team productivity',
    icon: '🚀',
    category: 'ai',
    is_available: true,
    is_enabled: false,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'workspace_id', 'model_preference']
  },
  {
    id: 'global_2',
    name: 'OpenAI',
    type: 'openai',
    description: 'AI-powered content generation and analysis',
    icon: '🤖',
    category: 'ai',
    is_available: true,
    is_enabled: false,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'organization_id', 'model_preference']
  },
  {
    id: 'global_3',
    name: 'SendGrid',
    type: 'sendgrid',
    description: 'Email delivery service for system notifications',
    icon: '📧',
    category: 'communication',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'sender_email']
  }
];

// Mock Brand Integrations (Per-brand configuration)
export const mockBrandIntegrations = [
  {
    id: 'brand_1',
    name: 'GoHighLevel',
    type: 'gohighlevel',
    description: 'CRM and marketing automation platform',
    icon: '🎯',
    category: 'crm' as const,
    is_available: true,
    setup_complexity: 'medium' as const,
    required_fields: ['api_key', 'location_id', 'webhook_url'],
    brand_connections: {
      '1': { is_enabled: true, config: { api_key: '***', location_id: 'loc_123' }, status: 'connected' as const },
      '2': { is_enabled: false, config: {}, status: 'pending' as const }
    }
  },
  {
    id: 'brand_2', 
    name: 'LinkedIn Business',
    type: 'linkedin_business',
    description: 'LinkedIn marketing and analytics integration',
    icon: '💼',
    category: 'social' as const,
    is_available: true,
    setup_complexity: 'medium' as const,
    required_fields: ['access_token', 'company_id', 'campaign_account'],
    brand_connections: {
      '1': { is_enabled: true, config: { access_token: '***', company_id: 'comp_456' }, status: 'connected' as const }
    }
  },
  {
    id: 'brand_3',
    name: 'Brand Analytics', 
    type: 'brand_analytics',
    description: 'Custom analytics tracking for brand performance',
    icon: '📊',
    category: 'analytics' as const,
    is_available: true,
    setup_complexity: 'easy' as const,
    required_fields: ['tracking_id', 'domain'],
    brand_connections: {
      '1': { is_enabled: true, config: { tracking_id: 'GA_789', domain: 'brand1.com' }, status: 'connected' as const },
      '2': { is_enabled: true, config: { tracking_id: 'GA_101', domain: 'brand2.com' }, status: 'connected' as const }
    }
  },
  {
    id: 'brand_4',
    name: 'Meta Ads',
    type: 'meta_ads', 
    description: 'Facebook and Instagram advertising platform integration',
    icon: '📘',
    category: 'marketing' as const,
    is_available: true,
    setup_complexity: 'medium' as const,
    required_fields: ['access_token', 'account_id', 'pixel_id'],
    brand_connections: {
      '1': { is_enabled: true, config: { access_token: '***', account_id: 'act_123' }, status: 'connected' as const }
    }
  }
];

// Mock Integrations
export const mockIntegrations: Integration[] = [
  {
    id: '1',
    name: 'Google Analytics',
    type: 'google_analytics',
    description: 'Website traffic and conversion tracking',
    icon: '📊',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'medium',
    required_fields: ['property_id', 'api_key', 'view_id']
  },
  {
    id: '2',
    name: 'GoHighLevel',
    type: 'ghl',
    description: 'CRM and marketing automation platform',
    icon: '🎯',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'medium',
    required_fields: ['api_key', 'location_id']
  },
  {
    id: '3',
    name: 'LinkedIn',
    type: 'linkedin',
    description: 'Professional social media analytics',
    icon: '💼',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'complex',
    required_fields: ['client_id', 'client_secret', 'company_id']
  },
  {
    id: '4',
    name: 'HubSpot',
    type: 'hubspot',
    description: 'Inbound marketing and sales platform',
    icon: '🧲',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'medium',
    required_fields: ['api_key', 'portal_id']
  },
  {
    id: '5',
    name: 'Facebook/Meta',
    type: 'facebook',
    description: 'Social media advertising and analytics',
    icon: '📘',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'complex',
    required_fields: ['app_id', 'app_secret', 'access_token', 'page_id']
  },
  {
    id: '6',
    name: 'Instagram',
    type: 'instagram',
    description: 'Visual social media analytics',
    icon: '📷',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'medium',
    required_fields: ['access_token', 'business_account_id']
  },
  {
    id: '7',
    name: 'YouTube',
    type: 'youtube',
    description: 'Video content and analytics tracking',
    icon: '📹',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'medium',
    required_fields: ['api_key', 'channel_id']
  },
  {
    id: '8',
    name: 'Mailgun',
    type: 'mailgun',
    description: 'Email delivery and analytics service',
    icon: '📧',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'domain']
  },
  {
    id: '9',
    name: 'Stripe',
    type: 'stripe',
    description: 'Payment processing and revenue tracking',
    icon: '💳',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'webhook_secret']
  },
  {
    id: '10',
    name: 'Eventbrite',
    type: 'eventbrite',
    description: 'Event management and ticket sales',
    icon: '🎟️',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'organization_id']
  },
  {
    id: '11',
    name: 'GitHub',
    type: 'github',
    description: 'Code repository and development analytics',
    icon: '🐱',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['access_token', 'organization']
  },
  {
    id: '12',
    name: 'Calendly',
    type: 'calendly',
    description: 'Meeting scheduling and booking analytics',
    icon: '📅',
    is_available: true,
    is_enabled: true,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'user_uuid']
  },
  {
    id: '13',
    name: 'OpenAI',
    type: 'openai',
    description: 'AI-powered content generation and analysis',
    icon: '🤖',
    is_available: true,
    is_enabled: false,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'organization_id', 'model_preference']
  },
  {
    id: '14',
    name: 'CollabAI',
    type: 'collab_ai',
    description: 'Collaborative AI platform for team productivity',
    icon: '🚀',
    is_available: true,
    is_enabled: false,
    setup_complexity: 'easy',
    required_fields: ['api_key', 'workspace_id', 'model_preference']
  }
];

// Mock System Settings
export const mockSystemSettings: SystemSetting[] = [
  {
    id: '1',
    category: 'General',
    key: 'company_name',
    value: 'SJ Innovation',
    description: 'Company name displayed throughout the application',
    type: 'text'
  },
  {
    id: '2',
    category: 'General',
    key: 'default_currency',
    value: 'USD',
    description: 'Default currency for financial metrics',
    type: 'select',
    options: ['USD', 'EUR', 'GBP', 'CAD']
  },
  {
    id: '3',
    category: 'Features',
    key: 'ai_assistance_enabled',
    value: true,
    description: 'Enable AI assistance features across the platform',
    type: 'boolean'
  },
  {
    id: '4',
    category: 'Features',
    key: 'auto_sync_interval',
    value: 24,
    description: 'Automatic data sync interval in hours',
    type: 'number'
  },
  {
    id: '5',
    category: 'Security',
    key: 'session_timeout',
    value: 480,
    description: 'User session timeout in minutes',
    type: 'number'
  },
  {
    id: '6',
    category: 'Security',
    key: 'require_2fa',
    value: false,
    description: 'Require two-factor authentication for all users',
    type: 'boolean'
  },
  {
    id: '7',
    category: 'Notifications',
    key: 'email_notifications',
    value: true,
    description: 'Enable system email notifications',
    type: 'boolean'
  },
  {
    id: '8',
    category: 'Notifications',
    key: 'slack_webhook_url',
    value: '',
    description: 'Slack webhook URL for system notifications',
    type: 'text'
  }
];

// Utility functions
export const getBrandById = (id: string) => mockBrands.find(brand => brand.id === id);
export const getUserById = (id: string) => mockUsers.find(user => user.id === id);
export const getIntegrationById = (id: string) => mockIntegrations.find(integration => integration.id === id);
export const getGlobalIntegrationById = (id: string) => mockGlobalIntegrations.find(integration => integration.id === id);
export const getBrandIntegrationById = (id: string) => mockBrandIntegrations.find(integration => integration.id === id);

// SEO Hub demo fallbacks (used when DB/API has no data)
export const MOCK_SEO_SUMMARY: SEOSummary = {
  latestScanScore: 78,
  keywordCount: 42,
  backlinkCount: 156,
  reportsThisMonth: 5,
  lastScanDate: new Date().toISOString(),
  isDemo: true,
};

export const MOCK_SEO_REPORTS: SEOSavedReport[] = [
  {
    id: 'mock-report-1',
    brand_id: 'brand-1',
    brand_name: 'Acme Corp',
    brand_slug: 'acme-corp',
    tool_type: 'site_audit',
    title: 'Site Audit — acme.com',
    score: 78,
    status: 'completed',
    input_value: 'https://acme.com',
    result_summary: 'Strong technical foundation; improve meta descriptions on 4 pages.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    result_url: '/brands/acme-corp/seo/workspace',
  },
  {
    id: 'mock-report-2',
    brand_id: 'brand-2',
    brand_name: 'TechStart',
    brand_slug: 'techstart',
    tool_type: 'keyword_research',
    title: 'Keyword Research — SaaS marketing',
    score: null,
    status: 'completed',
    input_value: 'saas marketing',
    result_summary: '24 keyword suggestions saved to tracking list.',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    result_url: '/brands/techstart/keyword-research',
  },
  {
    id: 'mock-report-3',
    brand_id: 'brand-1',
    brand_name: 'Acme Corp',
    brand_slug: 'acme-corp',
    tool_type: 'backlink',
    title: 'Backlink Check — acme.com',
    score: 65,
    status: 'completed',
    input_value: 'acme.com',
    result_summary: '156 referring domains found; 12 high-authority opportunities.',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    result_url: '/brands/acme-corp/seo?tab=backlinks',
  },
  {
    id: 'mock-report-4',
    brand_id: 'brand-3',
    brand_name: 'GreenLeaf',
    brand_slug: 'greenleaf',
    tool_type: 'competitor',
    title: 'Competitor Analysis — greenleaf.io',
    score: 72,
    status: 'completed',
    input_value: 'competitor1.com, competitor2.com',
    result_summary: 'Identified 18 keyword gaps vs top 2 competitors.',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    result_url: '/brands/greenleaf/seo?tab=competitors',
  },
];

export const MOCK_BACKLINK_RESULTS = [
  { source_domain: 'techcrunch.com', target_url: 'https://acme.com/product', link_type: 'dofollow' as const, anchor_text: 'Acme Product', domain_rating: 92 },
  { source_domain: 'medium.com', target_url: 'https://acme.com/blog', link_type: 'nofollow' as const, anchor_text: 'read more', domain_rating: 78 },
  { source_domain: 'industryweekly.com', target_url: 'https://acme.com', link_type: 'dofollow' as const, anchor_text: 'Acme Corp', domain_rating: 65 },
  { source_domain: 'startupdigest.io', target_url: 'https://acme.com/about', link_type: 'dofollow' as const, anchor_text: 'about Acme', domain_rating: 58 },
  { source_domain: 'news.example.com', target_url: 'https://acme.com/press', link_type: 'unknown' as const, anchor_text: 'press release', domain_rating: 45 },
];

export const MOCK_COMPETITOR_RESULTS = [
  { domain: 'competitor1.com', overlap_keywords: 34, gap_score: 68, top_keywords: ['saas tools', 'marketing automation', 'crm software'], summary: 'Strong content presence in SaaS keywords.' },
  { domain: 'competitor2.com', overlap_keywords: 22, gap_score: 55, top_keywords: ['b2b marketing', 'lead generation', 'email campaigns'], summary: 'Dominates email marketing related terms.' },
];

// Statistics for dashboard
export const getSystemStats = () => ({
  totalBrands: mockBrands.filter(b => b.is_active).length,
  totalUsers: mockUsers.filter(u => u.is_active).length,
  totalIntegrations: mockIntegrations.filter(i => i.is_available).length,
  totalRevenue: mockBrands.reduce((sum, brand) => {
    const revenue = brand.kpis.find(kpi => kpi.type === 'currency')?.current_value || 0;
    return sum + revenue;
  }, 0)
});
