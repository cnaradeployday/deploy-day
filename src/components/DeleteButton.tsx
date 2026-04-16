'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'

interface Props {
  table: string
  id: string
  redirectTo: string
  confirmMessage?: string
}

export default function DeleteButton({ table, id, redirectTo, confirmMessage }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const msg = confirmMessage ?? '¿Eliminar este elemento? Esta acción no se puede deshacer.'
    if (!confirm(msg)) return
    setLoading(true)
    const { error } = await createClient().from(table).delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      setLoading(false)
      return
    }
    router.push(redirectTo)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Eliminar"
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  )
}
