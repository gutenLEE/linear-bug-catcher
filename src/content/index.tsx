import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { App } from '../ui/App'
import { loadSettings, onSettingsChanged } from '../lib/storage'
import { BUFFER_LIMIT, type NetworkLog } from '../lib/types'
import { INTERCEPTOR_SOURCE, CONFIG_SOURCE, type RuntimeMessage } from '../lib/messages'
import styles from '../ui/styles.css?inline'

// Rolling buffer lives here (in the page's content-script context) so it survives
// the background service worker sleeping. Capped at BUFFER_LIMIT most-recent entries.
const buffer: NetworkLog[] = []

function pushLog(log: NetworkLog): void {
  buffer.push(log)
  if (buffer.length > BUFFER_LIMIT) buffer.splice(0, buffer.length - BUFFER_LIMIT)
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return
  const data = e.data
  if (data && data.source === INTERCEPTOR_SOURCE && data.log) pushLog(data.log as NetworkLog)
})

// Push the allowlist patterns into the MAIN-world interceptor, and keep it in sync.
async function syncConfig(): Promise<void> {
  const settings = await loadSettings()
  window.postMessage({ source: CONFIG_SOURCE, patterns: settings.capturePatterns }, '*')
}
void syncConfig()
onSettingsChanged(() => void syncConfig())

// ---- modal host (shadow DOM keeps page styles out) ----
let host: HTMLElement | null = null
let root: Root | null = null

function unmount(): void {
  root?.unmount()
  root = null
  host?.remove()
  host = null
}

function openModal(screenshot: string): void {
  if (host) unmount()
  host = document.createElement('div')
  host.id = 'linear-bug-catcher-host'
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = styles
  shadow.appendChild(style)
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  root = createRoot(mountPoint)
  root.render(
    createElement(App, {
      screenshot,
      logs: buffer.slice().reverse(), // newest first
      onClose: unmount,
    }),
  )
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === 'OPEN_MODAL') openModal(message.screenshot)
})
