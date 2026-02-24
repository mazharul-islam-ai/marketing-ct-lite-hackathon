-- =====================================================
-- COMPREHENSIVE DEMO DATA SEEDING - PHASE 2
-- Content Generation: LinkedIn Posts, SEO Blogs, Newsletter, Media
-- =====================================================
-- Lightweight realistic demo data (~100 records)
-- LinkedIn posts, SEO blogs, newsletters, AI-generated images, videos
--
-- Prerequisites: Phase 1 must be completed
-- Users, brands, and agents created in Phase 1

-- =====================================================
-- DEMO USER IDs (from Phase 1)
-- =====================================================

\set admin_id '500b4a7f-4c4a-429e-a307-0601568c8525'
\set user_id 'b31fefe1-d78f-4160-85d3-298bccf9e02e'
\set pm_id 'e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8'
\set brand_manager_id 'f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9'
\set manager_id 'a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0'

-- =====================================================
-- 1. LINKEDIN POSTS (30 posts across brands)
-- =====================================================

INSERT INTO public.generated_posts (
  id,
  leader_id,
  post_title,
  post_body,
  carousel_outline,
  caption_ideas,
  source_type,
  source_id,
  agent_id,
  generated_by,
  model_used,
  created_at
) VALUES
  -- Tech Blog Posts (Leader: Alex Chen)
  ('lpost-001-0000-0000-000000000001'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'Kubernetes at Scale: Lessons from the Trenches',
   'After managing 500+ Kubernetes clusters in production, here are the hard lessons we learned:

1. Start with observability. Not after. Before anything else. Prometheus + Grafana is non-negotiable.

2. Custom CNI plugins always bite you eventually. Use what the community recommends.

3. Resource limits aren''t suggestions—they''re survival.

4. StatefulSets are harder than they look. Practice with small apps first.

5. Never skip security scanning in your CI/CD pipeline.

The biggest mistake? Underestimating how much CPU you need for control plane nodes.

What''s your biggest Kubernetes challenge?',
   ARRAY['Benefits of early observability', 'Why CNI plugins matter', 'Resource limits best practices', 'StatefulSets deep dive', 'Security scanning importance'],
   ARRAY['#Kubernetes #DevOps #CloudNative', 'Have you faced Kubernetes scaling challenges?', 'Drop a comment with your biggest K8s lesson'],
   'custom', NULL,
   'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o',
   NOW() - INTERVAL '35 days'),

  ('lpost-002-0000-0000-000000000002'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'Why Your Microservices Architecture is Burning Money',
   'The uncomfortable truth: most microservices architectures are premature optimization.

We split a monolith into 47 services. Our costs tripled. Latency increased. Development velocity plummeted.

The problem? We had:
• No clear domain boundaries
• Weak async communication patterns
• Shared databases (defeating the purpose)
• Over-instrumentation

After 6 months of refactoring back to 12 strategic services, everything improved.

Before going micro, ask yourself:
✓ Do I have separate deployment needs?
✓ Do I have different scaling requirements?
✓ Do I have truly independent data models?

If the answer is "no" to most, you''re not ready yet.',
   ARRAY['Common microservices mistakes', 'When NOT to use microservices', 'Monolith vs microservices trade-offs', 'Domain-driven design basics', 'Cost optimization strategies'],
   ARRAY['#Architecture #Microservices #TechDebt', 'Microservices at your company: blessing or curse?', 'Share your architecture evolution story'],
   'custom', NULL,
   'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o',
   NOW() - INTERVAL '33 days'),

  ('lpost-003-0000-0000-000000000003'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'The API Gateway Pattern: Gateway vs BFF vs Service Mesh',
   'Choosing the right API pattern changed everything for us.

API Gateway: Single entry point, simple but can become a bottleneck.

BFF (Backend for Frontend): Separate APIs per client, flexible but complex.

Service Mesh (Istio): Handles routing at infrastructure level, powerful but steep learning curve.

Our progression:
2016: API Gateway (good start)
2018: Multiple BFFs (better UX)
2020: Added Service Mesh (production-grade)

Each layer solves different problems. Don''t skip early versions; they teach you what you actually need.

Which pattern are you using?',
   ARRAY['API Gateway explained', 'BFF pattern deep dive', 'Service Mesh introduction', 'Architecture trade-offs', 'Real-world implementation'],
   ARRAY['#APIDevelopment #SystemDesign #CloudArchitecture', 'API pattern: choosing wisely', 'What''s your architecture?'],
   'custom', NULL,
   'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o',
   NOW() - INTERVAL '31 days'),

  -- Startup Stories (Leader: Sarah Martinez)
  ('lpost-004-0000-0000-000000000004'::uuid, 'leader-002-0000-0000-000000000002'::uuid,
   'The 3 AM Moment: When We Almost Shut Down',
   'Month 8 of our startup. Runway = 3 months. Revenue = $0.

We were shipping a product nobody wanted.

I remember the 3 AM moment in our tiny office. Two of us sat there in the dark, staring at metrics that screamed "failure."

Then something changed.

Instead of building MORE features, we deleted 60% of them. We got on calls—actual customer calls, not demos—and we listened.

Here''s what we found:
• Customers didn''t want our flagship feature
• They actually cared about the boring thing we built in a weekend
• We were solving the wrong problem

We pivoted. Three months later, we hit $10K MRR.

The lesson? Your market is smarter than your assumptions.

What''s your biggest pivot story?',
   ARRAY['The crisis moment', 'Customer research that saved us', 'How we pivoted', 'Early traction signals', 'The money moment'],
   ARRAY['#Startup #Entrepreneurship #Pivot', 'Startup pivots: when did you know?', 'Share your turnaround story'],
   'custom', NULL,
   'agent-002-0000-0000-000000000002'::uuid, :admin_id::uuid, 'gpt-4o',
   NOW() - INTERVAL '29 days'),

  ('lpost-005-0000-0000-000000000005'::uuid, 'leader-002-0000-0000-000000000002'::uuid,
   'Raising Money During a Recession: What Actually Happened',
   'We closed our $2M seed round in March 2023. Worst possible timing.

Everyone said we were crazy. Interest rates up. VCs spooked. Companies dying left and right.

But here''s the secret: recessions are when the best companies are born.

Here''s what worked:

1. Show Metrics: We didn''t have revenue, but we had 40% weekly growth. Numbers are language VCs speak.

2. Be Different: Everyone was pitching AI. We pitched something boring but useful. We stood out.

3. Show Progress: We shipped weekly. VCs invested in momentum, not perfection.

4. Pick Believers: Some VCs doubted. Some believed. We picked believers.

5. Have a Strong Why: We knew exactly why we existed beyond money.

Result? Not only did we raise, but our investors'' conviction stayed strong through the downturn.

Moral: Great execution beats market conditions.',
   ARRAY['Recession fundraising lessons', 'What metrics matter to VCs', 'Being contrarian', 'Founder conviction', 'Closing the deal'],
   ARRAY['#Fundraising #Startup #VenturCapital', 'Fundraising tips: what worked for you?', 'Recession survival stories'],
   'custom', NULL,
   'agent-002-0000-0000-000000000002'::uuid, :admin_id::uuid, 'gpt-4o',
   NOW() - INTERVAL '27 days')
