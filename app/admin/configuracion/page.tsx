'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ConfigPage() {
  const supabase = createClient()
  const [config, setConfig] = useState({ card_price: 2000, commission_pct: 20, cbu: '', alias: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('config').select('*').single().then(({ data }) => {
      if (data) setConfig(data)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('config').update({
      card_price: config.card_price,
      commission_pct: config.commission_pct,
      cbu: config.cbu,
      alias: config.alias,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Configuración</h1>
      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-xl border border-[#e8dcc8] p-6">
        {[
          { label: 'Precio del cartón ($)', key: 'card_price', type: 'number' },
          { label: 'Comisión (%)', key: 'commission_pct', type: 'number' },
          { label: 'CBU', key: 'cbu', type: 'text' },
          { label: 'Alias', key: 'alias', type: 'text' },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-[#5c4a2a] mb-1">{field.label}</label>
            <input type={field.type}
              value={(config as any)[field.key]}
              onChange={e => setConfig(prev => ({ ...prev, [field.key]: field.type === 'number' ? +e.target.value : e.target.value }))}
              className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
          </div>
        ))}
        <button type="submit" className="bg-[#8b7355] text-white px-6 py-2 rounded-lg">
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
