import { createClient } from '@/lib/supabase/server'
import { BuyForm } from '@/components/buy-form'
import { redirect } from 'next/navigation'

export default async function ComprarPage() {
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('id, card_price')
    .in('status', ['active', 'line_won'])
    .single()

  if (!game) redirect('/')

  const { data: config } = await supabase
    .from('config')
    .select('cbu, alias')
    .single()

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Comprar cartones</h1>
      <BuyForm
        gameId={game.id}
        cardPrice={game.card_price}
        cbu={config?.cbu ?? ''}
        alias={config?.alias ?? ''}
      />
    </main>
  )
}
