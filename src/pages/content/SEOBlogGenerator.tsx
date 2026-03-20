import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSEOBlogGenerator } from '@/hooks/useSEOBlogGenerator'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles, FileText, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import Unauthorized from '@/pages/Unauthorized'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'


interface SEOBlogGeneratorProps {
  brandId?: string
  brandName?: string
}

export default function SEOBlogGenerator({ brandId, brandName }: SEOBlogGeneratorProps = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const generateBlog = useSEOBlogGenerator()

  // Fetch agent configuration for default settings
  const { data: agentConfig } = useQuery({
    queryKey: ['ai-agent-config', 'seo-blog-generator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('data_sources')
        .eq('slug', 'seo-blog-generator')
        .single()

      if (error) {
        console.warn('Could not fetch SEO agent config, using defaults:', error)
        return null
      }
      return data?.data_sources as { default_tone?: string; default_audience?: string } | null
    },
  })

  // Form state - use agent config defaults
  const [selectedBrandId, setSelectedBrandId] = useState(brandId || '')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [primaryReference, setPrimaryReference] = useState('')
  const [secondaryKeyword, setSecondaryKeyword] = useState('')
  const [thirdKeyword, setThirdKeyword] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [tone, setTone] = useState(agentConfig?.default_tone || 'informative')
  const [audience, setAudience] = useState(agentConfig?.default_audience || '')

  // Load user's brands (only when brandId is not provided)
  // For super_admin and manager, load all brands; for others, load assigned brands
  const { data: brands, isLoading: loadingBrands } = useQuery({
    queryKey: ['user-brands', user?.id, user?.role],
    enabled: !!user && !brandId,
    queryFn: async () => {
      // For admins, load all brands
      if (user?.role === 'super_admin' || user?.role === 'manager') {
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        return data
      }

      // For regular users, load assigned brands
      const { data, error } = await supabase
        .from('user_brands')
        .select('brand_id, brands(*)')
        .eq('user_id', user!.id)

      if (error) throw error
      return data.map((ub) => ub.brands)
    },
  })

  // If brandId and brandName are provided (brand context), use those
  // Otherwise, find from loaded brands
  const selectedBrand = brandId && brandName
    ? { id: brandId, name: brandName }
    : brands?.find((b) => b.id === selectedBrandId)

  const handleGenerate = async () => {
    if (!selectedBrand) {
      toast({
        title: 'Select a brand',
        description: 'Please select a brand to generate content for.',
        variant: 'destructive',
      })
      return
    }

    if (!primaryKeyword) {
      toast({
        title: 'Missing primary keyword',
        description: 'Please provide at least the primary keyword.',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await generateBlog.mutateAsync({
        brand_id: selectedBrand.id,
        brand_name: selectedBrand.name,
        primary_keyword: primaryKeyword,
        primary_reference: primaryReference,
        secondary_keyword: secondaryKeyword,
        third_keyword: thirdKeyword,
        additional_notes: additionalNotes,
        tone,
        audience,
      })

      toast({
        title: result.validation.valid ? 'Blog generated successfully!' : 'Blog generated with warnings',
        description: result.validation.valid
          ? 'Your SEO blog passed all validation rules.'
          : `Generated with ${result.validation.errors.length} validation issues. You can review and edit.`,
      })

      // Navigate to result page
      navigate(`/content/seo-blog/${result.blog_id}`)
    } catch (error: any) {
      console.error(error)
      toast({
        title: 'Generation failed',
        description: error.message || 'Unable to generate blog. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (!user) {
    return <Unauthorized />
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl">SEO Blog Generator</CardTitle>
              <CardDescription>
                Generate SEO-optimized blog posts with strict keyword placement and formatting rules
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Rules Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Content Rules</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Word count: 600-700 words (title + body)</li>
            <li>Title: 7-14 words with keyword</li>
            <li>Keyword: 1x in title + 1x in body (required)</li>
            <li>Brand name: 1x in last paragraph only</li>
            <li>Structure: 5-8 paragraphs, 4 sentences each</li>
            <li>One paragraph with 3-5 bullet points</li>
            <li>No hyphens or colons allowed</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Brand Selection - only show when not in brand context */}
      {!brandId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Brand</CardTitle>
            <CardDescription>Choose the brand this blog is for</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBrands ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading brands...</span>
              </div>
            ) : (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show selected brand name when in brand context */}
      {brandId && brandName && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Generating blog for: <strong className="text-foreground">{brandName}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyword & Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Keyword & Reference</CardTitle>
          <CardDescription>
            Provide the keyword phrase for SEO optimization (required).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Keyword - REQUIRED */}
          <div className="space-y-3 p-4 border-2 border-primary rounded-lg bg-primary/5">
            <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Keyword Phrase - REQUIRED (appears 2x: 1x in title, 1x in body)
            </h3>
            <div className="space-y-2">
              <Label htmlFor="primary-keyword" className="text-primary font-semibold">
                Keyword Phrase <span className="text-red-500">*</span>
              </Label>
              <Input
                id="primary-keyword"
                placeholder="e.g., cloud computing solutions"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                required
                className="border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-reference">Reference Content (optional)</Label>
              <Textarea
                id="primary-reference"
                placeholder="Paste article text, URL, or context about this keyword..."
                rows={3}
                value={primaryReference}
                onChange={(e) => setPrimaryReference(e.target.value)}
              />
            </div>
          </div>

          {/* Additional Keywords - OPTIONAL */}
          <div className="space-y-3 p-4 border border-dashed rounded-lg bg-muted/30">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Keywords (optional)
            </h3>
            <p className="text-xs text-muted-foreground">
              Provide up to 2 additional keyword phrases for context. These will guide the AI but don't require strict placement.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secondary-keyword">Additional Keyword 1</Label>
                <Input
                  id="secondary-keyword"
                  placeholder="e.g., digital transformation"
                  value={secondaryKeyword}
                  onChange={(e) => setSecondaryKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-keyword">Additional Keyword 2</Label>
                <Input
                  id="third-keyword"
                  placeholder="e.g., business automation"
                  value={thirdKeyword}
                  onChange={(e) => setThirdKeyword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Additional Notes/Requirements - NEW */}
          <div className="space-y-3 p-4 border border-dashed rounded-lg bg-muted/30">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Requirements (optional)
            </h3>
            <div className="space-y-2">
              <Label htmlFor="additional-notes">
                Notes & Special Instructions
              </Label>
              <Textarea
                id="additional-notes"
                placeholder="Add any additional requirements or instructions for the blog generation (e.g., mention specific products, focus on certain benefits, include statistics, etc.)"
                rows={4}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be included in the AI prompt to customize your blog content.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tone & Audience */}
      <Card>
        <CardHeader>
          <CardTitle>Tone & Audience</CardTitle>
          <CardDescription>Customize the writing style and target audience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informative">Informative</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                placeholder="e.g., small business owners, IT professionals"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            disabled={generateBlog.isPending || (!brandId && !selectedBrandId) || !primaryKeyword}
          >
            {generateBlog.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating blog (this may take 30-60 seconds)...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate SEO Blog
              </>
            )}
          </Button>
          {selectedBrand && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Blog will be generated for <strong>{selectedBrand.name}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {generateBlog.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>
            {generateBlog.error?.message || 'Failed to generate blog. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
