'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
    <>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .marquee-track { animation: marquee 18s linear infinite; white-space: nowrap; }
      `}</style>
      <div className="fixed top-0 inset-x-0 z-[60] bg-green-500 text-white h-10 flex items-center overflow-hidden shadow-sm">
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="marquee-track text-sm font-semibold tracking-wide px-4">
            🔔 &nbsp; {news.content} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 🔔 &nbsp; {news.content}
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 px-3 h-full flex items-center hover:bg-green-600 transition-all border-l border-green-400"
        >
          <X size={14}/>
        </button>
      </div>
    </>
  )
}
