# SEO Hub API Contract

Frontend integration point for Pritesh's `seo-hub-api` edge function.

## Enable live API

Set `VITE_SEO_HUB_API_ENABLED=true` in `.env` once the edge function is deployed.

## Types

All TypeScript interfaces live in `src/features/seo-hub/types.ts`.

## Actions

### `get_summary`

**Request:**
```json
{ "action": "get_summary", "brand_id": "optional-uuid" }
```

**Response:**
```json
{
  "latestScanScore": 78,
  "keywordCount": 42,
  "backlinkCount": 156,
  "reportsThisMonth": 5,
  "lastScanDate": "2026-06-01T12:00:00Z",
  "isDemo": false
}
```

### `list_reports`

**Request:**
```json
{ "action": "list_reports", "brand_id": "optional-uuid", "limit": 50 }
```

**Response:**
```json
{
  "reports": [
    {
      "id": "uuid",
      "brand_id": "uuid",
      "brand_name": "Acme Corp",
      "brand_slug": "acme-corp",
      "tool_type": "site_audit",
      "title": "Site Audit — acme.com",
      "score": 78,
      "status": "completed",
      "input_value": "https://acme.com",
      "result_summary": "Summary text",
      "created_at": "2026-06-01T12:00:00Z",
      "result_url": "/brands/acme-corp/seo/workspace"
    }
  ]
}
```

### `save_report`

**Request:**
```json
{
  "action": "save_report",
  "brand_id": "uuid",
  "tool_type": "site_audit",
  "title": "Site Audit — acme.com",
  "score": 78,
  "input_value": "https://acme.com",
  "result_summary": "Summary text",
  "result_url": "/brands/acme-corp/seo/workspace"
}
```

**Response:** `{ "success": true, "id": "uuid" }`

### `check_backlinks`

**Request:**
```json
{ "action": "check_backlinks", "brand_id": "uuid", "domain": "acme.com" }
```

**Response:**
```json
{
  "backlinks": [
    {
      "source_domain": "example.com",
      "target_url": "https://acme.com/page",
      "link_type": "dofollow",
      "anchor_text": "Acme",
      "domain_rating": 65
    }
  ]
}
```

## Frontend entry points

| File | Purpose |
|------|---------|
| `src/features/seo-hub/api.ts` | All invoke + mock fallback logic |
| `src/features/seo-hub/hooks/useSEOSummary.ts` | Dashboard + hub overview |
| `src/features/seo-hub/hooks/useSEOSavedReports.ts` | Saved reports list |

## Suggested DB table: `seo_saved_reports`

| Column | Type |
|--------|------|
| id | uuid PK |
| brand_id | uuid FK |
| user_id | uuid FK |
| tool_type | text |
| title | text |
| score | int nullable |
| status | text |
| input_value | text |
| result_summary | text nullable |
| result_url | text nullable |
| created_at | timestamptz |
