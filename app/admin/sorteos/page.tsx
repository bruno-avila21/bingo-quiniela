'use client'
import { useState } from 'react'

export default function SorteosPage() {
  const [numbers, setNumbers] = useState('')
  const [source, setSource] = useState<'nacional' | 'provincial'>('nacional')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = numbers.split(/[\s,]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
    const res = await fetch('/api/admin/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers: parsed, source, date }),
    })
    const data = await res.json()
    setMsg(res.ok ? '✅ Números cargados y cartones actualizados' : `❌ ${data.error}`)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Cargar sorteo manual</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-[#e8dcc8] p-6">
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">Fuente</label>
          <select value={source} onChange={e => setSource(e.target.value as 'nacional' | 'provincial')}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2">
            <option value="nacional">Nacional</option>
            <option value="provincial">Provincial</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5c4a2a] mb-1">
            Números (separados por coma o espacio)
          </label>
          <textarea value={numbers} onChange={e => setNumbers(e.target.value)}
            placeholder="7453, 2291, 9607, 0142, 8800"
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2 h-24" />
        </div>
        <button type="submit"
          className="bg-[#8b7355] text-white px-6 py-2 rounded-lg font-medium">
          Cargar sorteo
        </button>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </div>
  )
}
