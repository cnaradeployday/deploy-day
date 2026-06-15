'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, X, Send, Users, Hash, UserPlus, Search, Check } from 'lucide-react'
import Image from 'next/image'

const GLOBAL_ID = '__global__'

interface UserRow { id: string; full_name: string; avatar_url?: string | null }
interface ConvMember { user_id: string; user: UserRow }
interface ConvRow {
  id: string; type: 'direct' | 'group'; name: string | null
  last_message_at: string; myLastRead: string
  members: ConvMember[]
  lastMsg?: string | null; unread: number
}
interface Msg {
  id: string; content: string; created_at: string; user_id: string
  conversation_id?: string | null; is_global?: boolean
  user?: { id: string; full_name: string } | null
}

function timeShort(s: string) {
  const d = new Date(s), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'ayer'
  if (diff < 7) return d.toLocaleDateString('es-AR', { weekday: 'short' })
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function Av({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) return (
    <div className="rounded-full overflow-hidden shrink-0" style={{ width: size, height: size }}>
      <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
    </div>
  )
  return (
    <div className="rounded-full bg-[#E8F4FE] flex items-center justify-center font-semibold text-[#1B9BF0] shrink-0"
      style={{ width: size, height: size, fontSize: size / 3 }}>
      {name[0].toUpperCase()}
    </div>
  )
}

function groupByDate(msgs: Msg[]) {
  const groups: { date: string; msgs: Msg[] }[] = []
  msgs.forEach(m => {
    const date = new Date(m.created_at).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.msgs.push(m)
    else groups.push({ date, msgs: [m] })
  })
  return groups
}

export default function FloatingChat({ userId }: { userId: string }) {
  const sb = useRef(createClient()).current
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const openRef = useRef(false)
  const [conversations, setConversations] = useState<ConvRow[]>([])
  const [messages, setMessages] = useState<Msg[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [globalUnread, setGlobalUnread] = useState(0)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'convs' | 'users'>('convs')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // ─── Load conversations ──────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const { data: myRows } = await sb
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
    if (!myRows || myRows.length === 0) { setConversations([]); return }

    const convIds = (myRows as any[]).map(r => r.conversation_id)
    const readMap = new Map((myRows as any[]).map(r => [r.conversation_id, r.last_read_at]))

    const [{ data: convData }, { data: allMembers }, { data: recentMsgs }] = await Promise.all([
      sb.from('conversations').select('id, type, name, last_message_at').in('id', convIds),
      sb.from('conversation_members').select('conversation_id, user_id, user:users(id, full_name, avatar_url)').in('conversation_id', convIds),
      sb.from('messages').select('conversation_id, content, created_at').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(convIds.length * 5),
    ])

    const membersByConv = new Map<string, ConvMember[]>()
    ;(allMembers ?? []).forEach((m: any) => {
      if (!membersByConv.has(m.conversation_id)) membersByConv.set(m.conversation_id, [])
      membersByConv.get(m.conversation_id)!.push({ user_id: m.user_id, user: m.user })
    })

    const lastMsgByConv = new Map<string, any>()
    ;(recentMsgs ?? []).forEach((m: any) => {
      if (!lastMsgByConv.has(m.conversation_id)) lastMsgByConv.set(m.conversation_id, m)
    })

    const msgsByConv = new Map<string, any[]>()
    ;(recentMsgs ?? []).forEach((m: any) => {
      if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, [])
      msgsByConv.get(m.conversation_id)!.push(m)
    })

    const convs: ConvRow[] = (convData ?? []).map((c: any) => {
      const myLastRead = readMap.get(c.id) ?? '1970-01-01'
      const msgs = msgsByConv.get(c.id) ?? []
      const unread = msgs.filter(m => m.created_at > myLastRead).length
      const lastMsg = lastMsgByConv.get(c.id)
      return {
        id: c.id, type: c.type, name: c.name,
        last_message_at: c.last_message_at,
        myLastRead,
        members: membersByConv.get(c.id) ?? [],
        lastMsg: lastMsg?.content ?? null,
        unread,
      }
    }).sort((a: ConvRow, b: ConvRow) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    )

    setConversations(convs)
  }, [userId, sb])

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const lastRead = localStorage.getItem('chat_last_read') ?? '1970-01-01'
    sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('is_global', true).gt('created_at', lastRead).neq('user_id', userId)
      .then(({ count }) => setGlobalUnread(count ?? 0))

    sb.from('users').select('id, full_name, avatar_url').order('full_name')
      .then(({ data }) => setUsers((data ?? []) as UserRow[]))

    loadConversations()

    const channel = sb.channel('floating-chat-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as any
        if (msg.is_global && msg.user_id !== userId) {
          if (!openRef.current || activeIdRef.current !== GLOBAL_ID) setGlobalUnread(u => u + 1)
        }
        if (msg.conversation_id) {
          loadConversations()
          if (msg.conversation_id === activeIdRef.current) {
            const { data } = await sb.from('messages')
              .select('id, content, created_at, user_id, conversation_id, user:users(id, full_name)')
              .eq('id', msg.id).single()
            if (data) setMessages(prev => prev.find(m => m.id === (data as any).id) ? prev : [...prev, data as any])
          }
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [userId, loadConversations])

  // ─── Load messages when active conv changes ───────────────────────────────
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    setMessages([])
    if (activeId === GLOBAL_ID) {
      sb.from('messages')
        .select('id, content, created_at, user_id, is_global, user:users(id, full_name)')
        .eq('is_global', true).order('created_at', { ascending: true }).limit(100)
        .then(({ data }) => {
          setMessages((data ?? []) as unknown as Msg[])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 60)
        })
      setGlobalUnread(0)
      localStorage.setItem('chat_last_read', new Date().toISOString())
      return
    }
    sb.from('messages')
      .select('id, content, created_at, user_id, conversation_id, user:users(id, full_name)')
      .eq('conversation_id', activeId).order('created_at', { ascending: true }).limit(100)
      .then(({ data }) => {
        setMessages((data ?? []) as unknown as Msg[])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 60)
      })
    sb.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', activeId).eq('user_id', userId)
      .then(() => loadConversations())
  }, [activeId])

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ─── Send ────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || sending || !activeId) return
    setSending(true)
    const isGlobal = activeId === GLOBAL_ID
    const { data } = await sb.from('messages').insert({
      content: input.trim(), user_id: userId,
      is_global: isGlobal,
      conversation_id: isGlobal ? null : activeId,
    }).select('id, content, created_at, user_id, conversation_id, is_global, user:users(id, full_name)').single()

    if (data) {
      setMessages(prev => prev.find(m => m.id === (data as any).id) ? prev : [...prev, data as any])
      if (!isGlobal) {
        await sb.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeId)
        loadConversations()
      }
    }
    setInput('')
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ─── Open / create DM ────────────────────────────────────────────────────
  async function openDM(targetId: string) {
    setTab('convs')
    setSearch('')
    const { data: myDirectRows } = await sb.from('conversation_members')
      .select('conversation_id').eq('user_id', userId)
    const myIds = (myDirectRows ?? []).map((r: any) => r.conversation_id)

    if (myIds.length > 0) {
      const { data: shared } = await sb.from('conversation_members')
        .select('conversation_id').eq('user_id', targetId).in('conversation_id', myIds)
      for (const row of (shared ?? []) as any[]) {
        const { data: conv } = await sb.from('conversations').select('type').eq('id', row.conversation_id).single()
        if ((conv as any)?.type === 'direct') { setActiveId(row.conversation_id); return }
      }
    }

    const { data: newConv } = await sb.from('conversations')
      .insert({ type: 'direct', created_by: userId }).select().single()
    if (!newConv) return
    await sb.from('conversation_members').insert([
      { conversation_id: (newConv as any).id, user_id: userId },
      { conversation_id: (newConv as any).id, user_id: targetId },
    ])
    await loadConversations()
    setActiveId((newConv as any).id)
  }

  // ─── Create group ────────────────────────────────────────────────────────
  async function createGroup() {
    if (!groupName.trim() || groupMembers.length === 0) return
    const { data: newConv } = await sb.from('conversations')
      .insert({ type: 'group', name: groupName.trim(), created_by: userId }).select().single()
    if (!newConv) return
    const allMembers = [...new Set([userId, ...groupMembers])]
    await sb.from('conversation_members').insert(allMembers.map(uid => ({ conversation_id: (newConv as any).id, user_id: uid })))
    setGroupName(''); setGroupMembers([]); setShowNewGroup(false)
    await loadConversations()
    setActiveId((newConv as any).id)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function convName(c: ConvRow) {
    if (c.type === 'group') return c.name ?? 'Grupo'
    const other = c.members.find(m => m.user_id !== userId)
    return other?.user?.full_name ?? '—'
  }
  function convOtherUser(c: ConvRow): UserRow | null {
    const other = c.members.find(m => m.user_id !== userId)
    return other?.user ?? null
  }

  const totalUnread = globalUnread + conversations.reduce((s, c) => s + c.unread, 0)
  const badgeNum = totalUnread > 9 ? '9+' : String(totalUnread)
  const activeConv = activeId && activeId !== GLOBAL_ID ? conversations.find(c => c.id === activeId) ?? null : null
  const activeName = activeId === GLOBAL_ID ? 'Chat del equipo' : (activeConv ? convName(activeConv) : '')
  const activeOtherUser = activeConv ? convOtherUser(activeConv) : null

  const filteredConvs = conversations.filter(c =>
    !search || convName(c).toLowerCase().includes(search.toLowerCase())
  )
  const filteredUsers = users.filter(u =>
    u.id !== userId && (!search || u.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      {open && (
        <div
          className="fixed z-50 shadow-2xl rounded-2xl overflow-hidden flex bg-white border border-gray-200"
          style={{ bottom: 80, right: 24, width: 660, height: 520 }}
        >
          {/* ── LEFT: conversation list ── */}
          <div className="w-56 border-r border-gray-100 flex flex-col shrink-0">
            {/* Header */}
            <div className="bg-[#1B9BF0] px-3 pt-3 pb-2.5 shrink-0">
              <p className="text-sm font-semibold text-white mb-2">Mensajes</p>
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
                <input
                  value={search} onChange={e => { setSearch(e.target.value) }}
                  placeholder="Buscar..."
                  className="w-full bg-white/20 text-white placeholder-white/60 text-xs pl-7 pr-2 py-1.5 rounded-lg focus:outline-none focus:bg-white/30"
                />
              </div>
              {/* Tabs */}
              <div className="flex mt-2 gap-1">
                <button onClick={() => setTab('convs')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${tab === 'convs' ? 'bg-white text-[#1B9BF0]' : 'text-white/70 hover:text-white'}`}>
                  Chats
                </button>
                <button onClick={() => setTab('users')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${tab === 'users' ? 'bg-white text-[#1B9BF0]' : 'text-white/70 hover:text-white'}`}>
                  Contactos
                </button>
              </div>
            </div>

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'convs' && (
                <>
                  {/* Global chat */}
                  <button onClick={() => setActiveId(GLOBAL_ID)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${activeId === GLOBAL_ID ? 'bg-[#E8F4FE]' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-[#1B9BF0] flex items-center justify-center shrink-0">
                      <Hash size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">Chat del equipo</p>
                      <p className="text-[10px] text-gray-400">Canal general</p>
                    </div>
                    {globalUnread > 0 && (
                      <span className="min-w-[16px] h-4 bg-[#1B9BF0] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                        {globalUnread > 9 ? '9+' : globalUnread}
                      </span>
                    )}
                  </button>

                  {/* New group button */}
                  <button onClick={() => setShowNewGroup(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Users size={15} className="text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-400">Nuevo grupo...</p>
                  </button>

                  {/* Conversations */}
                  {filteredConvs.map(c => (
                    <button key={c.id} onClick={() => setActiveId(c.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${activeId === c.id ? 'bg-[#E8F4FE]' : ''}`}>
                      {c.type === 'group'
                        ? <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0"><Users size={15} className="text-purple-500" /></div>
                        : <Av name={convName(c)} url={convOtherUser(c)?.avatar_url} size={36} />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${c.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {convName(c)}
                          </p>
                          <span className="text-[9px] text-gray-400 shrink-0">{timeShort(c.last_message_at)}</span>
                        </div>
                        {c.lastMsg && (
                          <p className={`text-[10px] truncate mt-0.5 ${c.unread > 0 ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>
                            {c.lastMsg}
                          </p>
                        )}
                      </div>
                      {c.unread > 0 && (
                        <span className="min-w-[16px] h-4 bg-[#1B9BF0] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                          {c.unread > 9 ? '9+' : c.unread}
                        </span>
                      )}
                    </button>
                  ))}

                  {filteredConvs.length === 0 && !search && (
                    <p className="text-[10px] text-gray-400 text-center py-6">Sin conversaciones aún</p>
                  )}
                </>
              )}

              {tab === 'users' && (
                <>
                  {filteredUsers.map(u => (
                    <button key={u.id} onClick={() => openDM(u.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors">
                      <Av name={u.full_name} url={u.avatar_url} size={36} />
                      <span className="text-xs text-gray-700 truncate">{u.full_name}</span>
                      <UserPlus size={11} className="text-gray-300 ml-auto shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT: chat pane ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
                <MessageSquare size={32} className="opacity-30" />
                <p className="text-xs text-gray-400">Seleccioná una conversación</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 shrink-0 bg-white">
                  {activeId === GLOBAL_ID
                    ? <div className="w-9 h-9 rounded-full bg-[#1B9BF0] flex items-center justify-center shrink-0"><Hash size={16} className="text-white" /></div>
                    : activeConv?.type === 'group'
                      ? <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0"><Users size={16} className="text-purple-500" /></div>
                      : activeOtherUser ? <Av name={activeOtherUser.full_name} url={activeOtherUser.avatar_url} size={36} /> : null
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{activeName}</p>
                    {activeConv?.type === 'group' && (
                      <p className="text-[10px] text-gray-400">{activeConv.members.length} miembros</p>
                    )}
                    {activeId === GLOBAL_ID && (
                      <p className="text-[10px] text-gray-400">Todo el equipo</p>
                    )}
                  </div>
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all shrink-0">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#F0F2F5]">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                      <MessageSquare size={24} className="opacity-30" />
                      <p className="text-xs">Sin mensajes aún</p>
                    </div>
                  )}
                  {groupByDate(messages).map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-gray-300/50" />
                        <span className="text-[10px] text-gray-500 bg-[#F0F2F5] px-2 capitalize">{group.date}</span>
                        <div className="flex-1 h-px bg-gray-300/50" />
                      </div>
                      {group.msgs.map((msg, i) => {
                        const prev = group.msgs[i - 1]
                        const sameUser = prev?.user_id === msg.user_id &&
                          new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000
                        const own = msg.user_id === userId
                        return (
                          <div key={msg.id} className={`flex gap-2 ${own ? 'flex-row-reverse' : ''} ${sameUser ? 'mt-0.5' : 'mt-3'}`}>
                            {!sameUser && !own && (
                              <Av name={(msg.user as any)?.full_name ?? '?'} size={28} />
                            )}
                            {sameUser && !own && <div className="shrink-0" style={{ width: 28 }} />}
                            <div className={`max-w-[75%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                              {!sameUser && !own && (
                                <span className="text-[10px] text-[#1B9BF0] font-semibold mb-0.5 ml-1">
                                  {(msg.user as any)?.full_name ?? ''}
                                </span>
                              )}
                              <div className={`px-3 py-1.5 rounded-xl text-sm leading-relaxed break-words shadow-sm ${
                                own
                                  ? 'bg-[#D9FDD3] text-gray-900 rounded-tr-sm'
                                  : 'bg-white text-gray-900 rounded-tl-sm'
                              }`}>
                                {msg.content}
                                <span className={`text-[9px] ml-2 align-bottom ${own ? 'text-green-600/60' : 'text-gray-400'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  {own && <Check size={10} className="inline ml-0.5" />}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="bg-[#F0F2F5] px-3 py-2 shrink-0">
                  <div className="flex items-end gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm">
                    <textarea
                      ref={inputRef} value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Escribí un mensaje..."
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none max-h-24"
                      onInput={e => {
                        const t = e.target as HTMLTextAreaElement
                        t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'
                      }}
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending}
                      className="w-8 h-8 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-all shrink-0">
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── New group modal ── */}
          {showNewGroup && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <div className="bg-white rounded-2xl p-5 w-80 shadow-xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Nuevo grupo</h3>
                <input value={groupName} onChange={e => setGroupName(e.target.value)}
                  placeholder="Nombre del grupo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
                <p className="text-xs text-gray-500 mb-2">Participantes:</p>
                <div className="max-h-44 overflow-y-auto space-y-0.5 mb-4 -mx-1">
                  {users.filter(u => u.id !== userId).map(u => {
                    const checked = groupMembers.includes(u.id)
                    return (
                      <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-[#E8F4FE]' : 'hover:bg-gray-50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[#1B9BF0] border-[#1B9BF0]' : 'border-gray-300'}`}>
                          {checked && <Check size={9} className="text-white" />}
                        </div>
                        <input type="checkbox" checked={checked} onChange={e => setGroupMembers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} className="sr-only" />
                        <Av name={u.full_name} url={u.avatar_url} size={28} />
                        <span className="text-xs text-gray-700">{u.full_name}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowNewGroup(false); setGroupName(''); setGroupMembers([]) }}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">Cancelar</button>
                  <button onClick={createGroup} disabled={!groupName.trim() || groupMembers.length === 0}
                    className="flex-1 py-2 rounded-xl bg-[#1B9BF0] text-white text-xs font-semibold disabled:opacity-40">
                    Crear grupo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bubble ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed z-50 bottom-6 right-6 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52, background: open ? '#374151' : '#1B9BF0' }}
        title="Chat"
      >
        {open ? <X size={20} className="text-white" /> : <MessageSquare size={20} className="text-white" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-1">
            {badgeNum}
          </span>
        )}
      </button>
    </>
  )
}
