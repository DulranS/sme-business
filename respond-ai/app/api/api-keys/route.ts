import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// Create the api_keys table if it doesn't exist
async function ensureTableExists() {
  const { error } = await supabaseAdmin.rpc('create_api_keys_table', {})
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating table:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key_name, key_value, service } = body

    if (!key_name || !key_value || !service) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await ensureTableExists()

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert([
        {
          user_id: session.user.id,
          key_name,
          key_value,
          service,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
