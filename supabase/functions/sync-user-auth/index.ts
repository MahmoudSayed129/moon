import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface SyncUserRequest {
  username: string
  password: string
  app_user_id: string
  role: 'super_admin' | 'supervisor' | 'employee'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { username, password, app_user_id, role } = await req.json() as SyncUserRequest

    // Create/get auth user using email-like username
    const email = `${username}@ravin.app`
    
    // Try to sign up (will fail if exists)
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, role }
    })

    let authUserId: string

    if (signUpError && signUpError.message.includes('already registered')) {
      // User exists, get their ID
      const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
      if (listError) throw listError
      
      const existingUser = users.find(u => u.email === email)
      if (!existingUser) throw new Error('User not found')
      
      authUserId = existingUser.id
      
      // Update password
      await supabaseClient.auth.admin.updateUserById(authUserId, { password })
    } else if (signUpError) {
      throw signUpError
    } else {
      authUserId = signUpData.user.id
    }

    // Update app users table with auth_id
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ auth_id: authUserId })
      .eq('id', app_user_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ auth_id: authUserId, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error syncing user:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
