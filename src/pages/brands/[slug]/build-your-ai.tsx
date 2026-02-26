import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase as _supabase } from '@/integrations/supabase/client'
const supabase = _supabase as any;
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { ChevronRight } from 'lucide-react'
import Unauthorized from '@/pages/Unauthorized'
import { Skeleton } from '@/components/ui/skeleton'
import SEOBlogGenerator from '@/pages/content/SEOBlogGenerator'

interface Brand {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website_url: string | null
}

export default function BrandBlogGenerator() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()

  // Load brand from slug
  const { data: brand, isLoading: loadingBrand, isError } = useQuery<Brand | null>({
    queryKey: ['brand-for-blog', slug],
    enabled: Boolean(slug && user),
    queryFn: async () => {
      if (!slug) return null

      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug, description, logo_url, website_url')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      return {
        id: data.id,
        name: data.name ?? '',
        slug: data.slug ?? '',
        description: data.description,
        logo_url: data.logo_url,
        website_url: data.website_url,
      }
    },
  })

  if (!user) {
    return <Unauthorized />
  }

  if (!slug) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center text-lg font-semibold text-muted-foreground">
            Brand not found
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loadingBrand) {
    return (
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError || !brand) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Brand not found or you don't have access to this brand.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/brands">Brands</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/brands/${slug}`}>{brand.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>SEO Blog Generator</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Reuse the main SEO Blog Generator component */}
      <SEOBlogGenerator brandId={brand.id} brandName={brand.name} />
    </div>
  )
}
