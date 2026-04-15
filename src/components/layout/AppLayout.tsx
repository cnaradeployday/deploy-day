'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Clock, BarChart3, UserCircle, LogOut, Menu, X, AlertCircle, MessageSquare, Receipt, FileText, TrendingUp, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'

const APP_VERSION = '1.1.0'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos', label: 'Proyectos', icon: FolderKanban, roles: ['admin','gerente_operaciones'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin','gerente_operaciones'] },
  { href: '/solicitudes', label: 'Solicitudes', icon: AlertCircle, roles: ['admin','gerente_operaciones'] },
  { href: '/liquidaciones', label: 'Liquidaciones', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/facturas-clientes', label: 'Facturas clientes', icon: FileText, roles: ['admin'] },
  { href: '/cotizaciones', label: 'Cotizaciones USD', icon: TrendingUp, roles: ['admin'] },
  { href: '/roles', label: 'Roles y permisos', icon: Shield, roles: ['admin'] },
  { href: '/equipo', label: 'Equipo', icon: UserCircle, roles: ['admin','gerente_operaciones'] },
]

const bottomNav = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/liquidaciones', label: 'Liquid.', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
]

export default function AppLayout({ children, userRole, userName, userId }: {
  children: React.ReactNode
  userRole: string
  userName: string
  userId?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const visible = navItems.filter(i => i.roles.includes(userRole))
  const visibleBottom = bottomNav.filter(i => i.roles.includes(userRole))
  const isChat = pathname === '/chat'

  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const lastRead = localStorage.getItem('chat_last_read') ?? '1970-01-01'
    sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_global', true)
      .gt('created_at', lastRead)
      .neq('user_id', userId)
      .then(({ count }) => setUnreadCount(count ?? 0))
    const channel = sb.channel('chat-badge-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'is_global=eq.true' },
        (payload) => { if (payload.new.user_id !== userId) setUnreadCount(c => c + 1) })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (isChat) { localStorage.setItem('chat_last_read', new Date().toISOString()); setUnreadCount(0) }
  }, [isChat])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const NavLink = ({ href, label, icon: Icon, onClick, badge }: { href: string; label: string; icon: any; onClick?: () => void; badge?: boolean }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} onClick={onClick}
        className={'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ' + (active ? 'bg-[#E8F4FE] text-[#1B9BF0] font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')}>
        <div className="relative shrink-0">
          <Icon size={15} strokeWidth={active ? 2 : 1.5} style={{ color: active ? '#1B9BF0' : undefined }}/>
          {badge && unreadCount > 0 && !active && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="flex-1">{label}</span>
        {badge && unreadCount > 0 && !active && (
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 flex-col z-30">
        <div className="px-4 py-4 bor
cat > src/components/layout/AppLayout.tsx << 'ENDOFFILE'
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Clock, BarChart3, UserCircle, LogOut, Menu, X, AlertCircle, MessageSquare, Receipt, FileText, TrendingUp, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'

const APP_VERSION = '1.1.0'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos', label: 'Proyectos', icon: FolderKanban, roles: ['admin','gerente_operaciones'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin','gerente_operaciones'] },
  { href: '/solicitudes', label: 'Solicitudes', icon: AlertCircle, roles: ['admin','gerente_operaciones'] },
  { href: '/liquidaciones', label: 'Liquidaciones', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/facturas-clientes', label: 'Facturas clientes', icon: FileText, roles: ['admin'] },
  { href: '/cotizaciones', label: 'Cotizaciones USD', icon: TrendingUp, roles: ['admin'] },
  { href: '/roles', label: 'Roles y permisos', icon: Shield, roles: ['admin'] },
  { href: '/equipo', label: 'Equipo', icon: UserCircle, roles: ['admin','gerente_operaciones'] },
]

const bottomNav = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-tareas', label: 'Mis tareas', icon: Clock, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin','gerente_operaciones'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/liquidaciones', label: 'Liquid.', icon: Receipt, roles: ['admin','gerente_operaciones','colaborador'] },
]

