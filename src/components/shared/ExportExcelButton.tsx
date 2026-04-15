'use client'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'

export default function ExportExcelButton({ data, filename, label = 'Exportar Excel' }: {
  data: Record<string, any>[]
  filename: string
  label?: string
}) {
  function exportar() {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Datos')
    XLSX.writeFile(wb, filename + '.xlsx')
  }
  return (
    <button onClick={exportar}
      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
      <Download size={14}/> {label}
    </button>
  )
}
