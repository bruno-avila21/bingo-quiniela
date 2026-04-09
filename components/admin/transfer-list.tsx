'use client'
import { useState } from 'react'

interface Transfer {
  id: string
  card_id: string
  transfer_img_url: string
  created_at: string
}

export function TransferList({ transfers, storageUrl }: {
  transfers: Transfer[]
  storageUrl: string
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handle(id: string, action: 'approve' | 'reject') {
    setLoading(id)
    await fetch(`/api/admin/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(null)
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      {transfers.map(t => (
        <div key={t.id} className="bg-white rounded-xl border border-[#e8dcc8] p-4 flex gap-4 items-start">
          <img
            src={`${storageUrl}/${t.transfer_img_url}`}
            alt="Comprobante"
            className="w-32 h-32 object-cover rounded-lg border"
          />
          <div className="flex-1">
            <p className="text-sm text-gray-500">
              {new Date(t.created_at).toLocaleString('es-AR')}
            </p>
            <p className="text-sm font-mono text-gray-700 mt-1">Cartón: {t.card_id}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handle(t.id, 'approve')}
                disabled={loading === t.id}
                className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                Aprobar
              </button>
              <button
                onClick={() => handle(t.id, 'reject')}
                disabled={loading === t.id}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      ))}
      {transfers.length === 0 && (
        <p className="text-gray-500">No hay transferencias pendientes.</p>
      )}
    </div>
  )
}
