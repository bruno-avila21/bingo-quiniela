import { createClient } from '@/lib/supabase/server'
import { GameBanner } from '@/components/game-banner'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, cards(count)')
    .in('status', ['active', 'line_won'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const cardsSold = (game as any)?.cards?.[0]?.count ?? 0

  return (
    <main className="min-h-screen bg-[#f5f0e8] p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-[#5c4a2a] text-center mb-6">
        Bingo Quiniela
      </h1>

      {game ? (
        <>
          <GameBanner
            jackpot={game.jackpot_amount}
            lineAmount={game.line_amount}
            cardsSold={cardsSold}
            cardPrice={game.card_price}
          />
          <div className="mt-6 text-center">
            <Link href="/comprar"
              className="inline-block bg-[#8b7355] text-white px-8 py-3 rounded-xl font-bold text-lg">
              Comprar cartón
            </Link>
          </div>
          <div className="mt-6 bg-white rounded-xl border border-[#e8dcc8] p-4">
            <h2 className="font-bold text-[#5c4a2a] mb-2">¿Cómo funciona?</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Comprás un cartón con números del 1 al 90</li>
              <li>Cada noche se valida con la quiniela nocturna</li>
              <li>Lunes y martes: Nacional + Provincial. Miércoles a viernes: solo Nacional</li>
              <li>Ganás por línea (10% del pozo) o cartón completo (90% del pozo)</li>
              <li>Si nadie gana, el pozo acumula para la semana siguiente</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 mt-12">
          <p>No hay juego activo esta semana. Volvé pronto.</p>
        </div>
      )}
    </main>
  )
}
