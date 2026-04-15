'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Clock, BarChart3, UserCircle, LogOut, Menu, X, AlertCircle, MessageSquare, Receipt, FileText, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos', label: 'Proyectos', icon: FolderKanban, roles: ['admin','gerente_operaciones'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin','gerente_operaciones'] },
  { href: '/solicitudes', label: 'Solicitudes', icon: AlertCircle, roles: ['admin','gerente_operaciones'] },
  { href: '/liquidaciones', label: 'Liquidaciones', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/facturas-clientes', label: 'Facturas clientes', icon: FileText, roles: ['admin'] },
  { href: '/cotizaciones', label: 'Cotizaciones USD', icon: TrendingUp, roles: ['admin'] },
  { href: '/equipo', label: 'Equipo', icon: UserCircle, roles: ['admin','gerente_operaciones'] },
]

const bottomNav = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/liquidaciones', label: 'Liquid.', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
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
  const visibleBottom = bottomNav.filter(i => i.roles.includes(userRole))

  async function logout() {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  const NavLink = ({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: any; onClick?: () => void }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} onClick={onClick}
        className={'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ' + (active ? 'bg-[#E8F4FE] text-[#1B9BF0] font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')}>
        <Icon size={15} strokeWidth={active ? 2 : 1.5} color={active ? '#1B9BF0' : undefined}/>
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 flex-col z-30">
        <div className="px-4 py-4 border-b border-gray-50">
          <Image src="/logo.jpeg" alt="Deploy Day" width={120} height={36} className="object-contain rounded-md"/>
          <p className="text-xs text-gray-400 mt-2 px-0.5">{userName}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visible.map(item => <NavLink key={item.href} {...item}/>)}
        </nav>
        <div className="px-3 py-4 border-t border-gray-50">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100 w-full transition-all">
            <LogOut size={15} strokeWidth={1.5}/> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 z-30">
        <Image src="/logo.jpeg" alt="Deploy Day" width={100} height={30} className="object-contain rounded-md"/>
        <button onClick={() => setOpen(!open)} className="p-1 text-gray-500">
          {open ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"/>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 border-b border-gray-50">
              <Image src="/logo.jpeg" alt="Deploy Day" width={110} height={34} className="object-contain rounded-md"/>
              <p className="text-xs text-gray-400 mt-2 capitalize">{userName} · {userRole.replace(/_/g,' ')}</p>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {visible.map(item => <NavLink key={item.href} {...item} onClick={() => setOpen(false)}/>)}
            </nav>
            <div className="px-3 py-4 border-t border-gray-50">
              <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 w-full">
                <LogOut size={15}/> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex z-30">
        {visibleBottom.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={'flex-1 flex flex-col items-center py-2.5 text-xs gap-1 transition-colors ' + (active ? 'text-[#1B9BF0]' : 'text-gray-400')}>
              <Icon size={19} strokeWidth={active ? 2 : 1.5}/>
              <span className={active ? 'font-medium' : ''}>{label}</span>
            </Link>
          )
        })}
      </nav>

      <main className={'md:ml-56 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen' + (pathname === '/chat' ? ' flex flex-col' : '')}>
        {children}
      </main>
    </div>
  )
}