export default function AppLayout({ children, userRole, userName, userId }: {
  children: React.ReactNode
  userRole: string
  userName: string
  userId?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const visible = navItems.filter(i => i.roles.includes(userRole))
  const visibleBottom = bottomNav.filter(i => i.roles.includes(userRole))
  const isChat = pathname === '/chat'

  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const lastRead = localStorage.getItem('chat_last_read') ?? '1970-01-01'
    sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_global', true)
      .gt('created_at', lastRead)
      .neq('user_id', userId)
      .then(({ count }) => setUnreadCount(count ?? 0))
    const channel = sb.channel('chat-badge-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'is_global=eq.true' },
        (payload) => { if (payload.new.user_id !== userId) setUnreadCount(c => c + 1) })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (isChat) { localStorage.setItem('chat_last_read', new Date().toISOString()); setUnreadCount(0) }
  }, [isChat])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const NavLink = ({ href, label, icon: Icon, onClick, badge }: { href: string; label: string; icon: any; onClick?: () => void; badge?: boolean }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} onClick={onClick}
        className={'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ' + (active ? 'bg-[#E8F4FE] text-[#1B9BF0] font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')}>
        <div className="relative shrink-0">
          <Icon size={15} strokeWidth={active ? 2 : 1.5} style={{ color: active ? '#1B9BF0' : undefined }}/>
          {badge && unreadCount > 0 && !active && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="flex-1">{label}</span>
        {badge && unreadCount > 0 && !active && (
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 flex-col z-30">
        <div className="px-4 py-4 border-b border-gray-50">
          <Image src="/logo.jpeg" alt="Deploy Day" width={120} height={36} className="object-contain rounded-md"/>
          <button onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 mt-3 w-full hover:bg-gray-50 rounded-xl px-1 py-1.5 transition-all">
            <div className="w-7 h-7 rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
              {userName?.[0]?.toUpperCase()}
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{userName}</p>
              <p className="text-xs text-gray-400 capitalize">{userRole.replace(/_/g,' ')}</p>
            </div>
          </button>
          {showProfile && (
            <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <div className="flex justify-center">
                <Image src="/mascota.jpeg" alt="mascota" width={52} height={52} className="rounded-xl"/>
              </div>
              <p className="text-xs text-center text-gray-600 font-medium">{userName}</p>
              <p className="text-xs text-center text-gray-400 capitalize">{userRole.replace(/_/g,' ')}</p>
              <button onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <LogOut size={12}/> Cerrar sesión
              </button>
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visible.map(item => <NavLink key={item.href} {...item}/>)}
        </nav>
        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-300">v{APP_VERSION}</span>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            <LogOut size={13}/> Salir
          </button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 z-30">
        <Image src="/logo.jpeg" alt="Deploy Day" width={100} height={30} className="object-contain rounded-md"/>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-300">v{APP_VERSION}</span>
          <button onClick={() => setOpen(!open)} className="p-1 text-gray-500 relative">
            {open ? <X size={20}/> : <Menu size={20}/>}
            {unreadCount > 0 && !open && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"/>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 border-b border-gray-50">
              <Image src="/logo.jpeg" alt="Deploy Day" width={110} height={34} className="object-contain rounded-md"/>
              <div className="flex items-center gap-3 mt-3">
                <Image src="/mascota.jpeg" alt="mascota" width={36} height={36} className="rounded-xl"/>
                <div>
                  <p className="text-sm font-medium text-gray-700">{userName}</p>
                  <p className="text-xs text-gray-400 capitalize">{userRole.replace(/_/g,' ')}</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {visible.map(item => <NavLink key={item.href} {...item} onClick={() => setOpen(false)}/>)}
            </nav>
            <div className="px-3 py-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-300">v{APP_VERSION}</span>
              <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400">
                <LogOut size={15}/> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex z-30">
        {visibleBottom.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={'flex-1 flex flex-col items-center py-2.5 text-xs gap-1 transition-colors ' + (active ? 'text-[#1B9BF0]' : 'text-gray-400')}>
              <div className="relative">
                <Icon size={19} strokeWidth={active ? 2 : 1.5}/>
                {badge && unreadCount > 0 && !active && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={active ? 'font-medium' : ''}>{label}</span>
            </Link>
          )
        })}
      </nav>

      <main className={'md:ml-56 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen' + (isChat ? ' flex flex-col' : '')}>
        {children}
      </main>
    </div>
  )
}
