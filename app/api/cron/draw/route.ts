import { createServiceClient } from '@/lib/supabase/server'
import { fetchQuinielaResults } from '@/lib/game/scraper'
import { NextResponse } from 'next/server'

const DRAW_SOURCES_BY_DAY: Record<number, ('nacional' | 'provincial')[]> = {
  1: ['nacional', 'provincial'], // Monday
  2: ['nacional', 'provincial'], // Tuesday
  3: ['nacional'],               // Wednesday
  4: ['nacional'],               // Thursday
  5: ['nacional'],               // Friday
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date()
  const dayOfWeek = today.getDay()

  const sources = DRAW_SOURCES_BY_DAY[dayOfWeek]
  if (!sources) {
    return NextResponse.json({ ok: true, message: 'No draw today' })
  }

  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('status', 'active')
    .single()

  if (!game) {
    return NextResponse.json({ error: 'No active game' }, { status: 404 })
  }

  const drawnNumbers: number[] = []

  for (const source of sources) {
    const url = source === 'nacional'
      ? process.env.QUINIELA_NACIONAL_URL!
      : process.env.QUINIELA_PROVINCIAL_URL!

    let numbers: number[] = []
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        numbers = await fetchQuinielaResults({ date: today, source, scraperUrl: url })
        break
      } catch (err) {
        lastError = err
        if (attempt < 2) await new Promise(r => setTimeout(r, 5 * 60 * 1000))
      }
    }

    if (!numbers.length) {
      const { sendAdminAlert } = await import('@/lib/email/resend')
      await sendAdminAlert(`Scraper falló para ${source}: ${lastError}`)
      continue
    }

    const rows = numbers.map(n => ({
      game_id: game.id,
      number: n,
      source,
      draw_date: today.toISOString().split('T')[0],
    }))

    await supabase.from('drawn_numbers').upsert(rows, {
      onConflict: 'game_id,number,source,draw_date',
    })

    drawnNumbers.push(...numbers)
  }

  if (!drawnNumbers.length) {
    return NextResponse.json({ ok: false, message: 'No numbers drawn' })
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id, numbers, rows, user_email')
    .eq('game_id', game.id)
    .eq('paid', true)

  if (!cards?.length) {
    return NextResponse.json({ ok: true, drawn: drawnNumbers })
  }

  const cardIds = cards.map(c => c.id)

  // 1. Validate pending marks that match tonight's drawn numbers
  await supabase.from('card_marks')
    .update({ validated: true })
    .in('card_id', cardIds)
    .in('number', drawnNumbers)
    .eq('validated', false)

  // 2. Insert validated marks for numbers on cards that weren't marked at all
  const { data: existingMarks } = await supabase
    .from('card_marks')
    .select('card_id, number')
    .in('card_id', cardIds)
    .in('number', drawnNumbers)

  const existingSet = new Set((existingMarks ?? []).map(m => `${m.card_id}:${m.number}`))
  const newMarks: { card_id: string; number: number; validated: boolean }[] = []

  for (const card of cards) {
    for (const drawn of drawnNumbers) {
      if (
        (card.numbers as number[]).includes(drawn) &&
        !existingSet.has(`${card.id}:${drawn}`)
      ) {
        newMarks.push({ card_id: card.id, number: drawn, validated: true })
      }
    }
  }

  if (newMarks.length) {
    await supabase.from('card_marks').insert(newMarks)
  }

  // 3. Delete pending marks that don't match tonight's draw (wrong guesses)
  await supabase.from('card_marks')
    .delete()
    .in('card_id', cardIds)
    .not('number', 'in', `(${drawnNumbers.join(',')})`)
    .eq('validated', false)

  // Fetch all validated marks for winner detection
  const { data: validatedMarks } = await supabase
    .from('card_marks')
    .select('card_id, number')
    .in('card_id', cardIds)
    .eq('validated', true)

  const marksByCard = new Map<string, Set<number>>()
  validatedMarks?.forEach(m => {
    if (!marksByCard.has(m.card_id)) marksByCard.set(m.card_id, new Set())
    marksByCard.get(m.card_id)!.add(m.number)
  })

  const { data: gameData } = await supabase
    .from('games')
    .select('jackpot_amount, line_amount, status')
    .eq('id', game.id)
    .single()

  if (!gameData) return NextResponse.json({ ok: true, drawn: drawnNumbers })

  const { sendWinnerEmail } = await import('@/lib/email/resend')
  const lineWinners: string[] = []
  const fullWinners: string[] = []

  // Detect full card winners
  for (const card of cards) {
    const cardMarks = marksByCard.get(card.id) ?? new Set()
    const hasFull = (card.numbers as number[]).every(n => cardMarks.has(n))
    if (hasFull) fullWinners.push(card.id)
  }

  // Detect line winners only if game is still 'active'
  if (gameData.status === 'active') {
    for (const card of cards) {
      const cardRows = card.rows as (number | null)[][]
      if (!cardRows) continue
      const cardMarks = marksByCard.get(card.id) ?? new Set()
      const hasLine = cardRows.some(row =>
        row.filter((n): n is number => n !== null).every(n => cardMarks.has(n))
      )
      if (hasLine) lineWinners.push(card.id)
    }
  }

  // Pay out line winners
  if (lineWinners.length > 0 && gameData.status === 'active') {
    const share = gameData.line_amount / lineWinners.length
    await supabase.from('winners').insert(
      lineWinners.map(cardId => ({
        card_id: cardId,
        game_id: game.id,
        prize_type: 'line',
        amount: share,
      }))
    )
    await supabase.from('games').update({ status: 'line_won' }).eq('id', game.id)
    for (const cardId of lineWinners) {
      const card = cards.find(c => c.id === cardId)
      if (card) await sendWinnerEmail(card.user_email, 'line', share)
    }
  }

  // Pay out full card winners
  if (fullWinners.length > 0) {
    const share = gameData.jackpot_amount / fullWinners.length
    await supabase.from('winners').insert(
      fullWinners.map(cardId => ({
        card_id: cardId,
        game_id: game.id,
        prize_type: 'full',
        amount: share,
      }))
    )
    await supabase.from('games').update({ status: 'closed' }).eq('id', game.id)
    for (const cardId of fullWinners) {
      const card = cards.find(c => c.id === cardId)
      if (card) await sendWinnerEmail(card.user_email, 'full', share)
    }
  }

  return NextResponse.json({ ok: true, drawn: drawnNumbers, fullWinners, lineWinners })
}
