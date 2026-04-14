'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx'

export default function OcupacionChart({ chartData, users, colors }: {
  chartData: any[]
  users: { name: string; total: number }[]
  colors: string[]
}) {
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(users.map(u => ({ Colaborador: u.name, 'Total horas': u.total })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ocupación')
    XLSX.writeFile(wb, 'ocupacion-equipo.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {users.slice(0, 4).map((u, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 truncate">{u.name}</p>
            <p className="text-xl font-bold text-gray-900">{Math.round(u.total)}h</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700">Horas cargadas por mes</p>
          <button onClick={exportExcel} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Exportar Excel
          </button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {users.map((u, i) => (
              <Bar key={u.name} dataKey={u.name} stackId="a" fill={colors[i % colors.length]} radius={i === users.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="grid grid-cols-2 px-5 py-2 text-xs font-medium text-gray-400">
          <span>Colaborador</span><span>Total horas</span>
        </div>
        {users.map((u, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: colors[i % colors.length] }}/>
              <span className="text-sm text-gray-900">{u.name}</span>
            </div>
            <span className="text-sm font-medium text-gray-700">{Math.round(u.total)}h</span>
          </div>
        ))}
      </div>
    </div>
  )
}
