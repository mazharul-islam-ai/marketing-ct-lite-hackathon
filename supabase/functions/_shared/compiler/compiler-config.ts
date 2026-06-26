import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { CompilerMode } from './types.ts'

export async function loadCompilerMode(
  supabase: ReturnType<typeof createClient>,
): Promise<{ mode: CompilerMode; repair_max_attempts: number }> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('config')
    .eq('integration_type', 'agent_builder_compiler')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const cfg = (data?.config ?? {}) as { mode?: string; repair_max_attempts?: number }
  const mode = cfg.mode === 'multi_stage' ? 'multi_stage' : 'single'
  return {
    mode,
    repair_max_attempts: typeof cfg.repair_max_attempts === 'number' ? cfg.repair_max_attempts : 2,
  }
}

export async function saveCompilerMode(
  supabase: ReturnType<typeof createClient>,
  mode: CompilerMode,
  repairMaxAttempts = 2,
): Promise<void> {
  const { data: existing } = await supabase
    .from('organization_integrations')
    .select('id')
    .eq('integration_type', 'agent_builder_compiler')
    .limit(1)
    .maybeSingle()

  const config = { mode, repair_max_attempts: repairMaxAttempts }

  if (existing?.id) {
    await supabase
      .from('organization_integrations')
      .update({ config, is_active: true })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('organization_integrations')
      .insert({
        integration_type: 'agent_builder_compiler',
        is_active: true,
        config,
      })
  }
}
