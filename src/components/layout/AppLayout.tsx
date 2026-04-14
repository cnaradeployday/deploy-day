'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Clock, BarChart3, UserCircle, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos', label: 'Proyectos', icon: FolderKanban, roles: ['admin','gerente_operaciones'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin','gerente_operaciones'] },
  { href: '/equipo', label: 'Equipo', icon: UserCircle, roles: ['admin','gerente_operaciones'] },
]

const bottomNav = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare },
  { href: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { href: '/clientes', label: 'Clientes', icon: Users },
]

export default function AppLayout({ children, userRole, userName }: {
  children: React.ReactNode
  userRole: string
  userName: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const visible = navItems.filter(i => i.roles.includes(userRole))

  async function logout() {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200 flex-col z-30">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-900">Deploy Day</p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{userRole.replace('_',' ')} · {userName}</p>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visible.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon size={15} />{label}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-3 border-t border-gray-100">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 w-full">
            <LogOut size={15} />Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <span className="font-bold text-gray-900">Deploy Day</span>
        <button onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white w-64 h-full p-4 space-y-1" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-gray-400 px-3 pb-2 capitalize">{userName} · {userRole.replace('_',' ')}</p>
            {visible.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${pathname === href ? 'bg-black text-white' : 'text-gray-600'}`}>
                <Icon size={15}/>{label}
              </Link>
            ))}
            <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-500 mt-2"><LogOut size={15}/>Cerrar sesión</button>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-30">
        {bottomNav.filter(i => navItems.find(n => n.href === i.href)?.roles.includes(userRole)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 ${active ? 'text-black font-medium' : 'text-gray-400'}`}>
              <Icon size={18}/><span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <main className="md:ml-56 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
