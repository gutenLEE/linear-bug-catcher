export interface NetworkLog {
  id: string
  method: string
  url: string
  status: number
  ok: boolean
  startedAt: number
  durationMs: number
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseHeaders: Record<string, string>
  responseBody: string | null
}

export interface Settings {
  apiKey: string
  teamId: string | null
  teamName: string | null
  projectId: string | null
  projectName: string | null
  /** glob patterns matched against the full request URL (allowlist) */
  capturePatterns: string[]
}

export interface LinearProject {
  id: string
  name: string
}

export interface LinearTeam {
  id: string
  name: string
  projects: LinearProject[]
}

export interface LinearViewer {
  id: string
  name: string
  email: string
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  teamId: null,
  teamName: null,
  projectId: null,
  projectName: null,
  capturePatterns: ['/api/*', '*/graphql'],
}

/** How many matched requests we keep per tab. */
export const BUFFER_LIMIT = 20

/**
 * How many bookmarked (pinned) logs we persist. Bookmarks survive page
 * navigation/reload by living in chrome.storage.local instead of the in-memory
 * buffer. FIFO: adding an 11th drops the oldest.
 */
export const BOOKMARK_LIMIT = 10
