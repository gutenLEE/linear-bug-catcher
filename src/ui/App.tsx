import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NetworkLog, Settings } from '../lib/types'
import { addBookmark, loadBookmarks, loadSettings, removeBookmark, saveSettings } from '../lib/storage'
import { ReportModal } from './ReportModal'
import { SettingsView } from './SettingsView'

interface Props {
  screenshot: string
  logs: NetworkLog[]
  onClose: () => void
}

type View = 'report' | 'settings'

export function App({ screenshot, logs, onClose }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [view, setView] = useState<View>('report')
  const [bookmarks, setBookmarks] = useState<NetworkLog[]>([])

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s)
      setView(s.apiKey && s.teamId ? 'report' : 'settings')
    })
  }, [])

  useEffect(() => {
    loadBookmarks().then(setBookmarks)
  }, [])

  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks])

  // Live buffer plus any bookmarks not currently in the buffer (they survived a
  // navigation), deduped by id so a still-live bookmarked request shows once.
  const mergedLogs = useMemo(() => {
    const live = new Set(logs.map((l) => l.id))
    return [...logs, ...bookmarks.filter((b) => !live.has(b.id))]
  }, [logs, bookmarks])

  const toggleBookmark = useCallback(
    async (log: NetworkLog) => {
      setBookmarks(bookmarkedIds.has(log.id) ? await removeBookmark(log.id) : await addBookmark(log))
    },
    [bookmarkedIds],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function persist(next: Settings) {
    setSettings(next)
    await saveSettings(next)
  }

  if (!settings) return null

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        {view === 'settings' ? (
          <SettingsView
            settings={settings}
            onChange={persist}
            onClose={onClose}
            onDone={() => setView('report')}
          />
        ) : (
          <ReportModal
            screenshot={screenshot}
            logs={mergedLogs}
            settings={settings}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={toggleBookmark}
            onChange={persist}
            onOpenSettings={() => setView('settings')}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
