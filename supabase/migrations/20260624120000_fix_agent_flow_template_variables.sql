-- Fix incorrect LLM output template variables in saved agent flows.
-- LLM nodes output { result, model, provider } — not .text or .output.
-- Replaces {{nX.text}} and {{nX.output}} with {{nX.result}} in flow_json.

UPDATE public.agent_versions
SET flow_json = regexp_replace(
  regexp_replace(
    flow_json::text,
    '\{\{([a-zA-Z0-9_]+)\.text\}\}',
    '{{\1.result}}',
    'g'
  ),
  '\{\{([a-zA-Z0-9_]+)\.output\}\}',
  '{{\1.result}}',
  'g'
)::jsonb
WHERE flow_json::text ~ '\{\{[a-zA-Z0-9_]+\.(text|output)\}\}';
