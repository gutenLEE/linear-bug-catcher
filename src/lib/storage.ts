import { BOOKMARK_LIMIT, DEFAULT_SETTINGS, type NetworkLog, type Settings } from './types'

const KEY = 'settings'
const BOOKMARKS_KEY = 'bookmarks'

export async function loadSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(KEY)
  return { ...DEFAULT_SETTINGS, ...(raw[KEY] as Partial<Settings> | undefined) }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings })
}

export function onSettingsChanged(cb: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings>) })
    }
  })
}

/** Bookmarked logs persist across navigation/reload; oldest-first order. */
export async function loadBookmarks(): Promise<NetworkLog[]> {
  const raw = await chrome.storage.local.get(BOOKMARKS_KEY)
  const list = raw[BOOKMARKS_KEY]
  return Array.isArray(list) ? (list as NetworkLog[]) : []
}

/**
 * Pin a log. No-op if already bookmarked. FIFO: once over BOOKMARK_LIMIT the
 * oldest bookmark is dropped. Returns the new list.
 */
export async function addBookmark(log: NetworkLog): Promise<NetworkLog[]> {
  const list = await loadBookmarks()
  if (list.some((l) => l.id === log.id)) return list
  const next = [...list, log]
  while (next.length > BOOKMARK_LIMIT) next.shift()
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: next })
  return next
}

/** Remove a bookmark — erases the stored log (and its bodies) from disk. */
export async function removeBookmark(id: string): Promise<NetworkLog[]> {
  const list = await loadBookmarks()
  const next = list.filter((l) => l.id !== id)
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: next })
  return next
}
