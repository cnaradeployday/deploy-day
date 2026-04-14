import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: 'Deploy Day',
  description: 'Sistema de gestión de proyectos y tareas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistSans.className}>
      <body>{children}</body>
    </html>
  )
}
