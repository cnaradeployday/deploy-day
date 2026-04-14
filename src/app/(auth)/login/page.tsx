'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0a0a0a] p-12">
        <Image src="/logo.jpeg" alt="Deploy Day" width={160} height={48} className="object-contain rounded-lg" />
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <Image src="/mascota.jpeg" alt="Deploy Day mascot" width={280} height={280} className="object-contain rounded-2xl" />
        </div>
        <p className="text-gray-600 text-sm">Sistema de gestión de proyectos y tareas</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image src="/logo.jpeg" alt="Deploy Day" width={140} height={42} className="object-contain rounded-lg" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Bienvenido</h1>
            <p className="text-gray-400 text-sm mt-1">Ingresá a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@deployday.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
