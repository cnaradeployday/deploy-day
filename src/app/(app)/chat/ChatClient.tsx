'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Send, Hash, AtSign, Link2 } from 'lucide-react'

interface Message {
  id: string
  content: string
  created_at: string
  mentions: string[]
  task_id: string | null
  project_id: string | null
  user: { id: string; full_name: string }
  task?: { id: string; title: string } | null
  project?: { id: string; name: string } | null
}

interface Suggestion {
  type: 'user' | 'task' | 'project'
  id: string
  label: string
}

export default function ChatClient({ initialMessages, currentUserId, users, tasks, projects }: {
  initialMessages: Message[]
  currentUserId: string
  users: { id: string; full_name: string }[]
  tasks: { id: string; title: string }[]
  projects: { id: string; name: string }[]
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [triggerPos, setTriggerPos] = useState<{ start: number; type: '@' | '#' | '/' } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel('global-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'is_global=eq.true'
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select(`id, content, created_at, mentions, task_id, project_id, is_global,
            user:users(id, full_name),
            task:tasks(id, title),
            project:projects(id, name)`)
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages(prev => [...prev, data as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    const hashMatch = textBefore.match(/#(\w*)$/)
    const slashMatch = textBefore.match(/\/(\w*)$/)

    if (atMatch) {
      const q = atMatch[1].toLowerCase()
      setSuggestions(users.filter(u => u.full_name.toLowerCase().includes(q))
        .map(u => ({ type: 'user', id: u.id, label: u.full_name })).slice(0, 5))
      setTriggerPos({ start: cursor - atMatch[0].length, type: '@' })
      setSuggestionIdx(0)
    } else if (hashMatch) {
      const q = hashMatch[1].toLowerCase()
      setSuggestions(projects.filter(p => p.name.toLowerCase().includes(q))
        .map(p => ({ type: 'project', id: p.id, label: p.name })).slice(0, 5))
      setTriggerPos({ start: cursor - hashMatch[0].length, type: '#' })
      setSuggestionIdx(0)
    } else if (slashMatch) {
      const q = slashMatch[1].toLowerCase()
      setSuggestions(tasks.filter(t => t.title.toLowerCase().includes(q))
        .map(t => ({ type: 'task', id: t.id, label: t.title })).slice(0, 5))
      setTriggerPos({ start: cursor - slashMatch[0].length, type: '/' })
      setSuggestionIdx(0)
    } else {
      setSuggestions([])
      setTriggerPos(null)
    }
  }

  function applySuggestion(s: Suggestion) {
    if (!triggerPos) return
    const prefix = input.slice(0, triggerPos.start)
    const suffix = input.slice(inputRef.current?.selectionStart ?? input.length)
    const tag = triggerPos.type === '@' ? `@${s.label} ` : triggerPos.type === '#' ? `#${s.label} ` : `/${s.label} `
    setInput(prefix + tag + suffix)
    setSuggestions([])
    setTriggerPos(null)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[suggestionIdx]); return }
      if (e.key === 'Escape') { setSuggestions([]); setTriggerPos(null) }
    }
    if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)

    const mentionedUsers = users.filter(u => input.includes(`@${u.full_name}`)).map(u => u.id)
    const mentionedTask = tasks.find(t => input.includes(`/${t.title}`))
    const mentionedProject = projects.find(p => input.includes(`#${p.name}`))

    await supabase.from('messages').insert({
      content: input.trim(),
      user_id: currentUserId,
      is_global: true,
      mentions: mentionedUsers,
      task_id: mentionedTask?.id ?? null,
      project_id: mentionedProject?.id ?? null,
    })

    setInput('')
    setSending(false)
  }

  function renderContent(msg: Message) {
    let content = msg.content
    const parts: React.ReactNode[] = []
    let last = 0

    const regex = /@([\w\s]+)|#([\w\s]+)|\/(.+?)(?=\s|$)/g
    let match

    while ((match = regex.exec(content)) !== null) {
      if (match.index > last) parts.push(content.slice(last, match.index))
      if (match[0].startsWith('@')) {
        const u = users.find(u => u.full_name === match[1])
        parts.push(<span key={match.index} className={`font-medium ${u?.id === currentUserId ? 'text-[#1B9BF0]' : 'text-purple-600'}`}>{match[0]}</span>)
      } else if (match[0].startsWith('#')) {
        const p = projects.find(p => p.name === match[2])
        parts.push(p
          ? <Link key={match.index} href={`/proyectos/${p.id}`} className="font-medium text-green-600 hover:underline">{match[0]}</Link>
          : <span key={match.index} className="font-medium text-green-600">{match[0]}</span>)
      } else if (match[0].startsWith('/')) {
        const t = tasks.find(t => t.title === match[3])
        parts.push(t
          ? <Link key={match.index} href={`/tareas/${t.id}`} className="font-medium text-amber-600 hover:underline">{match[0]}</Link>
          : <span key={match.index} className="font-medium text-amber-600">{match[0]}</span>)
      }
      last = match.index + match[0].length
    }

    if (last < content.length) parts.push(content.slice(last))
    return parts
  }

  function groupMessages(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      const last = groups[groups.length - 1]
      if (last && last.date === date) last.messages.push(msg)
      else groups.push({ date, messages: [msg] })
    })
    return groups
  }

  const isMentioned = (msg: Message) => msg.mentions?.includes(currentUserId)
  const isOwn = (msg: Message) => msg.user?.id === currentUserId

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Hash size={16} className="text-[#1B9BF0]"/> Chat del equipo
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Usá @ para mencionar, # para proyectos, / para tareas</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {!messages.length && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Hash size={32} className="mb-3 opacity-20"/>
            <p className="text-sm">Sin mensajes aún</p>
            <p className="text-xs mt-1">Empezá la conversación</p>
          </div>
        )}

        {groupMessages(messages).map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100"/>
              <span className="text-xs text-gray-400 capitalize">{group.date}</span>
              <div className="flex-1 h-px bg-gray-100"/>
            </div>
            {group.messages.map((msg, i) => {
              const prev = group.messages[i - 1]
              const sameUser = prev?.user?.id === msg.user?.id &&
                (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000
              const own = isOwn(msg)
              const mentioned = isMentioned(msg)

              return (
                <div key={msg.id} className={`flex gap-3 ${own ? 'flex-row-reverse' : ''} ${sameUser ? 'mt-0.5' : 'mt-3'}`}>
                  {!sameUser && !own && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0 mt-0.5">
                      {msg.user?.full_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  {sameUser && !own && <div className="w-7 shrink-0"/>}

                  <div className={`max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!sameUser && (
                      <span className={`text-xs text-gray-400 mb-1 ${own ? 'text-right' : ''}`}>
                        {own ? 'Tú' : msg.user?.full_name}
                        <span className="ml-2 text-gray-300">
                          {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    )}
                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      own
                        ? 'bg-[#1B9BF0] text-white rounded-tr-sm'
                        : mentioned
                        ? 'bg-amber-50 border border-amber-200 text-gray-800 rounded-tl-sm'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                      {renderContent(msg)}
                    </div>
                    {(msg.task || msg.project) && (
                      <div className="flex gap-2 mt-1">
                        {msg.task && (
                          <Link href={`/tareas/${msg.task.id}`}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
                            <Link2 size={10}/>{msg.task.title}
                          </Link>
                        )}
                        {msg.project && (
                          <Link href={`/proyectos/${msg.project.id}`}
                            className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                            <Link2 size={10}/>{msg.project.name}
                          </Link>
                        )}
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

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={s.id} onClick={() => applySuggestion(s)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                i === suggestionIdx ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                s.type === 'user' ? 'bg-purple-100 text-purple-600' :
                s.type === 'project' ? 'bg-green-100 text-green-600' :
                'bg-amber-100 text-amber-600'
              }`}>
                {s.type === 'user' ? '@' : s.type === 'project' ? '#' : '/'}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0">
        <div className="flex items-end gap-3 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200 focus-within:border-[#1B9BF0] focus-within:bg-white transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje... @ mencionar · # proyecto · / tarea"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none max-h-32"
            style={{ height: 'auto', minHeight: '24px' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = t.scrollHeight + 'px'
            }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-300">
              <span className="flex items-center gap-0.5"><AtSign size={11}/> mencionar</span>
              <span className="mx-1">·</span>
              <span className="flex items-center gap-0.5"><Hash size={11}/> proyecto</span>
              <span className="mx-1">·</span>
              <span>/ tarea</span>
            </div>
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="w-8 h-8 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all">
              <Send size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
