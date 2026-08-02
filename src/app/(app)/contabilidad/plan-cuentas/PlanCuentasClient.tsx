'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, X } from 'lucide-react'

type Cuenta = {
  id: string
  categoria: 'activo' | 'pasivo' | 'patrimonio_neto' | 'resultado'
  subcategoria: string | null
  nombre: string
  orden: number
}

const CATEGORIAS: { value: Cuenta['categoria']; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'pasivo', label: 'Pasivo' },
  { value: 'patrimonio_neto', label: 'Patrimonio Neto' },
  { value: 'resultado', label: 'Resultado' },
]
const categoriaLabel = (c: string) => CATEGORIAS.find(x => x.value === c)?.label ?? c
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

export default function PlanCuentasClient({ cuentas }: { cuentas: Cuenta[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ categoria: 'activo' as Cuenta['categoria'], subcategoria: '', nombre: '', orden: '0' })

  function openNew() {
    setEditingId(null)
    setForm({ categoria: 'activo', subcategoria: '', nombre: '', orden: '0' })
    setShowForm(true)
  }

  function openEdit(c: Cuenta) {
    setEditingId(c.id)
    setForm({ categoria: c.categoria, subcategoria: c.subcategoria ?? '', nombre: c.nombre, orden: String(c.orden) })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const payload = {
      categoria: form.categoria,
      subcategoria: form.subcategoria.trim() || null,
      nombre: form.nombre.trim(),
      orden: parseInt(form.orden) || 0,
    }
    const { error } = editingId
      ? await sb.from('plan_cuentas').update(payload).eq('id', editingId)
      : await sb.from('plan_cuentas').insert(payload)
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    setEditingId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuenta? También se eliminarán sus saldos cargados.')) return
    setDeletingId(id)
    const { error } = await createClient().from('plan_cuentas').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  const grupos = useMemo(() => {
    const porCategoria = new Map<string, Cuenta[]>()
    for (const c of cuentas) {
      if (!porCategoria.has(c.categoria)) porCategoria.set(c.categoria, [])
      porCategoria.get(c.categoria)!.push(c)
    }
    return CATEGORIAS.map(cat => ({
      categoria: cat.value,
      label: cat.label,
      cuentas: (porCategoria.get(cat.value) ?? []).sort((a, b) => (a.subcategoria ?? '').localeCompare(b.subcategoria ?? '') || a.orden - b.orden),
    })).filter(g => g.cuentas.length)
  }, [cuentas])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">{editingId ? 'Editar cuenta' : 'Agregar cuenta'}</p>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Categoría</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Cuenta['categoria'] }))}
                  className={filterInputClass + ' bg-white'}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Subcategoría</label>
                <input type="text" value={form.subcategoria} onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}
                  placeholder="Ej: Gastos operativos (opcional)" className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nombre de la cuenta</label>
                <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Orden</label>
                <input type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
                  className={filterInputClass}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen size={18} className="text-[#1B9BF0]"/> Plan de cuentas
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Cuentas contables usadas en Balance Sheet y P&L</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/contabilidad/balance-sheet"
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            Balance Sheet
          </Link>
          <Link href="/contabilidad/estado-resultados"
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            P&amp;L
          </Link>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Agregar cuenta
          </button>
        </div>
      </div>

      {!cuentas.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin cuentas cargadas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(g => (
            <div key={g.categoria}>
              <p className="text-sm font-semibold text-gray-900 mb-2">{g.label}</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {g.cuentas.map((c, i) => (
                  <div key={c.id}
                    className={'grid grid-cols-[1fr_1fr_auto] px-5 py-3 items-center hover:bg-gray-50 ' + (i !== g.cuentas.length - 1 ? 'border-b border-gray-50' : '')}>
                    <span className="text-sm text-gray-900">{c.nombre}</span>
                    <span className="text-xs text-gray-400">{c.subcategoria ?? '—'}</span>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Pencil size={13}/>
                      </button>
                      <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
