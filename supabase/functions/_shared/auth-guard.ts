import { corsHeaders } from './cors.ts';

/**
 * Verify that the requesting user has one of the allowed roles.
 *
 * @param req - The incoming Request (reads the Authorization header)
 * @param supabase - A Supabase client initialised with the **service role key**
 * @param allowedRoles - Roles that are permitted to call this function
 * @returns The authenticated user object, or a Response to return early (401/403)
 */
// deno-lint-ignore no-explicit-any
export async function requireRole(
  req: Request,
  supabase: any,
  allowedRoles: string[],
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id);

  if (roleError || !userRoles || userRoles.length === 0) {
    console.error('Role verification error:', roleError);
    return new Response(
      JSON.stringify({ error: 'Unable to verify permissions' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const roles = userRoles.map((r: { role: string }) => r.role);
  if (!roles.some((role: string) => allowedRoles.includes(role))) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return { userId: userData.user.id };
}
