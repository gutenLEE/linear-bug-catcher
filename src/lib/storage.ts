import { DEFAULT_SETTINGS, type Settings } from './types'

const KEY = 'settings'

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
