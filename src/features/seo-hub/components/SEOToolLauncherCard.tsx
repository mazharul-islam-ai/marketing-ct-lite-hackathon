import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, Search, Globe, Link2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SEOToolType } from '../types';

const TOOL_META: Record<
  SEOToolType,
  { icon: typeof Search; title: string; description: string; getHref: (slug: string) => string }
> = {
  keyword_research: {
    icon: Search,
    title: 'Keyword Research',
    description: 'Discover and track high-value keywords',
    getHref: (slug) => `/brands/${slug}/keyword-research`,
  },
  site_audit: {
    icon: Globe,
    title: 'Site Audit',
    description: 'Analyze on-page and technical SEO health',
    getHref: (slug) => `/brands/${slug}/seo/workspace`,
  },
  backlink: {
    icon: Link2,
    title: 'Backlink Checker',
    description: 'Review referring domains and link quality',
    getHref: (slug) => `/brands/${slug}/seo?tab=backlinks`,
  },
  competitor: {
    icon: Users,
    title: 'Competitor Analysis',
    description: 'Identify keyword gaps vs competitors',
    getHref: (slug) => `/brands/${slug}/seo?tab=competitors`,
  },
};

interface SEOToolLauncherCardProps {
  toolType: SEOToolType;
  brandSlug: string;
  lastScore?: number | null;
  disabled?: boolean;
}

export function SEOToolLauncherCard({
  toolType,
  brandSlug,
  lastScore,
  disabled = false,
}: SEOToolLauncherCardProps) {
  const navigate = useNavigate();
  const meta = TOOL_META[toolType];
  const Icon = meta.icon;

  return (
    <Card className={disabled ? 'opacity-60' : 'hover:shadow-md transition-shadow'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">{meta.title}</CardTitle>
          </div>
          {lastScore != null && (
            <Badge variant="secondary">{lastScore}/100</Badge>
          )}
        </div>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={() => navigate(meta.getHref(brandSlug))}
        >
          Open tool
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
