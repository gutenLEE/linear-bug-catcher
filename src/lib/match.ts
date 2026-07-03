/**
 * Convert a glob pattern (supporting `*`) into a RegExp and test it against a
 * full request URL. Used for the network-capture allowlist so that only the
 * app's own endpoints are stored — Datadog RUM and other telemetry never match.
 */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex specials
    .replace(/\*/g, '.*') // glob star -> match anything
  return new RegExp(escaped)
}

export function urlMatchesAny(url: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (!p.trim()) continue
    try {
      if (globToRegExp(p).test(url)) return true
    } catch {
      // ignore malformed patterns
    }
  }
  return false
}
