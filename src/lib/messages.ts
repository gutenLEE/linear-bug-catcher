import type { NetworkLog, LinearTeam, LinearViewer, LinearProject } from './types'

/** Messages posted from the MAIN-world interceptor to the ISOLATED content script via window.postMessage. */
export const INTERCEPTOR_SOURCE = 'lbc-interceptor'
export const CONFIG_SOURCE = 'lbc-config'

export interface InterceptorMessage {
  source: typeof INTERCEPTOR_SOURCE
  log: NetworkLog
}

export interface ConfigMessage {
  source: typeof CONFIG_SOURCE
  patterns: string[]
}

/** Runtime messages (chrome.runtime / tabs.sendMessage) between content script and background. */
export type RuntimeMessage =
  | { type: 'OPEN_MODAL'; screenshot: string }
  | { type: 'LINEAR_CONNECT'; apiKey: string }
  | { type: 'LINEAR_PROJECTS'; apiKey: string; teamId: string }
  | { type: 'CREATE_ISSUE'; payload: CreateIssuePayload }

export interface CreateIssuePayload {
  apiKey: string
  teamId: string
  projectId: string | null
  title: string
  description: string
  screenshotBase64: string // data URL (image/png)
  logs: NetworkLog[]
}

export interface ConnectResult {
  ok: boolean
  error?: string
  viewer?: LinearViewer
  teams?: LinearTeam[]
}

export interface ProjectsResult {
  ok: boolean
  error?: string
  projects?: LinearProject[]
}

export interface CreateIssueResult {
  ok: boolean
  error?: string
  url?: string
  identifier?: string
}
