import React from 'react'

export function renderContent(
  msg: any,
  users: { id: string; full_name: string }[],
  projects: { id: string; name: string }[],
  tasks: { id: string; title: string }[],
  currentUserId: string
): React.ReactNode[] {
  const content: string = msg.content ?? ''
  const parts: React.ReactNode[] = []
  let last = 0
  const regex = /@([\w ]+?)(?=\s|$)|#([\w ]+?)(?=\s|$)|\/(.+?)(?=\s|$)/g

  let m = regex.exec(content)
  while (m !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index))
    const full = m[0]
    if (full.startsWith('@') && m[1]) {
      const u = users.find(u => u.full_name === m![1])
      parts.push(
        React.createElement('span', {
          key: m.index,
          className: 'font-semibold ' + (u?.id === currentUserId ? 'text-[#1B9BF0]' : 'text-purple-600')
        }, full)
      )
    } else if (full.startsWith('#') && m[2]) {
      const p = projects.find(p => p.name === m![2])
      parts.push(p
        ? React.createElement('a', { key: m.index, href: '/proyectos/' + p.id, className: 'font-semibold text-green-600 hover:underline' }, full)
        : React.createElement('span', { key: m.index, className: 'font-semibold text-green-600' }, full)
      )
    } else if (m[3]) {
      const t = tasks.find(t => t.title === m![3])
      parts.push(t
        ? React.createElement('a', { key: m.index, href: '/tareas/' + t.id, className: 'font-semibold text-amber-600 hover:underline' }, full)
        : React.createElement('span', { key: m.index, className: 'font-semibold text-amber-600' }, full)
      )
    }
    last = m.index + full.length
    m = regex.exec(content)
  }
  if (last < content.length) parts.push(content.slice(last))
  return parts
}
