import type { LinearProject, LinearTeam, LinearViewer, NetworkLog } from './types'

const ENDPOINT = 'https://api.linear.app/graphql'

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey, // personal API keys go in Authorization with no "Bearer" prefix
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '))
  }
  return json.data as T
}

export async function connect(apiKey: string): Promise<{ viewer: LinearViewer; teams: LinearTeam[] }> {
  // Projects are loaded lazily per-team — fetching teams×projects together
  // exceeds Linear's query-complexity limit (10000).
  const data = await gql<{
    viewer: LinearViewer
    teams: { nodes: { id: string; name: string }[] }
  }>(
    apiKey,
    `query {
      viewer { id name email }
      teams(first: 250) { nodes { id name } }
    }`,
  )
  return {
    viewer: data.viewer,
    teams: data.teams.nodes.map((t) => ({ id: t.id, name: t.name, projects: [] })),
  }
}

export async function listProjects(apiKey: string, teamId: string): Promise<LinearProject[]> {
  const data = await gql<{ team: { projects: { nodes: LinearProject[] } } }>(
    apiKey,
    `query TeamProjects($id: String!) {
      team(id: $id) { projects(first: 250) { nodes { id name } } }
    }`,
    { id: teamId },
  )
  return data.team.projects.nodes
}

/** Upload an image to Linear's storage and return the public asset URL to embed in markdown. */
async function uploadImage(apiKey: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const contentType = blob.type || 'image/png'
  const filename = `bug-catcher-${Date.now()}.png`

  const data = await gql<{
    fileUpload: {
      success: boolean
      uploadFile: { uploadUrl: string; assetUrl: string; headers: { key: string; value: string }[] }
    }
  }>(
    apiKey,
    `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }`,
    { contentType, filename, size: blob.size },
  )

  if (!data.fileUpload?.success) throw new Error('Linear rejected the file upload')
  const { uploadUrl, assetUrl, headers } = data.fileUpload.uploadFile

  const putHeaders = new Headers({ 'Content-Type': contentType })
  for (const h of headers) putHeaders.set(h.key, h.value)

  const put = await fetch(uploadUrl, { method: 'PUT', headers: putHeaders, body: blob })
  if (!put.ok) throw new Error(`Image upload failed (${put.status})`)

  return assetUrl
}

function formatLog(log: NetworkLog): string {
  const payload = {
    request: { method: log.method, url: log.url, headers: log.requestHeaders, body: safeParse(log.requestBody) },
    response: { status: log.status, headers: log.responseHeaders, body: safeParse(log.responseBody) },
  }
  // Wrap the request line in inline code so Linear doesn't auto-link the URL.
  return `### ${log.ok ? '' : '🔴 '}\`${log.method} ${log.url} — ${log.status}\`\n\n\`\`\`json\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n\`\`\``
}

function safeParse(body: string | null): unknown {
  if (body == null) return null
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export async function createIssue(opts: {
  apiKey: string
  teamId: string
  projectId: string | null
  title: string
  description: string
  screenshotBase64: string
  logs: NetworkLog[]
}): Promise<{ url: string; identifier: string }> {
  const assetUrl = await uploadImage(opts.apiKey, opts.screenshotBase64)

  const sections: string[] = []
  if (opts.description.trim()) sections.push(opts.description.trim())
  sections.push(`## Screenshot\n\n![screenshot](${assetUrl})`)
  if (opts.logs.length) {
    sections.push(`## Network logs\n\n${opts.logs.map(formatLog).join('\n\n')}`)
  }
  const description = sections.join('\n\n')

  const data = await gql<{
    issueCreate: { success: boolean; issue: { url: string; identifier: string } }
  }>(
    opts.apiKey,
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { url identifier } }
    }`,
    {
      input: {
        teamId: opts.teamId,
        title: opts.title,
        description,
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
      },
    },
  )

  if (!data.issueCreate?.success) throw new Error('Linear rejected the issue')
  return data.issueCreate.issue
}
