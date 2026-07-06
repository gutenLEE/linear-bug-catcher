import { useMemo } from 'react'
import type { NetworkLog } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  logs: NetworkLog[]
  selected: Set<string>
  onToggle: (id: string) => void
  bookmarkedIds: Set<string>
  onToggleBookmark: (log: NetworkLog) => void
}

function path(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

export function NetworkList({ logs, selected, onToggle, bookmarkedIds, onToggleBookmark }: Props) {
  // bookmarked first (always visible), then errors (4xx/5xx), then the rest —
  // each newest-first (logs already newest-first)
  const ordered = useMemo(() => {
    const pinned = logs.filter((l) => bookmarkedIds.has(l.id))
    const rest = logs.filter((l) => !bookmarkedIds.has(l.id))
    const errors = rest.filter((l) => !l.ok)
    const ok = rest.filter((l) => l.ok)
    return [...pinned, ...errors, ...ok]
  }, [logs, bookmarkedIds])

  return (
    <div className="col netcol">
      <div className="col-head">
        <span className="col-title">Network logs</span>
        <span className="muted-sm">last {logs.length}</span>
      </div>
      <div className="netlist">
        {ordered.length === 0 && <div className="empty">No matching requests captured.</div>}
        {ordered.map((l) => {
          const pinned = bookmarkedIds.has(l.id)
          return (
            <label key={l.id} className={`netrow ${l.ok ? '' : 'err'} ${pinned ? 'pinned' : ''}`}>
              <button
                type="button"
                className={`pin-btn ${pinned ? 'on' : ''}`}
                aria-label={pinned ? 'Remove bookmark' : 'Bookmark this request'}
                title={pinned ? 'Bookmarked — kept across page navigation. Click to remove.' : 'Bookmark — keep this request across page navigation'}
                onClick={(e) => {
                  // don't let the row's label toggle the attach checkbox
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleBookmark(l)
                }}
              >
                <Icon name={pinned ? 'bookmark-filled' : 'bookmark'} size={15} />
              </button>
              <input type="checkbox" checked={selected.has(l.id)} onChange={() => onToggle(l.id)} />
              <span className={`code ${l.ok ? 'ok' : 'bad'}`}>{l.status || '—'}</span>
              <span className="netpath">
                {l.method} {path(l.url)}
              </span>
            </label>
          )
        })}
      </div>
      <p className="hint">Checked requests are attached to the ticket. Bookmarked requests are kept across page navigation.</p>
    </div>
  )
}
