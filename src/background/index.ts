import { connect, createIssue, listProjects } from '../lib/linear'
import type { RuntimeMessage, ConnectResult, CreateIssueResult, ProjectsResult } from '../lib/messages'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function trySend(tabId: number, screenshot: string): Promise<boolean> {
  return chrome.tabs
    .sendMessage(tabId, { type: 'OPEN_MODAL', screenshot })
    .then(() => true)
    .catch(() => false)
}

/**
 * Inject the ISOLATED content script on demand. Needed when the tab was already
 * open before the extension was (re)loaded, so the manifest-declared content
 * script never got a chance to register its message listener.
 */
async function injectContentScript(tabId: number): Promise<boolean> {
  const scripts = chrome.runtime.getManifest().content_scripts ?? []
  const isolated = scripts.find((c) => (c as { world?: string }).world !== 'MAIN')
  const files = isolated?.js
  if (!files?.length) return false
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files })
    return true
  } catch (e) {
    console.error('[bug-catcher] executeScript failed', e)
    return false
  }
}

async function openReporter(tab?: chrome.tabs.Tab): Promise<void> {
  const active = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (!active?.id || active.windowId == null) return
  if (active.url && /^(chrome|edge|about|chrome-extension|https:\/\/chromewebstore)/.test(active.url)) {
    // Can't capture or inject into browser-internal or Web Store pages.
    return
  }

  let screenshot: string
  try {
    screenshot = await chrome.tabs.captureVisibleTab(active.windowId, { format: 'png' })
  } catch (e) {
    console.error('[bug-catcher] captureVisibleTab failed', e)
    return
  }

  // Fast path: content script already present.
  if (await trySend(active.id, screenshot)) return

  // Fallback: inject it, then retry while the module finishes loading.
  if (!(await injectContentScript(active.id))) {
    console.error('[bug-catcher] content script not reachable (reload the tab)')
    return
  }
  for (let i = 0; i < 15; i++) {
    await sleep(120)
    if (await trySend(active.id, screenshot)) return
  }
  console.error('[bug-catcher] could not open modal after injection (reload the tab)')
}

chrome.action.onClicked.addListener((tab) => void openReporter(tab))
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-bug-catcher') void openReporter()
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'LINEAR_CONNECT') {
    connect(message.apiKey)
      .then((r) => sendResponse({ ok: true, ...r } satisfies ConnectResult))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) } satisfies ConnectResult))
    return true
  }
  if (message.type === 'LINEAR_PROJECTS') {
    listProjects(message.apiKey, message.teamId)
      .then((projects) => sendResponse({ ok: true, projects } satisfies ProjectsResult))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) } satisfies ProjectsResult))
    return true
  }
  if (message.type === 'CREATE_ISSUE') {
    createIssue(message.payload)
      .then((issue) => sendResponse({ ok: true, ...issue } satisfies CreateIssueResult))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) } satisfies CreateIssueResult))
    return true
  }
  return undefined
})
