import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = [
  'https://monneracomercial.lovable.app',
  'https://id-preview--f527c8a3-53da-435f-bfb4-b16618ca0a4f.lovable.app',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  console.log('Request method:', req.method)
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const verifyAdmin = async () => {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Não autorizado')

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user } } = await supabaseUser.auth.getUser()
      if (!user) throw new Error('Não autorizado')

      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (!adminRole) throw new Error('Acesso negado')
      return user
    }

    if (req.method === 'GET') {
      await verifyAdmin()

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('data_criacao', { ascending: false })

      const { data: allRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers()

      const result = (profiles || []).map((p: any) => {
        const authUser = authUsers.find((u: any) => u.id === p.user_id)
        const userRole = (allRoles || []).find((r: any) => r.user_id === p.user_id)
        return {
          ...p,
          email: authUser?.email,
          nivel_acesso: (userRole as any)?.role
        }
      })

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { email, nome, telefone, nivel_acesso, setup, password, redirect_url } = body

      if (!email || !nome || !nivel_acesso) {
        return new Response(JSON.stringify({ error: 'Campos obrigatórios: email, nome, nivel_acesso' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (setup) {
        return new Response(JSON.stringify({ error: 'Configuração inicial desabilitada.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Normal flow: admin creates user via invite
      await verifyAdmin()
      console.log('Creating user via invite:', email, nome, nivel_acesso)

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirect_url || undefined
      })

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const newUserId = inviteData.user.id

      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        user_id: newUserId,
        nome,
        telefone: telefone || null,
        primeiro_acesso: true
      })

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await supabaseAdmin.from('user_roles').insert({
        user_id: newUserId,
        role: nivel_acesso
      })

      return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'DELETE') {
      await verifyAdmin()

      const { user_id } = await req.json()
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    const status = error.message === 'Não autorizado' ? 401
      : error.message === 'Acesso negado' ? 403 : 500
    return new Response(JSON.stringify({ error: error.message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
