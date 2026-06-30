# Control Tower Meetings API Setup Guide

This guide explains how to configure the Control Tower Meetings API integration.

## Prerequisites

- Super Admin or Manager role access
- Control Tower API credentials (API key and Auth token)
- Access to Supabase dashboard

## Setup Steps

### 1. Configure Control Tower API Credentials

Set the following environment variables in your Supabase Edge Functions:

1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Add these two secrets:
   - Name: `CONTROL_TOWER_API_URL`
   - Value: `https://your-control-tower-project.supabase.co/functions/v1` (Control Tower Edge Functions URL)

   - Name: `CONTROL_TOWER_API_KEY`
   - Value: Your Control Tower API key (e.g., `sk_...`)
3. Click "Save" for each

**OR** use the Supabase CLI:

```bash
supabase secrets set CONTROL_TOWER_API_URL=https://your-control-tower-project.supabase.co/functions/v1
supabase secrets set CONTROL_TOWER_API_KEY=sk_your-control-tower-api-key
```

### 2. Verify Configuration

After setup, verify the configuration:

1. **Check Edge Function Logs:**
   ```bash
   supabase functions logs control-tower-proxy --limit 20
   ```

2. **Test API Connection:**
   - Open your app
   - Navigate to a project details page
   - Click "Meetings" tab
   - Click "Map Meeting" button
   - Check browser console for errors

### 3. Troubleshooting

#### Error: "Control Tower API configuration missing"

**Solution:** One or more environment variables are not set.

1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Verify both secrets are present:
   - `CONTROL_TOWER_API_URL`
   - `CONTROL_TOWER_API_KEY`
3. Redeploy the edge functions:
   ```bash
   supabase functions deploy control-tower-proxy
   supabase functions deploy control-tower-projects
   ```

#### Error: "Insufficient permissions"

**Solution:** Your user role doesn't have access to the Control Tower API.

Required roles: `pm`, `manager`, or `super_admin`

Check your role:
```sql
SELECT role FROM user_roles WHERE user_id = auth.uid();
```

#### Error: 500 Internal Server Error

**Possible causes:**
1. Incorrect API credentials → Verify `CONTROL_TOWER_API_KEY` has correct permissions
2. Control Tower API returned an error → Check API key has correct permissions
3. Network issues → Verify Control Tower API is accessible

**Check logs:**
```bash
supabase functions logs control-tower-proxy --limit 50
```

#### No Meetings Showing Up

**Solution:** Check the zoom_files table in Control Tower.

1. Verify the `zoom_files` table exists in Control Tower Supabase
2. Check that records have `deleted_at = null`
3. Verify the API key has read access to the `zoom_files` table

## API Endpoints Used

The integration uses these Control Tower Edge Function API endpoints:

- **Meetings (Zoom Files):**
  - `GET /api-v1-zoom-files?page=1&limit=20` - List meetings with pagination
  - Query filters: `search`, `project_id`, `client_id`
  - Response format: `{ status, data: { zoom_files: [...], pagination: {...} } }`

## Data Mapping

### Zoom Files → Meetings

The `zoom_files` table fields are mapped to the Meeting interface:

| Zoom Files Field      | Meeting Field    | Notes                           |
|-----------------------|------------------|---------------------------------|
| `id`                  | `id`             | Direct mapping                  |
| `meeting_topic`       | `title`          | Main meeting title              |
| `transcript_summary`  | `description`    | Meeting transcript/summary      |
| `meeting_start_time`  | `start_time`     | Meeting start timestamp         |
| `meeting_start_time`  | `end_time`       | End time not available, using start |
| `slug`                | `meeting_link`   | Zoom meeting slug               |
| -                     | `meeting_type`   | Hardcoded as "zoom"             |
| -                     | `location`       | Hardcoded as "Zoom"             |

## Security Notes

- API credentials are stored as Supabase secrets (never sent to client)
- All API calls require authentication
- Role-based access control (RBAC) enforced (manager or super_admin only)
- Control Tower API uses the API key for both `apikey` header and Bearer token authentication

## Support

If you continue to have issues:

1. Check Supabase Edge Function logs
2. Verify both environment variables are set correctly
3. Test API credentials with a direct curl request to Control Tower:
   ```bash
   curl "https://your-control-tower-project.supabase.co/functions/v1/api-v1-zoom-files?limit=5" \
     -H "Authorization: Bearer sk_your-api-key"
   ```
4. Contact your Control Tower administrator for API access

## Next Steps

After successful setup:

1. ✅ Navigate to Project Details page
2. ✅ Click "Meetings" tab
3. ✅ Click "Map Meeting" button
4. ✅ Browse and map meetings from Control Tower (Zoom files)
5. ✅ Meetings will be automatically added to project knowledge base