ON CONFLICT (id) DO NOTHING;

-- Additional posts... (truncated for brevity, adding 25 more realistic posts)

INSERT INTO public.generated_posts (
  id, leader_id, post_title, post_body, source_type, agent_id, generated_by, model_used, created_at
) VALUES
  -- More tech posts (10 additional)
  ('lpost-006-0000-0000-000000000006'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'Database Performance: The Indexing Strategy That Doubled Our Throughput',
   'Our query was slow. 2.5 seconds for a simple lookup. Unacceptable.

Started profiling. Wasn''t the query logic—we were missing a critical composite index.

After understanding our access patterns and adding 3 strategic indexes, queries dropped to 45ms.

Simple but powerful: think about HOW your data is QUERIED, not just how it''s stored.',
   'custom', 'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o', NOW() - INTERVAL '25 days'),

  ('lpost-007-0000-0000-000000000007'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'Rate Limiting: The Defensive Strategy Every API Needs',
   'One customer sent 100K requests in 10 minutes. Crashed our system.

We implemented rate limiting with exponential backoff. Problem solved and our system became more resilient.',
   'custom', 'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o', NOW() - INTERVAL '23 days'),

  ('lpost-008-0000-0000-000000000008'::uuid, 'leader-001-0000-0000-000000000001'::uuid,
   'Debugging Distributed Systems: Lessons from 100+ Production Incidents',
   'Distributed systems make debugging exponentially harder. Context matters. Logging matters. Tracing matters.

Stack: ELK + Jaeger + custom correlation IDs = sanity.',
   'custom', 'agent-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'gpt-4o', NOW() - INTERVAL '21 days'),

  ('lpost-009-0000-0000-000000000009'::uuid, 'leader-002-0000-0000-000000000002'::uuid,
   'Founder Burnout Is Real: How I Almost Lost Everything',
   'By month 14, I was running on coffee and fear. Shipping without sleep. Making bad decisions.

I hit a wall. Couldn''t sleep. Couldn''t focus. Couldn''t think.

Took 2 weeks off. Came back with clarity. Hired my co-founder a COO role to handle operations.

Burnout doesn''t make you stronger—it makes you worse at your job.',
   'custom', 'agent-002-0000-0000-000000000002'::uuid, :admin_id::uuid, 'gpt-4o', NOW() - INTERVAL '19 days'),

  ('lpost-010-0000-0000-000000000010'::uuid, 'leader-002-0000-0000-000000000002'::uuid,
   'The Board Meeting That Changed My Perspective',
   'First board meeting was terrifying. Our advisors asked hard questions we didn''t have answers for.

Instead of being defensive, I listened. Their perspective helped us refocus on what matters.',
   'custom', 'agent-002-0000-0000-000000000002'::uuid, :admin_id::uuid, 'gpt-4o', NOW() - INTERVAL '17 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. SEO BLOG CONTENT (15 blogs)
-- =====================================================

INSERT INTO public.seo_blog_content (
  id,
  title,
  content,
  keywords,
  meta_description,
  author_id,
  brand_id,
  published_at,
  created_at
) VALUES
  ('blog-001-0000-0000-000000000001'::uuid,
   'Complete Guide to Kubernetes Networking: Pods, Services, and Ingress',
   jsonb_build_object(
     'introduction', 'Kubernetes networking is complex but fundamental. This guide covers pods, services, ingress controllers, and network policies.',
     'sections', jsonb_build_array(
       jsonb_build_object('title', 'Understanding Pods and Network Namespace', 'content', 'Every pod gets its own IP address...'),
       jsonb_build_object('title', 'Services: ClusterIP, NodePort, LoadBalancer', 'content', 'Services provide stable endpoints...'),
       jsonb_build_object('title', 'Ingress Controllers and Routing', 'content', 'Ingress resources define external access rules...'),
       jsonb_build_object('title', 'Network Policies for Security', 'content', 'Network policies control traffic between pods...')
     ),
     'conclusion', 'Kubernetes networking enables sophisticated service architectures. Master these concepts for production deployments.'
   ),
   ARRAY['kubernetes networking', 'pods', 'services', 'ingress controller', 'network policy', 'container networking'],
   'Complete guide to Kubernetes networking: pods, services, and ingress controllers for production deployments.',
   :admin_id::uuid, 'brand-001-0000-0000-000000000001'::uuid, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),

  ('blog-002-0000-0000-000000000002'::uuid,
   'Microservices vs Monolith: When to Split Your Architecture',
   jsonb_build_object(
     'introduction', 'The monolith vs microservices debate is nuanced. Learn when each architecture makes sense.',
     'sections', jsonb_build_array(
       jsonb_build_object('title', 'Monolith Advantages and Disadvantages', 'content', 'Monoliths are simpler initially but harder to scale...'),
       jsonb_build_object('title', 'Microservices Benefits and Challenges', 'content', 'Microservices offer flexibility but add complexity...'),
       jsonb_build_object('title', 'Migration Strategies', 'content', 'Strangler pattern helps transition gradually...')
     ),
     'conclusion', 'Choose monolith for early stage, migrate to microservices when scaling demands it.'
   ),
   ARRAY['microservices', 'monolithic architecture', 'system design', 'scalability', 'architecture patterns'],
   'When to use microservices vs monolithic architecture: decision factors and migration strategies.',
   :admin_id::uuid, 'brand-001-0000-0000-000000000001'::uuid, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

  ('blog-003-0000-0000-000000000003'::uuid,
   'SEO Best Practices 2026: Algorithm Updates and Ranking Factors',
   jsonb_build_object(
     'introduction', '2026 brings significant changes to SEO. Learn the latest algorithm updates and ranking factors.',
     'sections', jsonb_build_array(
       jsonb_build_object('title', 'Core Web Vitals Update', 'content', 'Page speed and UX metrics are critical ranking factors...'),
       jsonb_build_object('title', 'AI Content and E-E-A-T', 'content', 'Search engines now evaluate content expertise and authenticity...'),
       jsonb_build_object('title', 'Backlink Quality Over Quantity', 'content', 'Editorial backlinks from authoritative sites matter most...')
     ),
     'conclusion', 'Focus on user experience, authentic expertise, and genuine backlinks for sustainable SEO success.'
   ),
   ARRAY['seo', 'search engine optimization', 'google algorithm', 'ranking factors', 'technical seo', 'content seo'],
   'Latest SEO best practices for 2026: algorithm updates, Core Web Vitals, and ranking factors explained.',
   :admin_id::uuid, 'brand-002-0000-0000-000000000002'::uuid, NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. AI-GENERATED IMAGES
-- =====================================================

INSERT INTO public.ai_generated_images (
  id,
  prompt,
  image_url,
  thumbnail_url,
  model_used,
  model_version,
  size,
  generated_by,
  created_at
) VALUES
  ('img-001-0000-0000-000000000001'::uuid,
   'Professional headshot of a tech entrepreneur, modern office background, warm lighting',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
   'openai', 'dall-e-3', '1024x1024', :admin_id::uuid, NOW() - INTERVAL '25 days'),

  ('img-002-0000-0000-000000000002'::uuid,
   'Modern cloud infrastructure diagram, interconnected servers, digital art style',
   'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1024',
   'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200',
   'openai', 'dall-e-3', '1024x1024', :admin_id::uuid, NOW() - INTERVAL '23 days'),

  ('img-003-0000-0000-000000000003'::uuid,
   'Team collaboration in modern startup office, diverse team, energetic atmosphere',
   'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1024',
   'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200',
   'gemini', 'gemini-image', '1024x1024', :admin_id::uuid, NOW() - INTERVAL '21 days'),

  ('img-004-0000-0000-000000000004'::uuid,
   'Abstract data visualization, flowing information, digital design, blues and purples',
   'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1024',
   'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200',
   'openai', 'dall-e-3', '1024x1024', :admin_id::uuid, NOW() - INTERVAL '19 days'),

  ('img-005-0000-0000-000000000005'::uuid,
   'Marketing analytics dashboard, colorful metrics, professional design',
   'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=1024',
   'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=200',
   'gemini', 'gemini-image', '1024x1024', :admin_id::uuid, NOW() - INTERVAL '17 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. VIDEOS
-- =====================================================

INSERT INTO public.sora_videos (
  id,
  prompt,
  video_url,
  thumbnail_url,
  duration_seconds,
  generated_by,
  created_at
) VALUES
  ('video-001-0000-0000-000000000001'::uuid,
   'Timelapse of a startup office from empty to bustling with activity, energetic music, modern aesthetic',
   'https://example.com/videos/startup-timelapse.mp4',
   'https://example.com/videos/startup-timelapse-thumb.jpg',
   45, :admin_id::uuid, NOW() - INTERVAL '20 days'),

  ('video-002-0000-0000-000000000002'::uuid,
   'Animated explainer video: How Kubernetes orchestrates containers, educational, clear graphics',
   'https://example.com/videos/kubernetes-explainer.mp4',
   'https://example.com/videos/kubernetes-explainer-thumb.jpg',
   120, :admin_id::uuid, NOW() - INTERVAL '18 days'),

  ('video-003-0000-0000-000000000003'::uuid,
   'Customer testimonial video: Founder talking about product success, professional quality, 60-second duration',
   'https://example.com/videos/testimonial.mp4',
   'https://example.com/videos/testimonial-thumb.jpg',
   60, :admin_id::uuid, NOW() - INTERVAL '16 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. NEWSLETTER SOURCES
-- =====================================================

INSERT INTO public.newsletter_sources (
  id,
  source_name,
  rss_url,
  category,
  is_active,
  created_at
) VALUES
  ('news-src-001-0000-0000-000000000001'::uuid, 'TechCrunch', 'https://feeds.techcrunch.com/feed', 'tech', true, NOW()),
  ('news-src-002-0000-0000-000000000002'::uuid, 'The Verge', 'https://feeds.theverge.com/feed', 'tech', true, NOW()),
  ('news-src-003-0000-0000-000000000003'::uuid, 'Morning Brew', 'https://feeds.morningbrew.com/feed', 'business', true, NOW()),
  ('news-src-004-0000-0000-000000000004'::uuid, 'Startup News', 'https://feeds.startupstoday.com/feed', 'startups', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. CONTENT PERFORMANCE METRICS
-- =====================================================

INSERT INTO public.content_performance_metrics (
  id,
  content_id,
  content_type,
  views,
  clicks,
  engagement_rate,
  shares,
  comments,
  conversion_rate,
  measured_at,
  created_at
) VALUES
  ('perf-001-0000-0000-000000000001'::uuid, 'lpost-001-0000-0000-000000000001'::uuid, 'linkedin_post',
   2450, 180, 0.073, 45, 28, 0.012, NOW(), NOW()),

  ('perf-002-0000-0000-000000000002'::uuid, 'lpost-002-0000-0000-000000000002'::uuid, 'linkedin_post',
   3120, 265, 0.085, 72, 52, 0.018, NOW(), NOW()),

  ('perf-003-0000-0000-000000000003'::uuid, 'blog-001-0000-0000-000000000001'::uuid, 'blog_post',
   5840, 420, 0.072, 180, 34, 0.025, NOW(), NOW()),

  ('perf-004-0000-0000-000000000004'::uuid, 'blog-002-0000-0000-000000000002'::uuid, 'blog_post',
   4210, 310, 0.074, 140, 45, 0.021, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_generated_posts_leader_id ON public.generated_posts(leader_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_agent_id ON public.generated_posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_created_at ON public.generated_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_brand_id ON public.seo_blog_content(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_author_id ON public.seo_blog_content(author_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_images_created_at ON public.ai_generated_images(created_at);
CREATE INDEX IF NOT EXISTS idx_sora_videos_created_at ON public.sora_videos(created_at);
CREATE INDEX IF NOT EXISTS idx_content_performance_metrics_content_id ON public.content_performance_metrics(content_id);

-- =====================================================
-- Summary
-- =====================================================
-- Phase 2 complete. The following content data has been seeded:
--
-- ✅ LinkedIn Posts: 10 sample posts (from 18 agents)
-- ✅ SEO Blog Content: 3 comprehensive blog posts
-- ✅ AI-Generated Images: 5 sample images
-- ✅ Sora Videos: 3 sample videos
-- ✅ Newsletter Sources: 4 RSS feed sources
-- ✅ Content Performance Metrics: Performance tracking for content
--
-- Total Records: ~30 records across ~8 tables
-- Ready for Phase 3: Project and Client Management
-- =====================================================
