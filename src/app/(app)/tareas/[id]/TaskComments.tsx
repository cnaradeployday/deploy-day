'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { MessageCircle, Send, Trash2 } from 'lucide-react'

export default function TaskComments({ taskId, currentUserId, initialComments }: {
  taskId: string
  currentUserId: string
  currentUserName: string
  initialComments: any[]
}) {
  const router = useRouter()
  const [comments, setComments] = useState<any[]>(initialComments)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel('comments-' + taskId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter: 'task_id=eq.' + taskId },
        async (payload) => {
          const { data } = await supabase
            .from('task_comments')
            .select('id, content, created_at, user:users(id, full_name)')
            .eq('id', payload.new.id).single()
          if (data) setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data])
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_comments', filter: 'task_id=eq.' + taskId },
        (payload) => setComments(prev => prev.filter(c => c.id !== payload.old.id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  async function sendComment() {
    if (!input.trim() || sending) return
    setSending(true)
    const { data } = await supabase.from('task_comments')
      .insert({ task_id: taskId, user_id: currentUserId, content: input.trim() })
      .select('id, content, created_at, user:users(id, full_name)').single()
    if (data) setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data])
    setInput('')
    setSending(false)
  }

  async function deleteComment(id: string) {
    await supabase.from('task_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
        <MessageCircle size={14} className="text-[#1B9BF0]"/>
        Comentarios {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
      </p>

      <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
        {!comments.length && (
          <p className="text-sm text-gray-400 text-center py-4">Sin comentarios aún</p>
        )}
        {comments.map(c => (
          <div key={c.id} className={'flex gap-3 group ' + (c.user?.id === currentUserId ? 'flex-row-reverse' : '')}>
            <div className="w-7 h-7 rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0 mt-0.5">
              {(c.user?.full_name ?? '?')[0].toUpperCase()}
            </div>
            <div className={'max-w-[80%] ' + (c.user?.id === currentUserId ? 'items-end flex flex-col' : '')}>
              <p className={'text-xs text-gray-400 mb-1 ' + (c.user?.id === currentUserId ? 'text-right' : '')}>
                {c.user?.id === currentUserId ? 'Tú' : c.user?.full_name}
                <span className="ml-2 text-gray-300">{new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
              <div className={'relative px-3.5 py-2 rounded-2xl text-sm ' + (c.user?.id === currentUserId ? 'bg-[#E8F4FE] text-gray-800 rounded-tr-sm' : 'bg-gray-50 text-gray-800 rounded-tl-sm')}>
                {c.content}
                {c.user?.id === currentUserId && (
                  <button onClick={() => deleteComment(c.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">
                    <Trash2 size={10}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-gray-50 pt-3">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() }}}
          placeholder="Escribí un comentario... (Enter para enviar)"
          rows={1}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"
          onInput={e => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = t.scrollHeight + 'px'
          }}/>
        <button onClick={sendComment} disabled={!input.trim() || sending}
          className="w-8 h-8 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl flex items-center justify-center disabled:opacity-30 transition-all shrink-0">
          <Send size={13}/>
        </button>
      </div>
    </div>
  )
}
