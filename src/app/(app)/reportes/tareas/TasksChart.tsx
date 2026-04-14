'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const STATUS_COLORS = ['#e5e7eb','#bfdbfe','#fde68a','#bbf7d0','#e9d5ff']
const PRIORITY_COLORS = ['#e5e7eb','#bfdbfe','#fde68a','#fca5a5']

export default function TasksChart({ byStatus, byPriority, byClient, total }: {
  byStatus: { name: string; value: number }[]
  byPriority: { name: string; value: number }[]
  byClient: { name: string; value: number }[]
  total: number
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Total tareas</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">En proceso</p>
          <p className="text-2xl font-bold text-amber-500">{byStatus.find(s => s.name === 'En proceso')?.value ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">Terminadas</p>
          <p className="text-2xl font-bold text-green-500">{byStatus.find(s => s.name === 'Terminado')?.value ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-4">Por estado</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                {byStatus.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} stroke="#f3f4f6" strokeWidth={2}/>)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-4">Por prioridad</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                {byPriority.map((_, i) => <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} stroke="#f3f4f6" strokeWidth={2}/>)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-4">Tareas por cliente</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byClient} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#1f2937" radius={[4,4,0,0]} name="Tareas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
