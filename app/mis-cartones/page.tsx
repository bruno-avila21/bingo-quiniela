import { createClient } from '@/lib/supabase/server'
import { BingoCard } from '@/components/bingo-card'
import { redirect } from 'next/navigation'

export default async function MisCartonesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: game } = await supabase
    .from('games')
    .select('id')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
        <p className="text-[#8b7355]">No hay juego activo esta semana.</p>
      </main>
    )
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id, numbers, rows, paid')
    .eq('game_id', game.id)
    .eq('user_id', user.id)

  const { data: allMarks } = await supabase
    .from('card_marks')
    .select('card_id, number')
    .in('card_id', (cards ?? []).map(c => c.id))

  const marksByCard = new Map<string, number[]>()
  allMarks?.forEach(m => {
    if (!marksByCard.has(m.card_id)) marksByCard.set(m.card_id, [])
    marksByCard.get(m.card_id)!.push(m.number)
  })

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Mis cartones</h1>
      {!cards?.length && (
        <p className="text-[#8b7355]">No tenés cartones esta semana. <a href="/comprar" className="underline">Comprá uno</a>.</p>
      )}
      <div className="space-y-6">
        {cards?.map(card => (
          <div key={card.id}>
            {!card.paid && (
              <p className="text-amber-600 text-sm mb-1">Pendiente de aprobación</p>
            )}
            <BingoCard
              cardId={card.id}
              rows={card.rows as (number | null)[][]}
              initialMarks={marksByCard.get(card.id) ?? []}
              gameId={game.id}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
