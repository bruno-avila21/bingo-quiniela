import { createServiceClient } from '@/lib/supabase/server'
import { generateCard } from '@/lib/game/card-generator'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json() as {
    quantity: number
    email: string
    userId?: string
    paymentMethod: 'mercadopago' | 'transfer'
    gameId: string
  }

  const { quantity, email, userId, paymentMethod, gameId } = body

  if (!quantity || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
  }

  const cards = Array.from({ length: quantity }, () => {
    const card = generateCard()
    return {
      game_id: gameId,
      user_id: userId ?? null,
      user_email: email,
      numbers: card.numbers,
      rows: card.rows,
      paid: false,
      payment_method: paymentMethod,
    }
  })

  const { data: insertedCards, error } = await supabase
    .from('cards')
    .insert(cards)
    .select('id, numbers')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cards: insertedCards })
}
