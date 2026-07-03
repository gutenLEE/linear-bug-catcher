import { DEFAULT_SETTINGS, type NetworkLog } from '../lib/types'
import { urlMatchesAny } from '../lib/match'
import { stripNoisyHeaders } from '../lib/headers'
import { INTERCEPTOR_SOURCE, CONFIG_SOURCE } from '../lib/messages'

// Runs in the page's MAIN world at document_start so it sees every fetch/XHR the
// app makes. It only forwards requests whose URL matches the allowlist patterns,
// so Datadog RUM and other telemetry never leave this context.

let patterns: string[] = [...DEFAULT_SETTINGS.capturePatterns]

window.addEventListener('message', (e) => {
  const data = e.data
  if (e.source === window && data && data.source === CONFIG_SOURCE && Array.isArray(data.patterns)) {
    patterns = data.patterns
  }
})

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function post(log: NetworkLog): void {
  window.postMessage({ source: INTERCEPTOR_SOURCE, log }, '*')
}

function headersToObject(h: Headers | Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!h) return out
  if (h instanceof Headers) {
    h.forEach((v, k) => (out[k] = v))
  } else {
    for (const k of Object.keys(h)) out[k] = String(h[k])
  }
  return out
}

function bodyToString(body: unknown): string | null {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  return '[non-text body]'
}

function truncate(s: string | null, max = 100_000): string | null {
  if (s == null) return null
  return s.length > max ? `${s.slice(0, max)}… [truncated]` : s
}

// ---- fetch ----
const originalFetch = window.fetch
window.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
  const [input, init] = args
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase()
  const startedAt = Date.now()
  const shouldCapture = urlMatchesAny(url, patterns)

  const requestHeaders = headersToObject(
    init?.headers as Record<string, string> | Headers | undefined,
  )
  const requestBody = shouldCapture ? truncate(bodyToString(init?.body)) : null

  const response: Response = await originalFetch.apply(this, args as never)

  if (shouldCapture) {
    try {
      const clone = response.clone()
      const responseBody = truncate(await clone.text())
      post({
        id: newId(),
        method,
        url,
        status: response.status,
        ok: response.ok,
        startedAt,
        durationMs: Date.now() - startedAt,
        requestHeaders: stripNoisyHeaders(requestHeaders),
        requestBody,
        responseHeaders: stripNoisyHeaders(headersToObject(response.headers)),
        responseBody,
      })
    } catch {
      // reading the clone can fail (opaque responses); skip silently
    }
  }
  return response
}

// ---- XMLHttpRequest ----
interface TrackedXHR extends XMLHttpRequest {
  __lbc?: { method: string; url: string; startedAt: number; requestHeaders: Record<string, string>; body: string | null }
}

const originalOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (this: TrackedXHR, method: string, url: string | URL, ...rest: unknown[]) {
  this.__lbc = {
    method: (method || 'GET').toUpperCase(),
    url: typeof url === 'string' ? url : url.href,
    startedAt: 0,
    requestHeaders: {},
    body: null,
  }
  // @ts-expect-error passthrough of remaining args
  return originalOpen.call(this, method, url, ...rest)
}

const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader
XMLHttpRequest.prototype.setRequestHeader = function (this: TrackedXHR, name: string, value: string) {
  if (this.__lbc) this.__lbc.requestHeaders[name] = value
  return originalSetHeader.call(this, name, value)
}

const originalSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function (this: TrackedXHR, body?: Document | XMLHttpRequestBodyInit | null) {
  const meta = this.__lbc
  if (meta) {
    meta.startedAt = Date.now()
    meta.body = bodyToString(body)
    this.addEventListener('loadend', () => {
      if (!urlMatchesAny(meta.url, patterns)) return
      let responseBody: string | null = null
      try {
        responseBody = this.responseType === '' || this.responseType === 'text' ? this.responseText : '[non-text body]'
      } catch {
        responseBody = null
      }
      post({
        id: newId(),
        method: meta.method,
        url: meta.url,
        status: this.status,
        ok: this.status >= 200 && this.status < 400,
        startedAt: meta.startedAt,
        durationMs: Date.now() - meta.startedAt,
        requestHeaders: stripNoisyHeaders(meta.requestHeaders),
        requestBody: truncate(meta.body),
        responseHeaders: stripNoisyHeaders(parseRawHeaders(this.getAllResponseHeaders())),
        responseBody: truncate(responseBody),
      })
    })
  }
  return originalSend.call(this, body)
}

function parseRawHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(':')
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return out
}
