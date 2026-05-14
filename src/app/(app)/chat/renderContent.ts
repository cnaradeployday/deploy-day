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

  // Build all possible mention patterns, longest first to avoid partial matches
  type MentionEntry = { trigger: string; text: string; type: 'user' | 'project' | 'task'; id: string }
  const mentions: MentionEntry[] = [
    ...users.map(u => ({ trigger: '@', text: u.full_name, type: 'user' as const, id: u.id })),
    ...projects.map(p => ({ trigger: '#', text: p.name, type: 'project' as const, id: p.id })),
    ...tasks.map(t => ({ trigger: '/', text: t.title, type: 'task' as const, id: t.id })),
  ].sort((a, b) => (b.trigger + b.text).length - (a.trigger + a.text).length)

  let remaining = content
  let keyIdx = 0

  while (remaining.length > 0) {
    let earliest: { idx: number; entry: MentionEntry } | null = null

    for (const entry of mentions) {
      const pattern = entry.trigger + entry.text
      const idx = remaining.indexOf(pattern)
      if (idx !== -1 && (earliest === null || idx < earliest.idx)) {
        earliest = { idx, entry }
      }
    }

    if (!earliest) {
      parts.push(remaining)
      break
    }

    // Text before mention
    if (earliest.idx > 0) parts.push(remaining.slice(0, earliest.idx))

    const { entry } = earliest
    const full = entry.trigger + entry.text

    if (entry.type === 'user') {
      parts.push(React.createElement('span', {
        key: keyIdx++,
        className: 'font-semibold ' + (entry.id === currentUserId ? 'text-[#1B9BF0]' : 'text-purple-600')
      }, full))
    } else if (entry.type === 'project') {
      parts.push(React.createElement('a', {
        key: keyIdx++,
        href: '/proyectos/' + entry.id,
        className: 'font-semibold text-blue-600 hover:underline'
      }, full))
    } else {
      parts.push(React.createElement('a', {
        key: keyIdx++,
        href: '/tareas/' + entry.id,
        className: 'font-semibold text-amber-600 hover:underline'
      }, full))
    }

    remaining = remaining.slice(earliest.idx + full.length)
  }

  return parts
}
