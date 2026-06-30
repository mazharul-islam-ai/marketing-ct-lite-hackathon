-- Check if control_tower_api_keys table exists and has records
SELECT 
  id,
  scopes,
  is_active,
  rate_limit_per_hour,
  created_at,
  last_used_at,
  CASE 
    WHEN api_key_encrypted IS NOT NULL THEN 'Key is encrypted (present)'
    ELSE 'Key is missing'
  END as key_status
FROM control_tower_api_keys
ORDER BY created_at DESC;
