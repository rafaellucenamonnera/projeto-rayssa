import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = [
  'https://monneracomercial.lovable.app',
]

function isAllowedOrigin(origin: string) {
  if (!origin) return false
  if (allowedOrigins.includes(origin)) return true
  if (origin.startsWith('https://')) return true
  if (origin.endsWith('.lovable.app')) return true
  if (origin.startsWith('http://localhost:')) return true
  if (origin.startsWith('http://127.0.0.1:')) return true
  return false
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

      const profileByUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]))
      const roleByUserId = new Map((allRoles || []).map((r: any) => [r.user_id, r.role]))

      const result = (authUsers || []).map((authUser: any) => {
        const p = profileByUserId.get(authUser.id)
        const role = roleByUserId.get(authUser.id) || 'usuario'
        const createdAt = p?.data_criacao || authUser?.created_at || null

        return {
          id: p?.id || authUser.id,
          user_id: authUser.id,
          nome: p?.nome || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Sem nome',
          telefone: p?.telefone || null,
          email: authUser?.email || null,
          nivel_acesso: role,
          role,
          ativo: typeof p?.ativo === 'boolean' ? p.ativo : true,
          status: typeof p?.ativo === 'boolean' ? (p.ativo ? 'ativo' : 'inativo') : 'ativo',
          primeiro_acesso: p?.primeiro_acesso ?? false,
          data_criacao: createdAt,
          created_at: createdAt,
        }
      }).sort((a: any, b: any) => {
        const aDate = a.data_criacao ? new Date(a.data_criacao).getTime() : 0
        const bDate = b.data_criacao ? new Date(b.data_criacao).getTime() : 0
        return bDate - aDate
      })

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { email, nome, telefone, nivel_acesso, setup, redirect_url } = body

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

    if (req.method === 'PATCH') {
      const body = await req.json()
      const { user_id, nome, telefone, nivel_acesso, ativo } = body || {}

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await verifyAdmin()

      const updates: Record<string, unknown> = {}
      if (typeof nome === 'string' && nome.trim()) updates.nome = nome.trim()
      if (telefone !== undefined) updates.telefone = telefone ? String(telefone).trim() : null
      if (typeof ativo === 'boolean') updates.ativo = ativo

      if (Object.keys(updates).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('user_id', user_id)

        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      if (typeof nivel_acesso === 'string' && nivel_acesso.trim()) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id, role: nivel_acesso.trim() }, { onConflict: 'user_id,role' })

        if (roleError) {
          return new Response(JSON.stringify({ error: roleError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .neq('role', nivel_acesso.trim())
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
