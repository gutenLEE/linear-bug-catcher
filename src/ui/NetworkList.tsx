import { useMemo } from 'react'
import type { NetworkLog } from '../lib/types'

interface Props {
  logs: NetworkLog[]
  selected: Set<string>
  onToggle: (id: string) => void
}

function path(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

export function NetworkList({ logs, selected, onToggle }: Props) {
  // errors (4xx/5xx) first, then the rest, each newest-first (logs already newest-first)
  const ordered = useMemo(() => {
    const errors = logs.filter((l) => !l.ok)
    const rest = logs.filter((l) => l.ok)
    return [...errors, ...rest]
  }, [logs])

  return (
    <div className="col netcol">
      <div className="col-head">
        <span className="col-title">Network logs</span>
        <span className="muted-sm">last {logs.length}</span>
      </div>
      <div className="netlist">
        {ordered.length === 0 && <div className="empty">No matching requests captured.</div>}
        {ordered.map((l) => (
          <label key={l.id} className={`netrow ${l.ok ? '' : 'err'}`}>
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => onToggle(l.id)} />
            <span className={`code ${l.ok ? 'ok' : 'bad'}`}>{l.status || '—'}</span>
            <span className="netpath">
              {l.method} {path(l.url)}
            </span>
          </label>
        ))}
      </div>
      <p className="hint">Checked requests are attached to the ticket body as JSON.</p>
    </div>
  )
}
