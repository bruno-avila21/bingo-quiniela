import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const authSupabase = await createClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { numbers, source, date } = await request.json() as {
    numbers: number[]
    source: 'nacional' | 'provincial'
    date: string
  }

  const invalid = numbers.filter(n => n < 1 || n > 90)
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Números inválidos: ${invalid.join(', ')}` }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) return NextResponse.json({ error: 'No hay juego activo' }, { status: 404 })

  await supabase.from('drawn_numbers').upsert(
    numbers.map(n => ({
      game_id: game.id,
      number: n,
      source,
      draw_date: date,
    })),
    { onConflict: 'game_id,number,source,draw_date' }
  )

  await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/draw`,
    { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }
  )

  return NextResponse.json({ ok: true })
}
