'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, Plus, Users, MessageSquare, X, Check, Search } from 'lucide-react'
import { renderContent } from './renderContent'
import ChatWindow from './ChatWindow'

export default function ChatLayout({ currentUserId, users, tasks, projects, globalMessages, conversations }: {
  currentUserId: string
  users: { id: string; full_name: string }[]
  tasks: { id: string; title: string }[]
  projects: { id: string; name: string }[]
  globalMessages: any[]
  conversations: any[]
}) {
  const [activeChat, setActiveChat] = useState<{ type: 'global' | 'conversation'; id?: string; name: string }>({ type: 'global', name: 'General' })
  const [convMessages, setConvMessages] = useState<Record<string, any[]>>({})
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [creating, setCreating] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const supabase = createClient()

  useEffect(() => {
    conversations.forEach(async (cm: any) => {
      const convId = cm.conversation_id
      const { data } = await supabase
        .from('messages')
        .select('id, content, created_at, mentions, task_id, project_id, conversation_id, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) setConvMessages(prev => ({ ...prev, [convId]: data }))

      // contar no leidos
      if (cm.last_read_at) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .gt('created_at', cm.last_read_at)
          .neq('user_id', currentUserId)
        setUnreadCounts(prev => ({ ...prev, [convId]: count ?? 0 }))
      }
    })
  }, [])

  useEffect(() => {
    const channel = supabase.channel('private-messages-' + currentUserId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new
        if (!msg.conversation_id || msg.is_global) return
        const { data } = await supabase
          .from('messages')
          .select('id, content, created_at, mentions, task_id, project_id, conversation_id, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
          .eq('id', msg.id).single()
        if (!data) return
        setConvMessages(prev => {
          const existing = prev[msg.conversation_id] ?? []
          if (existing.find((m: any) => m.id === data.id)) return prev
          return { ...prev, [msg.conversation_id]: [...existing, data] }
        })
        if (activeChat.id !== msg.conversation_id && msg.user_id !== currentUserId) {
          setUnreadCounts(prev => ({ ...prev, [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1 }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeChat])

  async function markRead(convId: string) {
    await supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', currentUserId)
    setUnreadCounts(prev => ({ ...prev, [convId]: 0 }))
  }

  async function createConversation() {
    if (selectedUsers.length === 0) return
    setCreating(true)
    const allMembers = [...new Set([currentUserId, ...selectedUsers])]

    if (!isGroup && selectedUsers.length === 1) {
      const existing = conversations.find((cm: any) => {
        const members = cm.conversation?.conversation_members?.map((m: any) => m.user_id) ?? []
        return !cm.conversation?.is_group && members.length === 2 && members.includes(selectedUsers[0])
      })
      if (existing) {
        const conv = existing.conversation
        const otherUser = users.find(u => u.id === selectedUsers[0])
        setActiveChat({ type: 'conversation', id: conv.id, name: otherUser?.full_name ?? 'Chat' })
        setShowNewChat(false)
        setCreating(false)
        return
      }
    }

    const { data: conv } = await supabase.from('conversations').insert({
      name: isGroup ? groupName || 'Grupo' : null,
      is_group: isGroup || selectedUsers.length > 1,
      created_by: currentUserId,
    }).select().single()

    if (!conv) { setCreating(false); return }

    await supabase.from('conversation_members').insert(
      allMembers.map(uid => ({ conversation_id: conv.id, user_id: uid }))
    )

    const name = isGroup ? (groupName || 'Grupo') :
      users.find(u => u.id === selectedUsers[0])?.full_name ?? 'Chat'

    setActiveChat({ type: 'conversation', id: conv.id, name })
    setShowNewChat(false)
    setSelectedUsers([])
    setGroupName('')
    setCreating(false)
    window.location.reload()
  }

  function getConvName(cm: any) {
    const conv = cm.conversation
    if (conv?.is_group) return conv.name ?? 'Grupo'
    const other = conv?.conversation_members?.find((m: any) => m.user_id !== currentUserId)
    return other?.user?.full_name ?? 'Chat'
  }

  const filteredUsers = users.filter(u =>
    u.id !== currentUserId &&
    u.full_name.toLowerCase().includes(newChatSearch.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Sidebar de conversaciones */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Mensajes</p>
          <button onClick={() => setShowNewChat(true)}
            className="w-7 h-7 bg-[#1B9BF0] text-white rounded-lg flex items-center justify-center hover:bg-[#0F7ACC] transition-all">
            <Plus size={14}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Canal general */}
          <button onClick={() => setActiveChat({ type: 'global', name: 'General' })}
            className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ' + (activeChat.type === 'global' ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-600 hover:bg-gray-50')}>
            <Hash size={15} className={activeChat.type === 'global' ? 'text-[#1B9BF0]' : 'text-gray-400'}/>
            <span className="font-medium">General</span>
          </button>

          {conversations.length > 0 && (
            <div className="px-4 pt-4 pb-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Directos</p>
            </div>
          )}

          {conversations.map((cm: any) => {
            const convId = cm.conversation_id
            const name = getConvName(cm)
            const unread = unreadCounts[convId] ?? 0
            const active = activeChat.id === convId
            const isGrp = cm.conversation?.is_group

            return (
              <button key={convId}
                onClick={() => { setActiveChat({ type: 'conversation', id: convId, name }); markRead(convId) }}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ' + (active ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-600 hover:bg-gray-50')}>
                <div className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ' + (active ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600')}>
                  {isGrp ? <Users size={13}/> : name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-left truncate">{name}</span>
                {unread > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Ventana de chat */}
      <div className="flex-1 min-w-0">
        {activeChat.type === 'global' ? (
          <ChatWindow
            key="global"
            conversationId={null}
            isGlobal={true}
            name="General"
            currentUserId={currentUserId}
            users={users}
            tasks={tasks}
            projects={projects}
            initialMessages={globalMessages}
          />
        ) : activeChat.id ? (
          <ChatWindow
            key={activeChat.id}
            conversationId={activeChat.id}
            isGlobal={false}
            name={activeChat.name}
            currentUserId={currentUserId}
            users={users}
            tasks={tasks}
            projects={projects}
            initialMessages={convMessages[activeChat.id] ?? []}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={32} className="mb-3 opacity-20"/>
            <p className="text-sm">Seleccioná una conversación</p>
          </div>
        )}
      </div>

      {/* Modal nuevo chat */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">Nueva conversación</p>
              <button onClick={() => { setShowNewChat(false); setSelectedUsers([]); setGroupName('') }}>
                <X size={18} className="text-gray-400"/>
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setIsGroup(false)}
                className={'flex-1 py-2 rounded-xl text-sm font-medium transition-all ' + (!isGroup ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600')}>
                Directo
              </button>
              <button onClick={() => setIsGroup(true)}
                className={'flex-1 py-2 rounded-xl text-sm font-medium transition-all ' + (isGroup ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600')}>
                Grupo
              </button>
            </div>

            {isGroup && (
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Nombre del grupo"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] mb-3"/>
            )}

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
              <input type="text" value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)}
                placeholder="Buscar personas..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {filteredUsers.map(u => {
                const selected = selectedUsers.includes(u.id)
                return (
                  <button key={u.id}
                    onClick={() => setSelectedUsers(prev =>
                      selected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                    )}
                    className={'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ' + (selected ? 'bg-[#E8F4FE]' : 'hover:bg-gray-50')}>
                    <div className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ' + (selected ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600')}>
                      {selected ? <Check size={12}/> : u.full_name[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{u.full_name}</span>
                  </button>
                )
              })}
            </div>

            <button onClick={createConversation} disabled={selectedUsers.length === 0 || creating}
              className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {creating ? 'Creando...' : selectedUsers.length === 0 ? 'Seleccioná personas' : isGroup ? 'Crear grupo' : 'Iniciar chat'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
