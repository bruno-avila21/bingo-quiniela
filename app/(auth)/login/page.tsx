'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/')
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#5c4a2a] mb-6">Iniciar sesión</h1>
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
            required
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-[#d4c5a9] rounded-lg px-3 py-2"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit"
            className="w-full bg-[#8b7355] text-white py-2 rounded-lg font-medium">
            Entrar
          </button>
        </form>
        <button onClick={handleGoogle}
          className="w-full mt-3 border border-[#d4c5a9] py-2 rounded-lg text-[#5c4a2a]">
          Continuar con Google
        </button>
        <p className="mt-4 text-center text-sm text-[#8b7355]">
          ¿No tenés cuenta? <a href="/registro" className="underline">Registrate</a>
        </p>
      </div>
    </main>
  )
}
