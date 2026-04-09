import { createClient } from '@/lib/supabase/server'

async function markPaid(winnerId: string) {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await supabase
    .from('winners')
    .update({ paid_out: true, paid_at: new Date().toISOString() })
    .eq('id', winnerId)
}

export default async function GanadoresPage() {
  const supabase = await createClient()

  const { data: winners } = await supabase
    .from('winners')
    .select('*, cards(user_email)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Ganadores</h1>
      <div className="space-y-3">
        {winners?.map(w => (
          <div key={w.id} className="bg-white rounded-xl border border-[#e8dcc8] p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#5c4a2a]">
                {w.prize_type === 'full' ? 'Bingo completo' : 'Línea'}
              </p>
              <p className="text-sm text-gray-500">{(w.cards as any)?.user_email}</p>
              <p className="text-sm font-bold">${w.amount.toLocaleString('es-AR')}</p>
            </div>
            <div>
              {w.paid_out ? (
                <span className="text-green-600 text-sm font-medium">Pagado</span>
              ) : (
                <form action={markPaid.bind(null, w.id)}>
                  <button type="submit"
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">
                    Marcar pagado
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {!winners?.length && <p className="text-gray-500">No hay ganadores aún.</p>}
      </div>
    </div>
  )
}
