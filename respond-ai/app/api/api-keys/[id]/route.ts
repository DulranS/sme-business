import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', params.id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
