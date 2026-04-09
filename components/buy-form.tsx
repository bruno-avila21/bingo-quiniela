'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function BuyForm({ gameId, cardPrice, cbu, alias }: {
  gameId: string
  cardPrice: number
  cbu: string
  alias: string
}) {
  const supabase = createClient()
  const [quantity, setQuantity] = useState(1)
  const [method, setMethod] = useState<'mercadopago' | 'transfer'>('mercadopago')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form')
  const [cards, setCards] = useState<{ id: string; numbers: number[] }[]>([])

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/cards/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity,
        email: user?.email ?? email,
        userId: user?.id,
        paymentMethod: method,
        gameId,
      }),
    })
    const data = await res.json()
    setCards(data.cards)

    if (method === 'mercadopago') {
      const mpRes = await fetch('/api/payments/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: data.cards.map((c: { id: string }) => c.id),
          quantity,
          unitPrice: cardPrice,
          payerEmail: user?.email ?? email,
          externalReference: data.cards.map((c: { id: string }) => c.id).join(','),
        }),
      })
      const { initPoint } = await mpRes.json()
      window.location.href = initPoint
    } else {
      setStep('paying')
    }
  }

  if (step === 'paying') {
    return (
      <div className="bg-white rounded-xl border border-[#e8dcc8] p-6">
        <h2 className="font-bold text-[#5c4a2a] mb-4">Transferí el pago</h2>
        <p className="text-sm text-gray-600 mb-2">
          Total: <strong>${(quantity * cardPrice).toLocaleString('es-AR')}</strong>
        </p>
        <p className="text-sm">CBU: <strong>{cbu}</strong></p>
        <p className="text-sm">Alias: <strong>{alias}</strong></p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">
            Subí el comprobante
          </label>
          <input type="file" accept="image/*"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.append('comprobante', file)
              fd.append('cardIds', cards.map(c => c.id).join(','))
              fd.append('gameId', gameId)
              await fetch('/api/payments/transfer', { method: 'POST', body: fd })
              setStep('done')
            }}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
          />
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="bg-white rounded-xl border border-[#e8dcc8] p-6 text-center">
        <h2 className="font-bold text-[#5c4a2a] text-xl">¡Comprobante recibido!</h2>
        <p className="text-gray-600 mt-2">Tu cartón se activará cuando aprobemos el pago. Te avisamos por email.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleBuy} className="bg-white rounded-xl border border-[#e8dcc8] p-6 space-y-4">
      <h2 className="font-bold text-[#5c4a2a] text-xl">Comprá tu cartón</h2>
      <div>
        <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Cantidad</label>
        <input type="number" min={1} max={100} value={quantity}
          onChange={e => setQuantity(+e.target.value)}
          className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
        <p className="text-sm text-gray-500 mt-1">
          Total: ${(quantity * cardPrice).toLocaleString('es-AR')}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Método de pago</label>
        <div className="flex gap-3">
          {(['mercadopago', 'transfer'] as const).map(m => (
            <button key={m} type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                ${method === m
                  ? 'bg-[#8b7355] text-white border-[#8b7355]'
                  : 'bg-white text-[#5c4a2a] border-[#d4c5a9]'
                }`}>
              {m === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'}
            </button>
          ))}
        </div>
      </div>
      <input type="email" placeholder="Tu email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
        required />
      <button type="submit"
        className="w-full bg-[#8b7355] text-white py-3 rounded-xl font-bold">
        Comprar
      </button>
    </form>
  )
}
