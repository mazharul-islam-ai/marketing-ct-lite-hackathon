import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const demoUsers = [
      { email: 'demo.admin@sjinnovation.com', password: 'demo-password-123', first_name: 'Demo', last_name: 'Admin', role: 'super_admin' },
      { email: 'demo.pm@sjinnovation.com', password: 'demo-password-123', first_name: 'Demo', last_name: 'PM', role: 'pm' },
      { email: 'demo.brand.manager@sjinnovation.com', password: 'demo-password-123', first_name: 'Demo', last_name: 'BrandMgr', role: 'brand_manager' },
      { email: 'demo.user@sjinnovation.com', password: 'demo-password-123', first_name: 'Demo', last_name: 'User', role: 'user' },
      { email: 'demo.manager@sjinnovation.com', password: 'demo-password-123', first_name: 'Demo', last_name: 'Manager', role: 'manager' },
    ]

    const createdUsers: { id: string; email: string; role: string }[] = []

    for (const user of demoUsers) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existing = existingUsers?.users?.find(u => u.email === user.email)
      
      let userId: string

      if (existing) {
        userId = existing.id
        console.log(`User ${user.email} already exists with id ${userId}`)
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        })
        if (error) throw new Error(`Failed to create ${user.email}: ${error.message}`)
        userId = data.user.id
        console.log(`Created user ${user.email} with id ${userId}`)
      }

      // Upsert into public.users
      await supabase.from('users').upsert({
        id: userId,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        status: 'active',
      }, { onConflict: 'id' })

      // Upsert role
      const { error: roleError } = await supabase.from('user_roles').upsert({
        user_id: userId,
        role: user.role,
      }, { onConflict: 'user_id' })

      if (roleError) {
        // Try insert if upsert fails (no unique constraint on user_id alone)
        await supabase.from('user_roles').insert({
          user_id: userId,
          role: user.role,
        })
      }

      createdUsers.push({ id: userId, email: user.email, role: user.role })
    }

    return new Response(JSON.stringify({ success: true, users: createdUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
