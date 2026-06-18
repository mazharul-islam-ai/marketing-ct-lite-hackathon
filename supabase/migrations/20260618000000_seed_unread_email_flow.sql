-- Seed canonical unread-email summary flow for demo agent (if it exists)
-- Re-run safe: inserts new version only when agent exists

DO $$
DECLARE
  v_agent_id UUID := '9cc32d7c-f6ee-4512-aa97-630c007e6c22';
  v_next_version INT;
  v_version_id UUID;
  v_flow JSONB := '{
    "trigger": {
      "id": "n1",
      "type": "cron_trigger",
      "label": "Daily 8am",
      "config": { "schedule": "0 8 * * *" },
      "position": { "x": 0, "y": 200 }
    },
    "steps": [
      {
        "id": "n2",
        "type": "gmail_fetch_unread",
        "label": "Fetch Unread Emails",
        "config": { "max_results": 25 },
        "position": { "x": 200, "y": 200 }
      },
      {
        "id": "n3",
        "type": "condition",
        "label": "Has Unread?",
        "config": { "input_variable": "count", "operator": ">", "threshold": 0 },
        "position": { "x": 400, "y": 200 }
      },
      {
        "id": "n4",
        "type": "openai_llm",
        "label": "Summarize Emails",
        "config": {
          "model": "gpt-4o-mini",
          "system_prompt": "Summarize unread emails concisely.",
          "prompt": "Summarize: {{emails}}",
          "temperature": 0.3,
          "max_tokens": 1500
        },
        "position": { "x": 600, "y": 200 }
      },
      {
        "id": "n5",
        "type": "email_output",
        "label": "Send Summary",
        "config": { "to": "me@company.com", "subject": "Daily Unread Email Summary", "body": "{{summary}}" },
        "position": { "x": 800, "y": 200 }
      },
      {
        "id": "n6",
        "type": "report_generate",
        "label": "No Unread",
        "config": { "title": "No Unread Emails" },
        "position": { "x": 600, "y": 400 }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2" },
      { "id": "e2", "source": "n2", "target": "n3" },
      { "id": "e3", "source": "n3", "target": "n4", "condition": "YES" },
      { "id": "e4", "source": "n3", "target": "n6", "condition": "NO" },
      { "id": "e5", "source": "n4", "target": "n5" }
    ]
  }'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE id = v_agent_id) THEN
    RAISE NOTICE 'Agent % not found — skip seed', v_agent_id;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.agent_versions WHERE agent_id = v_agent_id;

  INSERT INTO public.agent_versions (agent_id, version, flow_json, published_by)
  VALUES (v_agent_id, v_next_version, v_flow, NULL)
  RETURNING id INTO v_version_id;

  UPDATE public.agents
  SET current_version_id = v_version_id, updated_at = NOW()
  WHERE id = v_agent_id;

  RAISE NOTICE 'Seeded unread email flow v% for agent %', v_next_version, v_agent_id;
END $$;
