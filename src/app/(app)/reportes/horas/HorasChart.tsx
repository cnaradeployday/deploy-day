'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import * as XLSX from 'xlsx'

export default function HorasChart({ data }: { data: any[] }) {
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Horas por proyecto')
    XLSX.writeFile(wb, 'horas-por-proyecto.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportExcel} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
          Exportar Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-4">Vendidas vs Estimadas vs Cargadas</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 40, left: -10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => [`${v}h`, n]} />
            <Legend />
            <Bar dataKey="vendidas" fill="#e5e7eb" name="Vendidas" radius={[3,3,0,0]} />
            <Bar dataKey="estimadas" fill="#93c5fd" name="Estimadas" radius={[3,3,0,0]} />
            <Bar dataKey="cargadas" fill="#1f2937" name="Cargadas" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="grid grid-cols-4 px-5 py-2 text-xs font-medium text-gray-400">
          <span>Proyecto</span><span>Vendidas</span><span>Estimadas</span><span>Cargadas</span>
        </div>
        {data.map((d, i) => (
          <div key={i} className="grid grid-cols-4 px-5 py-3 text-sm">
            <div>
              <p className="font-medium text-gray-900 truncate">{d.name}</p>
              <p className="text-xs text-gray-400">{d.cliente}</p>
            </div>
            <span className="text-gray-600">{d.vendidas}h</span>
            <span className={d.estimadas > d.vendidas ? 'text-red-500 font-medium' : 'text-gray-600'}>{d.estimadas}h</span>
            <span className={d.cargadas > d.estimadas ? 'text-red-500 font-medium' : 'text-gray-600'}>{d.cargadas}h</span>
          </div>
        ))}
      </div>
    </div>
  )
}
