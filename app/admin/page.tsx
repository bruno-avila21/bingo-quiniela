import { createClient } from '@/lib/supabase/server'
import { NewGameButton } from './new-game-button'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, cards(count)')
    .eq('status', 'active')
    .single()

  const { count: pendingTransfers } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('method', 'transfer')
    .eq('status', 'pending')

  const totalCards = (game as any)?.cards?.[0]?.count ?? 0
  const revenue = totalCards * (game?.card_price ?? 2000)
  const adminCut = revenue * ((game?.commission_pct ?? 20) / 100)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Pozo (bingo)', value: `$${(game?.jackpot_amount ?? 0).toLocaleString('es-AR')}` },
          { label: 'Premio línea', value: `$${(game?.line_amount ?? 0).toLocaleString('es-AR')}` },
          { label: 'Cartones vendidos', value: totalCards },
          { label: 'Tu ganancia', value: `$${adminCut.toLocaleString('es-AR')}` },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-[#e8dcc8]">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-[#5c4a2a] mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      {(pendingTransfers ?? 0) > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-medium text-amber-800">
            {pendingTransfers} transferencia(s) pendiente(s) de aprobación
          </p>
          <a href="/admin/pagos" className="text-amber-600 underline text-sm">Ver pagos →</a>
        </div>
      )}
      <NewGameButton />
    </div>
  )
}
