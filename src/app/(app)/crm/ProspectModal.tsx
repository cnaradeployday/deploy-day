'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Currency, CURRENCIES } from '@/lib/utils/currency'
import { STAGES, STAGE_PROBABILITY, SERVICE_LABELS, SOURCES, Prospect, Stage, PROBABILITY_LEVELS, classifyProbability } from './constants'

const inputClass = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'
const labelClass = 'block text-xs text-gray-400 mb-1.5'

export default function ProspectModal({ prospect, clientes, usuarios, currentUserId, onClose, onSaved }: {
  prospect: Prospect | null
  clientes: { id: string; name: string }[]
  usuarios: { id: string; full_name: string }[]
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!prospect
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(prospect?.client_id ? 'existing' : 'new')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    client_id: prospect?.client_id ?? '',
    prospect_name: prospect?.prospect_name ?? '',
    project_name: prospect?.project_name ?? '',
    contact_email: prospect?.contact_email ?? '',
    contact_phone: prospect?.contact_phone ?? '',
    stage: (prospect?.stage ?? 'contacto_inicial') as Stage,
    probability: String(prospect?.probability ?? STAGE_PROBABILITY.contacto_inicial),
    expected_close_date: prospect?.expected_close_date ?? '',
    service_type: prospect?.service_type ?? 'otro',
    source: prospect?.source ?? '',
    responsible_id: prospect?.responsible_id ?? currentUserId,
    next_action: prospect?.next_action ?? '',
    next_action_date: prospect?.next_action_date ?? '',
    lost_reason: prospect?.lost_reason ?? '',
    notes: prospect?.notes ?? '',
    currency: (prospect?.currency ?? 'ARS') as Currency,
    one_shot_amount: prospect?.one_shot_amount != null ? String(prospect.one_shot_amount) : '',
    monthly_fee: prospect?.monthly_fee != null ? String(prospect.monthly_fee) : '',
    estimated_months: prospect?.estimated_months != null ? String(prospect.estimated_months) : '',
    estimated_hours: prospect?.estimated_hours != null ? String(prospect.estimated_hours) : '',
    hourly_rate_service: prospect?.hourly_rate_service != null ? String(prospect.hourly_rate_service) : '',
    quoting_hours: prospect?.quoting_hours != null ? String(prospect.quoting_hours) : '',
    quoting_hourly_rate: prospect?.quoting_hourly_rate != null ? String(prospect.quoting_hourly_rate) : '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleStageChange(stage: Stage) {
    setForm(f => ({ ...f, stage, probability: String(STAGE_PROBABILITY[stage]) }))
  }

  const suggestedAmount = form.estimated_hours && form.hourly_rate_service
    ? (parseFloat(form.estimated_hours) * parseFloat(form.hourly_rate_service))
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_name.trim()) {
      setError('Ingresá el nombre del proyecto')
      return
    }
    if (clientMode === 'new' && !form.prospect_name.trim()) {
      setError('Ingresá el nombre del prospecto')
      return
    }
    if (clientMode === 'existing' && !form.client_id) {
      setError('Seleccioná un cliente')
      return
    }
    setLoading(true)
    setError(null)
    const sb = createClient()
    const selectedClient = clientes.find(c => c.id === form.client_id)
    const payload = {
      client_id: clientMode === 'existing' ? form.client_id : null,
      prospect_name: clientMode === 'existing' ? (selectedClient?.name ?? '') : form.prospect_name.trim(),
      project_name: form.project_name.trim(),
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      stage: form.stage,
      probability: parseInt(form.probability, 10) || 0,
      expected_close_date: form.expected_close_date || null,
      service_type: form.service_type,
      source: form.source || null,
      responsible_id: form.responsible_id || null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      lost_reason: form.stage === 'perdido' ? (form.lost_reason || null) : null,
      notes: form.notes || null,
      currency: form.currency,
      one_shot_amount: form.one_shot_amount ? parseFloat(form.one_shot_amount) : null,
      monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : null,
      estimated_months: form.estimated_months ? parseInt(form.estimated_months, 10) : null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      hourly_rate_service: form.hourly_rate_service ? parseFloat(form.hourly_rate_service) : null,
      quoting_hours: form.quoting_hours ? parseFloat(form.quoting_hours) : null,
      quoting_hourly_rate: form.quoting_hourly_rate ? parseFloat(form.quoting_hourly_rate) : null,
    }
    const { error } = isEdit
      ? await sb.from('prospects').update(payload).eq('id', prospect!.id)
      : await sb.from('prospects').insert({ ...payload, created_by: currentUserId })
    setLoading(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{isEdit ? 'Editar prospecto' : 'Nuevo prospecto'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Nombre del proyecto *</label>
            <input type="text" value={form.project_name} onChange={e => set('project_name', e.target.value)}
              placeholder="Ej: Migración a AWS" className={inputClass}/>
          </div>

          {/* Cliente */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setClientMode('new')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${clientMode === 'new' ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-400 hover:bg-gray-50'}`}>
                Prospecto nuevo
              </button>
              <button type="button" onClick={() => setClientMode('existing')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${clientMode === 'existing' ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-400 hover:bg-gray-50'}`}>
                Cliente existente
              </button>
            </div>
            {clientMode === 'new' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Nombre / empresa *</label>
                  <input type="text" value={form.prospect_name} onChange={e => set('prospect_name', e.target.value)}
                    placeholder="Ej: Estudio Fernández" className={inputClass}/>
                </div>
                <div>
                  <label className={labelClass}>Email de contacto</label>
                  <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputClass}/>
                </div>
                <div>
                  <label className={labelClass}>Teléfono de contacto</label>
                  <input type="text" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={inputClass}/>
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Cliente *</label>
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputClass + ' bg-white'}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Etapa</label>
              <select value={form.stage} onChange={e => handleStageChange(e.target.value as Stage)} className={inputClass + ' bg-white'}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Probabilidad de cierre</label>
              <select value={classifyProbability(parseInt(form.probability, 10) || 0)}
                onChange={e => set('probability', String(PROBABILITY_LEVELS.find(l => l.key === e.target.value)!.value))}
                className={inputClass + ' bg-white'}>
                {PROBABILITY_LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cierre estimado</label>
              <input type="date" value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} className={inputClass}/>
            </div>
            <div>
              <label className={labelClass}>Tipo de servicio</label>
              <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className={inputClass + ' bg-white'}>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fuente</label>
              <input type="text" list="crm-sources" value={form.source} onChange={e => set('source', e.target.value)} className={inputClass}/>
              <datalist id="crm-sources">{SOURCES.map(s => <option key={s} value={s}/>)}</datalist>
            </div>
            <div>
              <label className={labelClass}>Responsable</label>
              <select value={form.responsible_id} onChange={e => set('responsible_id', e.target.value)} className={inputClass + ' bg-white'}>
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Próxima acción</label>
              <input type="text" value={form.next_action} onChange={e => set('next_action', e.target.value)}
                placeholder="Ej: Llamar para cerrar" className={inputClass}/>
            </div>
            <div>
              <label className={labelClass}>Fecha de seguimiento</label>
              <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} className={inputClass}/>
            </div>
            {form.stage === 'perdido' && (
              <div className="col-span-2">
                <label className={labelClass}>Motivo de pérdida</label>
                <input type="text" value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)}
                  placeholder="Precio, timing, eligió otro proveedor..." className={inputClass}/>
              </div>
            )}
          </div>

          {/* Valor del deal */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Valor del deal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Moneda</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputClass + ' bg-white'}>
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div/>
              <div>
                <label className={labelClass}>Importe one-shot</label>
                <input type="number" min="0" step="0.01" value={form.one_shot_amount} onChange={e => set('one_shot_amount', e.target.value)} className={inputClass}/>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelClass}>Fee mensual</label>
                  <input type="number" min="0" step="0.01" value={form.monthly_fee} onChange={e => set('monthly_fee', e.target.value)} className={inputClass}/>
                </div>
                <div className="w-24">
                  <label className={labelClass}>Meses</label>
                  <input type="number" min="0" value={form.estimated_months} onChange={e => set('estimated_months', e.target.value)} className={inputClass}/>
                </div>
              </div>
              <div>
                <label className={labelClass}>Horas estimadas del servicio</label>
                <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} className={inputClass}/>
              </div>
              <div>
                <label className={labelClass}>Valor hora del servicio</label>
                <input type="number" min="0" step="0.01" value={form.hourly_rate_service} onChange={e => set('hourly_rate_service', e.target.value)} className={inputClass}/>
              </div>
            </div>
            {suggestedAmount !== null && (
              <div className="mt-2 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Importe sugerido: {form.currency} {suggestedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <button type="button" onClick={() => set('one_shot_amount', String(suggestedAmount))}
                  className="text-xs text-[#1B9BF0] hover:underline">Usar como one-shot</button>
              </div>
            )}
          </div>

          {/* Costo de cotizar */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Costo de armar esta cotización (para ROI)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Horas invertidas en cotizar</label>
                <input type="number" min="0" step="0.5" value={form.quoting_hours} onChange={e => set('quoting_hours', e.target.value)} className={inputClass}/>
              </div>
              <div>
                <label className={labelClass}>Valor hora de quien cotiza</label>
                <input type="number" min="0" step="0.01" value={form.quoting_hourly_rate} onChange={e => set('quoting_hourly_rate', e.target.value)} className={inputClass}/>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={inputClass}/>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear prospecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
