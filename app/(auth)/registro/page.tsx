'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 text-center">
        <h2 className="text-xl font-bold text-[#5c4a2a]">¡Listo!</h2>
        <p className="text-[#8b7355] mt-2">Revisá tu email para confirmar la cuenta.</p>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Crear cuenta</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Nombre" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required />
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required />
          <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2" required minLength={6} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit"
            className="w-full bg-[#8b7355] text-white py-2 rounded-lg font-medium">
            Registrarme
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[#8b7355]">
          ¿Ya tenés cuenta? <Link href="/login" className="underline">Iniciá sesión</Link>
        </p>
      </div>
    </main>
  )
}
