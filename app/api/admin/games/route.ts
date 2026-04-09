import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const authSupabase = await createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Ya hay un juego activo' }, { status: 409 })
  }

  const { data: config } = await supabase
    .from('config')
    .select('card_price, commission_pct')
    .single()

  const { data: lastGame } = await supabase
    .from('games')
    .select('jackpot_amount, line_amount')
    .eq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const { data: newGame } = await supabase
    .from('games')
    .insert({
      week_start: monday.toISOString().split('T')[0],
      week_end: friday.toISOString().split('T')[0],
      status: 'active',
      jackpot_amount: lastGame?.jackpot_amount ?? 0,
      line_amount: lastGame?.line_amount ?? 0,
      card_price: config?.card_price ?? 2000,
      commission_pct: config?.commission_pct ?? 20,
    })
    .select()
    .single()

  return NextResponse.json({ game: newGame })
}
