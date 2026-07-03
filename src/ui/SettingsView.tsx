import { useState } from 'react'
import type { LinearProject, LinearTeam, LinearViewer, Settings } from '../lib/types'
import type { ConnectResult, ProjectsResult } from '../lib/messages'
import { Icon } from './Icon'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onClose: () => void
  onDone: () => void
}

export function SettingsView({ settings, onChange, onClose, onDone }: Props) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [viewer, setViewer] = useState<LinearViewer | null>(null)
  const [teamId, setTeamId] = useState(settings.teamId)
  const [projectId, setProjectId] = useState(settings.projectId)
  const [projects, setProjects] = useState<LinearProject[]>([])
  const [patterns, setPatterns] = useState(settings.capturePatterns.join('\n'))
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [error, setError] = useState('')

  async function fetchProjects(id: string) {
    setProjects([])
    const res: ProjectsResult = await chrome.runtime.sendMessage({ type: 'LINEAR_PROJECTS', apiKey, teamId: id })
    if (res.ok && res.projects) setProjects(res.projects)
  }

  function selectTeam(id: string) {
    setTeamId(id)
    setProjectId(null)
    void fetchProjects(id)
  }

  async function pasteKey() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setApiKey(text.trim())
    } catch {
      setStatus('error')
      setError('Clipboard read blocked. Type the key manually or reload the tab and retry.')
    }
  }

  async function connect() {
    setStatus('connecting')
    setError('')
    const res: ConnectResult = await chrome.runtime.sendMessage({ type: 'LINEAR_CONNECT', apiKey })
    if (res.ok && res.viewer && res.teams) {
      setViewer(res.viewer)
      setTeams(res.teams)
      setStatus('idle')
      const initialTeam = teamId ?? res.teams[0]?.id ?? null
      if (initialTeam) {
        setTeamId(initialTeam)
        void fetchProjects(initialTeam)
      }
    } else {
      setStatus('error')
      setError(res.error || 'Connection failed')
    }
  }

  function save() {
    const t = teams.find((x) => x.id === teamId)
    const p = projects.find((x) => x.id === projectId)
    onChange({
      apiKey,
      teamId,
      teamName: t?.name ?? settings.teamName,
      projectId: projectId || null,
      projectName: p?.name ?? null,
      capturePatterns: patterns.split('\n').map((s) => s.trim()).filter(Boolean),
    })
    onDone()
  }

  const connected = !!viewer
  const canSave = !!apiKey && !!teamId

  return (
    <>
      <header className="head">
        <div className="head-title">
          <Icon name="settings" size={18} />
          <span>Settings · Linear</span>
        </div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>

      <div className="body">
        <label className="field-label">Linear personal API key</label>
        <div className="row">
          <input
            type="password"
            className="input mono"
            value={apiKey}
            placeholder="lin_api_..."
            onChange={(e) => setApiKey(e.target.value)}
            onPaste={(e) => e.stopPropagation()}
          />
          <button className="btn" aria-label="Paste from clipboard" title="Paste" onClick={pasteKey}>
            <Icon name="clipboard" size={15} />
          </button>
          <button className="btn" onClick={connect} disabled={!apiKey || status === 'connecting'}>
            {status === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {connected && (
          <div className="status ok">
            <Icon name="circle-check" /> Connected · {viewer!.name} ({viewer!.email})
          </div>
        )}
        {status === 'error' && (
          <div className="status err">
            <Icon name="alert-circle" /> {error}
          </div>
        )}

        {connected && (
          <div className="section two-col">
            <div>
              <label className="field-label">Default team</label>
              <select className="input" value={teamId ?? ''} onChange={(e) => selectTeam(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Default project</label>
              <select className="input" value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)}>
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="section">
          <label className="field-label">Network capture patterns (allowlist)</label>
          <p className="hint">Only matching requests are stored. Datadog and other telemetry are excluded automatically.</p>
          <textarea
            className="input mono"
            rows={3}
            value={patterns}
            onChange={(e) => setPatterns(e.target.value)}
          />
          <p className="hint">One per line · glob (*) · matched against the full URL</p>
        </div>

        <div className="warn">
          <Icon name="lock" />
          <span>Your API key is stored in this browser only (not encrypted). Use only on a managed company device.</span>
        </div>
      </div>

      <footer className="foot end">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!canSave}>
          Save
        </button>
      </footer>
    </>
  )
}
