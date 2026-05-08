'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnlineUsers from './OnlineUsers'
import NewsBanner from './NewsBanner'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Clock, BarChart3, UserCircle, LogOut, Menu, X, AlertCircle, MessageSquare, Receipt, FileText, TrendingUp, Shield, Timer, ChevronLeft, ChevronRight, Megaphone, UserCog, Activity } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

const APP_VERSION = '1.6.0'

const navItems = [
  { href: '/dashboard',         label: 'Dashboard',         icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/clientes',          label: 'Clientes',           icon: Users,           roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos',         label: 'Proyectos',          icon: FolderKanban,    roles: ['admin','gerente_operaciones'] },
  { href: '/proyectos-mes',     label: 'Proyectos del mes',  icon: FolderKanban,    roles: ['admin','gerente_operaciones'] },
  { href: '/tareas',            label: 'Tareas',             icon: CheckSquare,     roles: ['admin','gerente_operaciones'] },
  { href: '/mis-tareas',        label: 'Mis tareas',         icon: Clock,           roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-horas',         label: 'Mis horas',          icon: Timer,           roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/chat',              label: 'Chat',               icon: MessageSquare,   roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/resumen-mes',       label: 'Resumen del mes',    icon: BarChart3,       roles: ['admin','gerente_operaciones'] },
  { href: '/ocupacion-equipo',   label: 'Ocupación equipo',   icon: Users,           roles: ['admin','gerente_operaciones'] },
  { href: '/reportes',          label: 'Reportes',           icon: BarChart3,       roles: ['admin','gerente_operaciones'] },
  { href: '/solicitudes',       label: 'Solicitudes',        icon: AlertCircle,     roles: ['admin','gerente_operaciones'] },
  { href: '/facturacion',       label: 'Facturación',        icon: Receipt,         roles: ['admin'] },
  { href: '/liquidaciones',     label: 'Liquidaciones',      icon: Receipt,         roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/facturas-clientes', label: 'Facturas clientes',  icon: FileText,        roles: ['admin'] },
  { href: '/cotizaciones',      label: 'Cotizaciones USD',   icon: TrendingUp,      roles: ['admin'] },
  { href: '/roles',             label: 'Roles y permisos',   icon: Shield,          roles: ['admin'] },
  { href: '/logs',              label: 'Logs',               icon: Activity,        roles: ['admin'] },
  { href: '/equipo',            label: 'Equipo',             icon: UserCircle,      roles: ['admin','gerente_operaciones'] },
]

const bottomNav = [
  { href: '/dashboard',     label: 'Inicio',     icon: LayoutDashboard, roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-tareas',    label: 'Mis tareas', icon: Clock,           roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/mis-horas',     label: 'Mis horas',  icon: Timer,           roles: ['admin','gerente_operaciones','colaborador'] },
  { href: '/chat',          label: 'Chat',       icon: MessageSquare,   roles: ['admin','gerente_operaciones','colaborador'], badge: true },
  { href: '/liquidaciones', label: 'Liquid.',    icon: Receipt,         roles: ['admin','gerente_operaciones','colaborador'] },
]

function Avatar({ url, name, size = 7 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <div className={`w-${size} h-${size} rounded-full overflow-hidden shrink-0 border border-gray-100`}>
        <Image src={url} alt={name} width={size * 4} height={size * 4} className="object-cover w-full h-full" unoptimized/>
      </div>
    )
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0`}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function NavItem({ href, label, Icon, active, badge, unreadCount, onClick }: {
  href: string; label: string; Icon: any; active: boolean
  badge?: boolean; unreadCount: number; onClick?: () => void
}) {
  const showBadge = badge && unreadCount > 0 && !active
  const badgeNum = unreadCount > 9 ? '9+' : String(unreadCount)
  return (
    <Link href={href} onClick={onClick}
      className={active
        ? 'flex items-center gap-3 px-3 py-2 rounded-xl text-sm bg-[#E8F4FE] text-[#1B9BF0] font-medium transition-all'
        : 'flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all'}>
      <div className="relative shrink-0">
        <Icon size={15} strokeWidth={active ? 2 : 1.5} color={active ? '#1B9BF0' : '#6b7280'}/>
        {showBadge && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">{badgeNum}</span>}
      </div>
      <span className="flex-1">{label}</span>
      {showBadge && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{badgeNum}</span>}
    </Link>
  )
}

function BottomNavItem({ href, label, Icon, active, badge, unreadCount }: {
  href: string; label: string; Icon: any; active: boolean; badge?: boolean; unreadCount: number
}) {
  const showBadge = badge && unreadCount > 0 && !active
  const badgeNum = unreadCount > 9 ? '9+' : String(unreadCount)
  return (
    <Link href={href} className={active ? 'flex-1 flex flex-col items-center py-2.5 text-xs gap-1 text-[#1B9BF0] transition-colors' : 'flex-1 flex flex-col items-center py-2.5 text-xs gap-1 text-gray-400 transition-colors'}>
      <div className="relative">
        <Icon size={19} strokeWidth={active ? 2 : 1.5}/>
        {showBadge && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">{badgeNum}</span>}
      </div>
      <span className={active ? 'font-medium' : ''}>{label}</span>
    </Link>
  )
}

export default function AppLayout({
  children, userRole, userName, userId, avatarUrl,
  customRoleName, customPermissions, canSeeOnlineUsers = false,
  canManageNews = false, activeNews = null
}: {
  children: React.ReactNode
  userRole: string
  userName: string
  userId?: string
  avatarUrl?: string | null
  customRoleName?: string | null
  customPermissions?: string[]
  canSeeOnlineUsers?: boolean
  canManageNews?: boolean
  activeNews?: { id: string; content: string; visible_to: string[] } | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const mainRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hasNews = !!activeNews

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mainRef.current || !mounted) return
    const isDesktop = window.innerWidth >= 768
    mainRef.current.style.marginLeft = isDesktop ? (collapsed ? '56px' : '224px') : '0px'
  }, [mounted, collapsed])

  useEffect(() => {
    if (!mainRef.current) return
    function handleResize() {
      if (!mainRef.current) return
      const isDesktop = window.innerWidth >= 768
      mainRef.current.style.marginLeft = isDesktop ? (collapsed ? '56px' : '224px') : '0px'
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [collapsed])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
    if (mainRef.current && window.innerWidth >= 768) {
      mainRef.current.style.marginLeft = next ? '56px' : '224px'
    }
  }

  const canSeeItem = (item: { href: string; roles: string[] }) => {
    if (item.roles.includes(userRole)) return true
    if (customPermissions && customPermissions.length > 0) {
      const key = item.href.replace('/', '').replace(/-/g, '_')
      return customPermissions.includes(key)
    }
    return false
  }
  const visible = navItems.filter(canSeeItem)
  const visibleBottom = bottomNav.filter(canSeeItem)
  const isChat = pathname === '/chat'
  const isCollapsed = mounted && collapsed
  const newsPx = hasNews ? 40 : 0

  useEffect(() => {
    if (!userId) return
    const sb = createClient()

    // Global unread (based on localStorage timestamp)
    const lastRead = localStorage.getItem('chat_last_read') ?? '1970-01-01'
    sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('is_global', true).gt('created_at', lastRead).neq('user_id', userId)
      .then(({ count }) => setUnreadCount(c => c + (count ?? 0)))

    // DM unread: sum unread per conversation
    sb.from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
      .then(async ({ data: memberships }) => {
        if (!memberships?.length) return
        let total = 0
        for (const m of memberships) {
          const { count } = await sb.from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', m.conversation_id)
            .neq('user_id', userId)
            .gt('created_at', m.last_read_at ?? '1970-01-01')
          total += count ?? 0
        }
        setUnreadCount(c => c + total)
      })

    // Realtime: all new messages from others (RLS ensures only visible ones)
    const channel = sb.channel('chat-badge-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (p) => { if (p.new.user_id !== userId) setUnreadCount(c => c + 1) })
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

  return (
    <div className="min-h-screen bg-[#f8f8f7]">
      {activeNews && <NewsBanner news={activeNews} userId={userId ?? ''}/>}

      {/* Sidebar desktop — OnlineUsers SOLO aquí */}
      <aside
        style={{ top: newsPx, width: isCollapsed ? 56 : 224, height: `calc(100vh - ${newsPx}px)` }}
        className="hidden md:flex fixed left-0 bg-white border-r border-gray-100 flex-col z-30 transition-all duration-200"
      >
        <div className="px-4 py-4 border-b border-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            {!isCollapsed && <Image src="/logo.jpeg" alt="DDS" width={100} height={30} className="object-contain rounded-md"/>}
            <button onClick={toggleCollapsed}
              className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all ${isCollapsed ? 'mx-auto' : 'ml-auto'}`}>
              {isCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            </button>
          </div>
          <button onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 mt-3 w-full hover:bg-gray-50 rounded-xl px-1 py-1.5 transition-all">
            <div className="relative shrink-0">
              <Avatar url={avatarUrl ?? null} name={userName} size={7}/>
              {unreadCount > 0 && !isChat && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="text-left min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{userName}</p>
                <p className="text-xs text-gray-400 capitalize">{customRoleName ?? userRole.replace(/_/g, ' ')}</p>
              </div>
            )}
          </button>
          {showProfile && !isCollapsed && (
            <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <div className="flex justify-center"><Avatar url={avatarUrl ?? null} name={userName} size={14}/></div>
              <p className="text-xs text-center text-gray-600 font-medium">{userName}</p>
              <p className="text-xs text-center text-gray-400 capitalize">{customRoleName ?? userRole.replace(/_/g, ' ')}</p>
              <Link href="/mi-perfil" onClick={() => setShowProfile(false)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#1B9BF0] hover:bg-blue-50 rounded-lg transition-all">
                <UserCog size={12}/> Mi perfil
              </Link>
              <button onClick={logout} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <LogOut size={12}/> Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto min-h-0 ${isCollapsed ? 'px-1' : 'px-3'}`}>
          {visible.map(item => isCollapsed
            ? <Link key={item.href} href={item.href} title={item.label}
                className={`flex items-center justify-center py-2.5 rounded-xl transition-all ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                <item.icon size={18} strokeWidth={pathname === item.href ? 2 : 1.5}/>
              </Link>
            : <NavItem key={item.href} href={item.href} label={item.label} Icon={item.icon}
                active={pathname === item.href || pathname.startsWith(item.href + '/')}
                badge={item.badge} unreadCount={unreadCount}/>
          )}
          {canManageNews && (isCollapsed
            ? <Link href="/news" title="Anuncios" className={`flex items-center justify-center py-2.5 rounded-xl transition-all ${pathname === '/news' ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Megaphone size={18}/>
              </Link>
            : <NavItem href="/news" label="Anuncios" Icon={Megaphone} active={pathname === '/news'} unreadCount={0}/>
          )}
          {isCollapsed
            ? <Link href="/mi-perfil" title="Mi perfil" className={`flex items-center justify-center py-2.5 rounded-xl transition-all ${pathname === '/mi-perfil' ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-500 hover:bg-gray-100'}`}>
                <UserCog size={18}/>
              </Link>
            : <NavItem href="/mi-perfil" label="Mi perfil" Icon={UserCog} active={pathname === '/mi-perfil'} unreadCount={0}/>
          }
        </nav>

        <div className={`shrink-0 border-t border-gray-50 flex items-center ${isCollapsed ? 'px-1 py-3 justify-center flex-col gap-2' : 'px-4 py-3 justify-between'}`}>
          {canSeeOnlineUsers && <OnlineUsers collapsed={isCollapsed}/>}
          {!isCollapsed && <span className="text-xs text-gray-300">v{APP_VERSION}</span>}
          <button onClick={logout} title="Cerrar sesión" className={`flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 ${isCollapsed ? 'justify-center' : ''}`}>
            <LogOut size={13}/> {!isCollapsed && 'Salir'}
          </button>
        </div>
      </aside>

      {/* Header mobile — SIN OnlineUsers para evitar doble canal */}
      <header style={{ top: newsPx }} className="md:hidden fixed inset-x-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-30">
        <Image src="/logo.jpeg" alt="DDS" width={90} height={28} className="object-contain rounded-md"/>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(!open)} className="p-1.5 text-gray-500 relative">
            {open ? <X size={20}/> : <Menu size={20}/>}
            {unreadCount > 0 && !open && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"/>
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5 border-b border-gray-50">
              <Image src="/logo.jpeg" alt="DDS" width={100} height={30} className="object-contain rounded-md"/>
              <div className="flex items-center gap-3 mt-4">
                <Avatar url={avatarUrl ?? null} name={userName} size={10}/>
                <div>
                  <p className="text-sm font-medium text-gray-800">{userName}</p>
                  <p className="text-xs text-gray-400 capitalize">{customRoleName ?? userRole.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {visible.map(item => (
                <NavItem key={item.href} href={item.href} label={item.label} Icon={item.icon}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                  badge={item.badge} unreadCount={unreadCount} onClick={() => setOpen(false)}/>
              ))}
              {canManageNews && <NavItem href="/news" label="Anuncios" Icon={Megaphone} active={pathname === '/news'} unreadCount={0} onClick={() => setOpen(false)}/>}
              <NavItem href="/mi-perfil" label="Mi perfil" Icon={UserCog} active={pathname === '/mi-perfil'} unreadCount={0} onClick={() => setOpen(false)}/>
            </nav>
            <div className="px-4 py-4 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canSeeOnlineUsers && <OnlineUsers/>}
                <span className="text-xs text-gray-300">v{APP_VERSION}</span>
              </div>
              <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-all">
                <LogOut size={15}/> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex z-30">
        {visibleBottom.map(item => (
          <BottomNavItem key={item.href} href={item.href} label={item.label} Icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            badge={item.badge} unreadCount={unreadCount}/>
        ))}
      </nav>

      <main
        ref={mainRef}
        style={{ marginTop: newsPx }}
        className={`min-h-screen pt-14 md:pt-0 pb-20 md:pb-0 transition-all duration-200${isChat ? ' flex flex-col' : ''}`}
      >
        {children}
      </main>
    </div>
  )
}
