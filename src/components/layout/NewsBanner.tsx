'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface NewsItem {
  id: string
  content: string
  visible_to: string[]
}

// Content format: "__STYLE__{\"bg\":\"#hex\",\"bt\":\"#hex\",\"bb\":\"#hex\"}__END__ text"
// bt = border-top color, bb = border-bottom color, bg = background color
function parseContent(raw: string): { display: string; bg: string; bt: string | null; bb: string | null } {
  const match = raw.match(/^__STYLE__({.*?})__END__\s*/)
  if (!match) return { display: raw, bg: '#22c55e', bt: null, bb: null }
  try {
    const c = JSON.parse(match[1])
    return {
      display: raw.slice(match[0].length),
      bg: c.bg ?? '#22c55e',
      bt: c.bt ?? null,
      bb: c.bb ?? null,
    }
  } catch {
    return { display: raw, bg: '#22c55e', bt: null, bb: null }
  }
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

  const { display, bg, bt, bb } = parseContent(news.content)

  return (
    <>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .marquee-track { animation: marquee 18s linear infinite; white-space: nowrap; }
      `}</style>
      <div
        className="fixed top-0 inset-x-0 z-[60] h-10 flex items-center overflow-hidden shadow-sm"
        style={{
          backgroundColor: bg,
          borderTop: bt ? `2px solid ${bt}` : undefined,
          borderBottom: bb ? `2px solid ${bb}` : undefined,
        }}
      >
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="marquee-track text-sm font-semibold tracking-wide px-4 text-white">
            🔔 &nbsp; {display} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 🔔 &nbsp; {display}
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 px-3 h-full flex items-center hover:brightness-90 transition-all border-l border-white/20 text-white"
        >
          <X size={14}/>
        </button>
      </div>
    </>
  )
}
