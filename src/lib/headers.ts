// Headers stripped from captured logs. Datadog RUM injects distributed-tracing
// headers into the app's own requests, which are noise in a bug report.
const DENY_PREFIXES = ['x-datadog', 'x-b3-']
const DENY_EXACT = new Set(['traceparent', 'tracestate', 'b3'])

export function stripNoisyHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(headers)) {
    const lk = key.toLowerCase()
    if (DENY_PREFIXES.some((p) => lk.startsWith(p))) continue
    if (DENY_EXACT.has(lk)) continue
    out[key] = headers[key]
  }
  return out
}
