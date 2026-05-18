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
  // Include image markdown ![](url) in the pattern
  const regex = /!\[\]\((https?:\/\/[^\s)]+)\)|@([\w ]+?)(?=\s|$)|#([\w ]+?)(?=\s|$)|\/(.+?)(?=\s|$)/g

  let m = regex.exec(content)
  while (m !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index))
    const full = m[0]
    if (m[1]) {
      // Image
      parts.push(
        React.createElement('img', {
          key: m.index,
          src: m[1],
          alt: '',
          className: 'max-w-full rounded-xl mt-1 max-h-64 object-contain block',
          onClick: () => window.open(m![1], '_blank'),
          style: { cursor: 'pointer' },
        })
      )
    } else if (full.startsWith('@') && m[2]) {
      const u = users.find(u => u.full_name === m![2])
      parts.push(
        React.createElement('span', {
          key: m.index,
          className: 'font-semibold ' + (u?.id === currentUserId ? 'text-[#1B9BF0]' : 'text-purple-600')
        }, full)
      )
    } else if (full.startsWith('#') && m[3]) {
      const p = projects.find(p => p.name === m![3])
      parts.push(p
        ? React.createElement('a', { key: m.index, href: '/proyectos/' + p.id, className: 'font-semibold text-green-600 hover:underline' }, full)
        : React.createElement('span', { key: m.index, className: 'font-semibold text-green-600' }, full)
      )
    } else if (m[4]) {
      const t = tasks.find(t => t.title === m![4])
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
