import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authSupabase = await createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action } = await request.json() as { action: 'approve' | 'reject' }
  const supabase = createServiceClient()
  const { id } = await params

  if (action === 'reject') {
    await supabase.from('payments')
      .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('card_id')
    .eq('id', id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('payments')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)

  const { data: card } = await supabase
    .from('cards')
    .update({ paid: true })
    .eq('id', payment.card_id)
    .select('game_id')
    .single()

  if (card) {
    const { data: game } = await supabase
      .from('games')
      .select('id, card_price, commission_pct, jackpot_amount, line_amount')
      .eq('id', card.game_id)
      .single()

    if (game) {
      const contribution = game.card_price * (1 - game.commission_pct / 100)
      await supabase.from('games').update({
        jackpot_amount: game.jackpot_amount + contribution * 0.9,
        line_amount: game.line_amount + contribution * 0.1,
      }).eq('id', game.id)
    }
  }

  return NextResponse.json({ ok: true })
}
