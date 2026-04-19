'use client'
import { useState, useEffect } from 'react'
import { X, Megaphone } from 'lucide-react'

interface NewsItem {
  id: string
  content: string
  visible_to: string[]
}

export default function NewsBanner({ news, userId }: { news: NewsItem | null; userId: string }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!news) return
    const key = 'news_dismissed_' + news.id
    if (localStorage.getItem(key)) setDismissed(true)
    else setDismissed(false)
  }, [news?.id])

  if (!news || dismissed) return null

  const isVisible =
    news.visible_to.includes('all') ||
    news.visible_to.includes(userId)

  if (!isVisible) return null

  function dismiss() {
    localStorage.setItem('news_dismissed_' + news!.id, '1')
    setDismissed(true)
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-[#1B9BF0] text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Megaphone size={14} className="shrink-0 opacity-80"/>
        <p className="text-sm font-medium truncate">{news.content}</p>
      </div>
      <button onClick={dismiss} className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-all">
        <X size={14}/>
      </button>
    </div>
  )
}
