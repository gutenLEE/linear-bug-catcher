import { useEffect, useRef, useState } from 'react'
import type { LinearProject, LinearTeam, NetworkLog, Settings } from '../lib/types'
import type { ConnectResult, CreateIssueResult, ProjectsResult } from '../lib/messages'
import { Annotator } from './Annotator'
import { NetworkList } from './NetworkList'
import { Icon } from './Icon'

interface Props {
  screenshot: string
  logs: NetworkLog[]
  settings: Settings
  onChange: (s: Settings) => void
  onOpenSettings: () => void
  onClose: () => void
}

export function ReportModal({ screenshot, logs, settings, onChange, onOpenSettings, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [requirements, setRequirements] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(logs.filter((l) => !l.ok).map((l) => l.id)))
  const [phase, setPhase] = useState<'edit' | 'creating' | 'done' | 'error'>('edit')
  const [result, setResult] = useState<CreateIssueResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])
  const exportRef = useRef<(() => string) | null>(null)

  const selectedLogs = logs.filter((l) => selected.has(l.id))

  // Load teams (and the current team's projects) so they can be switched here too.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!settings.apiKey) return
      const res: ConnectResult = await chrome.runtime.sendMessage({ type: 'LINEAR_CONNECT', apiKey: settings.apiKey })
      if (!cancelled && res.ok && res.teams) setTeams(res.teams)
      if (settings.teamId) {
        const pr: ProjectsResult = await chrome.runtime.sendMessage({
          type: 'LINEAR_PROJECTS',
          apiKey: settings.apiKey,
          teamId: settings.teamId,
        })
        if (!cancelled && pr.ok && pr.projects) setProjects(pr.projects)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiKey])

  async function changeTeam(id: string) {
    const t = teams.find((x) => x.id === id)
    onChange({ ...settings, teamId: id, teamName: t?.name ?? null, projectId: null, projectName: null })
    setProjects([])
    const pr: ProjectsResult = await chrome.runtime.sendMessage({ type: 'LINEAR_PROJECTS', apiKey: settings.apiKey, teamId: id })
    if (pr.ok && pr.projects) setProjects(pr.projects)
  }

  function changeProject(id: string) {
    const p = projects.find((x) => x.id === id)
    onChange({ ...settings, projectId: id || null, projectName: p?.name ?? null })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function create() {
    if (!settings.apiKey || !settings.teamId || !title.trim()) return
    setPhase('creating')
    const screenshotBase64 = exportRef.current?.() ?? screenshot
    const parts: string[] = []
    if (problem.trim()) parts.push(`## Problem\n\n${problem.trim()}`)
    if (requirements.trim()) parts.push(`## Requirements\n\n${requirements.trim()}`)
    const description = parts.join('\n\n')
    const res: CreateIssueResult = await chrome.runtime.sendMessage({
      type: 'CREATE_ISSUE',
      payload: {
        apiKey: settings.apiKey,
        teamId: settings.teamId,
        projectId: settings.projectId,
        title: title.trim(),
        description,
        screenshotBase64,
        logs: selectedLogs,
      },
    })
    setResult(res)
    setPhase(res.ok ? 'done' : 'error')
  }

  if (phase === 'done' && result?.ok) {
    return (
      <div className="done">
        <span className="big-check">
          <Icon name="circle-check" size={40} />
        </span>
        <p className="done-title">Ticket created</p>
        <a className="done-link" href={result.url} target="_blank" rel="noreferrer">
          {result.identifier} <Icon name="external-link" size={14} />
        </a>
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    )
  }

  return (
    <>
      <header className="head">
        <div className="head-title">
          <Icon name="bug" size={18} />
          <span>Linear Bug Catcher</span>
        </div>
        <div className="head-right">
          <select
            className="mini-select"
            aria-label="Team"
            value={settings.teamId ?? ''}
            onChange={(e) => changeTeam(e.target.value)}
          >
            {teams.length === 0 && <option value={settings.teamId ?? ''}>{settings.teamName ?? 'Team'}</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="mini-select"
            aria-label="Project"
            value={settings.projectId ?? ''}
            onChange={(e) => changeProject(e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <Icon name="settings" />
          </button>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
      </header>

      <div className={`body grid2 ${expanded ? 'expanded' : ''}`}>
        <Annotator
          screenshot={screenshot}
          exportRef={exportRef}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
        />
        <NetworkList logs={logs} selected={selected} onToggle={toggle} />
      </div>

      <div className="body pt0">
        <label className="field-label">Issue Title</label>
        <input
          className="input"
          placeholder="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>
          Problem
        </label>
        <textarea
          className="input"
          rows={4}
          placeholder="What went wrong, and how…"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          style={{ resize: 'none', overflowY: 'auto' }}
        />
        <label className="field-label" style={{ marginTop: 10 }}>
          Requirements
        </label>
        <textarea
          className="input"
          rows={4}
          placeholder="Expected behavior / acceptance criteria…"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          style={{ resize: 'none', overflowY: 'auto' }}
        />
      </div>

      <footer className="foot between">
        <span className="attach">
          <Icon name="paperclip" size={14} /> 1 image · {selectedLogs.length} request(s)
        </span>
        <div className="row">
          {phase === 'error' && <span className="status err small">{result?.error}</span>}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={create}
            disabled={phase === 'creating' || !title.trim() || !settings.teamId}
          >
            <Icon name="send" size={15} /> {phase === 'creating' ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </footer>
    </>
  )
}
