'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { renderContent } from '@/app/(app)/chat/renderContent'
import { MessageSquare, X, Send, Hash, Minus } from 'lucide-react'

export default function FloatingChat({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<{ type: string; id: string; label: string }[]>([])
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [triggerPos, setTriggerPos] = useState<{ start: number; type: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sbRef = useRef(createClient())
  const openRef = useRef(false)

  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    const sb = sbRef.current
    const lastRead = localStorage.getItem('chat_last_read') ?? '1970-01-01'

    sb.from('messages').select('id', { count: 'exact', head: true })
      .eq('is_global', true).gt('created_at', lastRead).neq('user_id', userId)
      .then(({ count }) => setUnread(count ?? 0))

    Promise.all([
      sb.from('users').select('id, full_name').order('full_name'),
      sb.from('tasks').select('id, title').not('status', 'in', '("finalizado")').order('title').limit(50),
      sb.from('projects').select('id, name').eq('is_active', true).order('name'),
      sb.from('messages')
        .select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
        .eq('is_global', true).order('created_at', { ascending: true }).limit(100),
    ]).then(([u, t, p, m]) => {
      setUsers(u.data ?? [])
      setTasks(t.data ?? [])
      setProjects(p.data ?? [])
      setMessages(m.data ?? [])
    })

    const channel = sb.channel('floating-chat-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        if (!payload.new.is_global || payload.new.user_id === userId) return
        const { data } = await sb
          .from('messages')
          .select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
          .eq('id', payload.new.id).single()
        if (data) {
          setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
          if (!openRef.current) setUnread(u => u + 1)
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (open) {
      setUnread(0)
      localStorage.setItem('chat_last_read', new Date().toISOString())
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 60)
    }
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)
    const hashMatch = before.match(/#(\w*)$/)
    const slashMatch = before.match(/\/(\w*)$/)

    if (atMatch) {
      const q = atMatch[1].toLowerCase()
      setSuggestions(users.filter(u => u.full_name.toLowerCase().includes(q)).slice(0, 5).map(u => ({ type: 'user', id: u.id, label: u.full_name })))
      setTriggerPos({ start: cursor - atMatch[0].length, type: '@' })
      setSuggestionIdx(0)
    } else if (hashMatch) {
      const q = hashMatch[1].toLowerCase()
      setSuggestions(projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5).map(p => ({ type: 'project', id: p.id, label: p.name })))
      setTriggerPos({ start: cursor - hashMatch[0].length, type: '#' })
      setSuggestionIdx(0)
    } else if (slashMatch) {
      const q = slashMatch[1].toLowerCase()
      setSuggestions(tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 5).map(t => ({ type: 'task', id: t.id, label: t.title })))
      setTriggerPos({ start: cursor - slashMatch[0].length, type: '/' })
      setSuggestionIdx(0)
    } else {
      setSuggestions([])
      setTriggerPos(null)
    }
  }

  function applySuggestion(s: { type: string; id: string; label: string }) {
    if (!triggerPos) return
    const cursor = inputRef.current?.selectionStart ?? input.length
    const prefix = input.slice(0, triggerPos.start)
    const suffix = input.slice(cursor)
    setInput(prefix + triggerPos.type + s.label + ' ' + suffix)
    setSuggestions([])
    setTriggerPos(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[suggestionIdx]); return }
      if (e.key === 'Escape') { setSuggestions([]); setTriggerPos(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    const sb = sbRef.current
    const mentionedUsers = users.filter(u => input.includes('@' + u.full_name)).map(u => u.id)
    const mentionedTask = tasks.find(t => input.includes('/' + t.title))
    const mentionedProject = projects.find(p => input.includes('#' + p.name))

    const { data } = await sb.from('messages').insert({
      content: input.trim(),
      user_id: userId,
      is_global: true,
      mentions: mentionedUsers,
      task_id: mentionedTask?.id ?? null,
      project_id: mentionedProject?.id ?? null,
    }).select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)').single()

    if (data) {
      setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
    }
    setInput('')
    setSending(false)
  }

  function groupByDate(msgs: any[]) {
    const groups: { date: string; msgs: any[] }[] = []
    msgs.forEach(m => {
      const date = new Date(m.created_at).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      const last = groups[groups.length - 1]
      if (last && last.date === date) last.msgs.push(m)
      else groups.push({ date, msgs: [m] })
    })
    return groups
  }

  const badgeNum = unread > 9 ? '9+' : String(unread)

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 shadow-2xl rounded-2xl overflow-hidden flex flex-col bg-white border border-gray-200"
          style={{ bottom: 80, right: 24, width: 360, height: 500 }}
        >
          {/* Header */}
          <div className="bg-[#1B9BF0] px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Hash size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Chat del equipo</p>
              <p className="text-[10px] text-white/70">@ · # proyecto · / tarea</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-all">
              <Minus size={15} className="text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <Hash size={28} className="mb-2 opacity-40" />
                <p className="text-xs">Sin mensajes aún</p>
              </div>
            )}
            {groupByDate(messages).map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 capitalize">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {group.msgs.map((msg, i) => {
                  const prev = group.msgs[i - 1]
                  const sameUser = prev?.user?.id === msg.user?.id &&
                    new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000
                  const own = msg.user?.id === userId
                  const mentioned = Array.isArray(msg.mentions) && msg.mentions.includes(userId)
                  return (
                    <div key={msg.id} className={'flex gap-2 ' + (own ? 'flex-row-reverse ' : '') + (sameUser ? 'mt-0.5' : 'mt-2.5')}>
                      {!sameUser && !own && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 shrink-0 mt-0.5">
                          {(msg.user?.full_name ?? '?')[0].toUpperCase()}
                        </div>
                      )}
                      {sameUser && !own && <div className="w-6 shrink-0" />}
                      <div className={'max-w-[78%] flex flex-col ' + (own ? 'items-end' : 'items-start')}>
                        {!sameUser && (
                          <span className={'text-[10px] text-gray-400 mb-0.5 ' + (own ? 'text-right' : '')}>
                            {own ? 'Tú' : (msg.user?.full_name ?? '')}
                            <span className="ml-1.5 text-gray-300">
                              {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        )}
                        <div className={'px-3 py-1.5 rounded-2xl text-sm leading-relaxed ' + (
                          own ? 'bg-[#1B9BF0] text-white rounded-tr-sm' :
                          mentioned ? 'bg-amber-50 border border-amber-200 text-gray-800 rounded-tl-sm' :
                          'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                        )}>
                          {renderContent(msg, users, projects, tasks, userId)}
                        </div>
                        {(msg.task || msg.project) && (
                          <div className="flex gap-2 mt-0.5">
                            {msg.task && <a href={'/tareas/' + msg.task.id} className="text-[10px] text-amber-600 hover:underline">→ {msg.task.title}</a>}
                            {msg.project && <a href={'/proyectos/' + msg.project.id} className="text-[10px] text-green-600 hover:underline">→ {msg.project.name}</a>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-white border-t border-gray-100 max-h-32 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button key={s.id} onClick={() => applySuggestion(s)}
                  className={'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ' + (i === suggestionIdx ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-700 hover:bg-gray-50')}>
                  <span className={'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ' + (
                    s.type === 'user' ? 'bg-purple-100 text-purple-600' :
                    s.type === 'project' ? 'bg-green-100 text-green-600' :
                    'bg-amber-100 text-amber-600'
                  )}>
                    {s.type === 'user' ? '@' : s.type === 'project' ? '#' : '/'}
                  </span>
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-gray-100 px-3 py-2.5 shrink-0">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-[#1B9BF0] focus-within:bg-white transition-all">
              <textarea
                ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
                placeholder="Escribí un mensaje... @ · # · /" rows={1}
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none max-h-24"
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = t.scrollHeight + 'px'
                }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-7 h-7 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-lg flex items-center justify-center disabled:opacity-30 transition-all shrink-0">
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed z-50 bottom-6 right-6 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52, background: open ? '#374151' : '#1B9BF0' }}
        title="Chat del equipo"
      >
        {open
          ? <X size={20} className="text-white" />
          : <MessageSquare size={20} className="text-white" />
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-1">
            {badgeNum}
          </span>
        )}
      </button>
    </>
  )
}
