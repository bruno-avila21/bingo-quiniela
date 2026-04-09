import { createServiceClient } from '@/lib/supabase/server'
import { getPayment, verifyWebhookSignature } from '@/lib/payments/mercadopago'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const signature = request.headers.get('x-signature')
  const requestId = request.headers.get('x-request-id')
  const body = await request.json() as { type: string; data: { id: string } }

  if (body.type !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  const dataId = body.data.id
  if (!verifyWebhookSignature(signature, requestId, dataId)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payment = await getPayment(dataId)
  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()
  const externalRef = payment.external_reference

  if (!externalRef) return NextResponse.json({ ok: true })

  const cardIds = externalRef.split(',')

  const { error: cardError } = await supabase
    .from('cards')
    .update({ paid: true, payment_ref: dataId })
    .in('id', cardIds)

  if (cardError) {
    return NextResponse.json({ error: cardError.message }, { status: 500 })
  }

  await supabase.from('payments').insert(
    cardIds.map(id => ({
      card_id: id,
      method: 'mercadopago',
      status: 'approved',
      mp_payment_id: dataId,
    }))
  )

  // Get game info to update jackpot
  const { data: cardData } = await supabase
    .from('cards')
    .select('game_id')
    .eq('id', cardIds[0])
    .single()

  if (cardData) {
    const { data: game } = await supabase
      .from('games')
      .select('id, card_price, commission_pct, jackpot_amount, line_amount')
      .eq('id', cardData.game_id)
      .single()

    if (game) {
      const contribution = game.card_price * (1 - game.commission_pct / 100)
      const totalContrib = contribution * cardIds.length
      await supabase.from('games').update({
        jackpot_amount: game.jackpot_amount + totalContrib * 0.9,
        line_amount: game.line_amount + totalContrib * 0.1,
      }).eq('id', game.id)
    }
  }

  return NextResponse.json({ ok: true })
}
