'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Hash } from 'lucide-react'
import { renderContent } from './renderContent'

export default function ChatClient({ initialMessages, currentUserId, users, tasks, projects }: {
  initialMessages: any[]
  currentUserId: string
  users: { id: string; full_name: string }[]
  tasks: { id: string; title: string }[]
  projects: { id: string; name: string }[]
}) {
  const [messages, setMessages] = useState<any[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<{ type: string; id: string; label: string }[]>([])
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [triggerPos, setTriggerPos] = useState<{ start: number; type: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem('chat_last_read', new Date().toISOString())
    const sb = supabaseRef.current

    const channel = sb
      .channel('realtime-chat-' + Math.random())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        if (!payload.new.is_global) return
        const { data } = await sb
          .from('messages')
          .select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev
            return [...prev, data]
          })
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

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
    const sb = supabaseRef.current
    const mentionedUsers = users.filter(u => input.includes('@' + u.full_name)).map(u => u.id)
    const mentionedTask = tasks.find(t => input.includes('/' + t.title))
    const mentionedProject = projects.find(p => input.includes('#' + p.name))

    const { data, error } = await sb.from('messages').insert({
      content: input.trim(),
      user_id: currentUserId,
      is_global: true,
      mentions: mentionedUsers,
      task_id: mentionedTask?.id ?? null,
      project_id: mentionedProject?.id ?? null,
    }).select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)').single()

    if (data) {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev
        return [...prev, data]
      })
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Hash size={16} className="text-[#1B9BF0]"/> Chat del equipo
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">@ mencionar · # proyecto · / tarea</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Hash size={32} className="mb-3 opacity-20"/>
            <p className="text-sm">Sin mensajes aún</p>
          </div>
        )}
        {groupByDate(messages).map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100"/>
              <span className="text-xs text-gray-400 capitalize">{group.date}</span>
              <div className="flex-1 h-px bg-gray-100"/>
            </div>
            {group.msgs.map((msg, i) => {
              const prev = group.msgs[i - 1]
              const sameUser = prev?.user?.id === msg.user?.id &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 300000
              const own = msg.user?.id === currentUserId
              const mentioned = Array.isArray(msg.mentions) && msg.mentions.includes(currentUserId)
              return (
                <div key={msg.id} className={'flex gap-3 ' + (own ? 'flex-row-reverse ' : '') + (sameUser ? 'mt-0.5' : 'mt-3')}>
                  {!sameUser && !own && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0 mt-0.5">
                      {(msg.user?.full_name ?? '?')[0].toUpperCase()}
                    </div>
                  )}
                  {sameUser && !own && <div className="w-7 shrink-0"/>}
                  <div className={'max-w-[75%] flex flex-col ' + (own ? 'items-end' : 'items-start')}>
                    {!sameUser && (
                      <span className={'text-xs text-gray-400 mb-1 ' + (own ? 'text-right' : '')}>
                        {own ? 'Tú' : (msg.user?.full_name ?? '')}
                        <span className="ml-2 text-gray-300">
                          {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    )}
                    <div className={'px-3.5 py-2 rounded-2xl text-sm leading-relaxed ' + (
                      own ? 'bg-[#1B9BF0] text-white rounded-tr-sm' :
                      mentioned ? 'bg-amber-50 border border-amber-200 text-gray-800 rounded-tl-sm' :
                      'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                    )}>
                      {renderContent(msg, users, projects, tasks, currentUserId)}
                    </div>
                    {(msg.task || msg.project) && (
                      <div className="flex gap-2 mt-1">
                        {msg.task && <a href={'/tareas/' + msg.task.id} className="text-xs text-amber-600 hover:underline">→ {msg.task.title}</a>}
                        {msg.project && <a href={'/proyectos/' + msg.project.id} className="text-xs text-green-600 hover:underline">→ {msg.project.name}</a>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      {suggestions.length > 0 && (
        <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={s.id} onClick={() => applySuggestion(s)}
              className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ' + (i === suggestionIdx ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-700 hover:bg-gray-50')}>
              <span className={'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ' + (
                s.type === 'user' ? 'bg-purple-100 text-purple-600' :
                s.type === 'project' ? 'bg-green-100 text-green-600' :
                'bg-amber-100 text-amber-600'
              )}>
                {s.type === 'user' ? '@' : s.type === 'project' ? '#' : '/'}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0">
        <div className="flex items-end gap-3 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200 focus-within:border-[#1B9BF0] focus-within:bg-white transition-all">
          <textarea ref={inputRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje... @ · # · /"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none max-h-32"
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = t.scrollHeight + 'px'
            }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="w-8 h-8 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all shrink-0">
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  )
}
