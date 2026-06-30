# n8n + Google Analytics Integration Setup Guide

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

## Overview

This guide walks through setting up an n8n workflow to automatically fetch Google Analytics data and send it to your SJ Marketing AI platform via webhooks.

## Prerequisites

- Active n8n account (self-hosted or cloud)
- Google Analytics account with API access
- Access to SJ Marketing AI Admin Panel
- Brand configured in the platform

## Step 1: Generate Webhook Credentials

1. Log in to SJ Marketing AI Admin Panel
2. Navigate to **Admin** → **Integration Manager**
3. Go to the **Brand Integrations** tab
4. Find "n8n + Google Analytics" card
5. Click **Configure** and select your brand
6. Click **Generate Webhook**
7. Copy the **Webhook URL** and **Webhook Secret**

## Step 2: Set Up Google Analytics API Access

1. Enable Google Analytics Data API in Google Cloud Console
2. Create Service Account credentials
3. Download the JSON key file
4. Grant Analytics Viewer permissions to service account

## Step 3: Create n8n Workflow

Configure these nodes:
1. **Schedule Trigger** - Daily at midnight
2. **Google Analytics** - Fetch metrics
3. **Transform Data** - Format for webhook
4. **HTTP Request** - Send to SJ Marketing AI

## Payload Structure

```json
{
  "data_type": "traffic",
  "date_range_start": "2024-01-01",
  "date_range_end": "2024-01-31",
  "metrics": {
    "sessions": 15000,
    "users": 12000,
    "pageviews": 45000,
    "bounce_rate": 45.5,
    "avg_session_duration": 180,
    "conversions": 250
  },
  "dimensions": {
    "source": ["organic", "direct", "referral"],
    "device": ["desktop", "mobile", "tablet"]
  }
}
```

### Supported Data Types

- `traffic` - Website traffic metrics
- `conversions` - Conversion and goal data
- `demographics` - User demographics
- `behavior` - User behavior patterns
- `acquisition` - Traffic source and campaigns

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Invalid webhook secret | Verify secret matches exactly |
| Integration not configured | Ensure webhook was generated |
| Rate limit exceeded | Max 100 requests per minute per brand |
| Missing data | Check payload structure |

## Related Files

### Edge Function
- `supabase/functions/n8n-analytics-manage/index.ts`

### Frontend
- `src/pages/admin/IntegrationManager.tsx`
- `src/components/brands/N8nAnalyticsPanel.tsx`

### Database Tables
- `brand_analytics_integrations`
- `brand_analytics_data`
