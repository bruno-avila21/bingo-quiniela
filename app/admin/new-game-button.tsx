'use client'

export function NewGameButton() {
  async function handleCreate() {
    if (!confirm('¿Crear nuevo juego para esta semana?')) return
    const res = await fetch('/api/admin/games', { method: 'POST' })
    const data = await res.json()
    if (res.ok) window.location.reload()
    else alert(data.error)
  }

  return (
    <button onClick={handleCreate}
      className="mt-4 bg-[#5c4a2a] text-white px-6 py-2 rounded-lg text-sm">
      Crear juego para esta semana
    </button>
  )
}
