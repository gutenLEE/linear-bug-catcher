import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { Icon } from './Icon'

type Tool = 'rect' | 'arrow' | 'text' | 'mosaic'

interface Annotation {
  tool: 'rect' | 'arrow' | 'text'
  x1: number
  y1: number
  x2: number
  y2: number
  text?: string
}

interface Props {
  screenshot: string
  exportRef: MutableRefObject<(() => string) | null>
  expanded: boolean
  onToggleExpand: () => void
}

const RED = '#e5484d'

export function Annotator({ screenshot, exportRef, expanded, onToggleExpand }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const annotations = useRef<Annotation[]>([])
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool>('rect')
  const [ready, setReady] = useState(false)

  // load screenshot into the base canvas
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const base = baseRef.current
      base.width = img.naturalWidth
      base.height = img.naturalHeight
      base.getContext('2d')!.drawImage(img, 0, 0)
      const display = displayRef.current!
      display.width = img.naturalWidth
      display.height = img.naturalHeight
      setReady(true)
    }
    img.src = screenshot
  }, [screenshot])

  useEffect(() => {
    if (ready) redraw()
    exportRef.current = () => displayRef.current?.toDataURL('image/png') ?? screenshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  function lineWidth() {
    return Math.max(2, Math.round((displayRef.current?.width ?? 800) / 400))
  }

  function drawOne(ctx: CanvasRenderingContext2D, a: Annotation, preview = false) {
    ctx.strokeStyle = RED
    ctx.fillStyle = RED
    ctx.lineWidth = lineWidth()
    const { x1, y1, x2, y2 } = a
    if (a.tool === 'rect') {
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    } else if (a.tool === 'arrow') {
      const head = Math.max(10, lineWidth() * 5)
      const angle = Math.atan2(y2 - y1, x2 - x1)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    } else if (a.tool === 'text' && a.text) {
      const size = Math.max(14, Math.round((displayRef.current?.width ?? 800) / 45))
      ctx.font = `${size}px sans-serif`
      ctx.textBaseline = 'top'
      if (preview) return
      ctx.fillText(a.text, x1, y1)
    }
  }

  function redraw(preview?: Annotation) {
    const display = displayRef.current
    if (!display) return
    const ctx = display.getContext('2d')!
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(baseRef.current, 0, 0)
    for (const a of annotations.current) drawOne(ctx, a)
    if (preview) drawOne(ctx, preview, true)
  }

  function pixelate(x: number, y: number, w: number, h: number, size = 14) {
    const ctx = baseRef.current.getContext('2d')!
    const rx = Math.max(0, Math.round(Math.min(x, x + w)))
    const ry = Math.max(0, Math.round(Math.min(y, y + h)))
    const rw = Math.round(Math.abs(w))
    const rh = Math.round(Math.abs(h))
    if (rw < 2 || rh < 2) return
    const img = ctx.getImageData(rx, ry, rw, rh)
    const d = img.data
    for (let by = 0; by < rh; by += size) {
      for (let bx = 0; bx < rw; bx += size) {
        const sp = (by * rw + bx) * 4
        const r = d[sp]
        const g = d[sp + 1]
        const b = d[sp + 2]
        for (let yy = by; yy < Math.min(by + size, rh); yy++) {
          for (let xx = bx; xx < Math.min(bx + size, rw); xx++) {
            const p = (yy * rw + xx) * 4
            d[p] = r
            d[p + 1] = g
            d[p + 2] = b
          }
        }
      }
    }
    ctx.putImageData(img, rx, ry) // destructive: original pixels are overwritten
  }

  function toCanvas(e: React.PointerEvent) {
    const display = displayRef.current!
    const rect = display.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * display.width,
      y: ((e.clientY - rect.top) / rect.height) * display.height,
    }
  }

  function onDown(e: React.PointerEvent) {
    if (!ready) return
    const p = toCanvas(e)
    if (tool === 'text') {
      const text = window.prompt('Annotation text')
      if (text) {
        annotations.current.push({ tool: 'text', x1: p.x, y1: p.y, x2: p.x, y2: p.y, text })
        redraw()
      }
      return
    }
    drag.current = p
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current) return
    const p = toCanvas(e)
    if (tool === 'mosaic') {
      redraw({ tool: 'rect', x1: drag.current.x, y1: drag.current.y, x2: p.x, y2: p.y })
    } else if (tool === 'rect' || tool === 'arrow') {
      redraw({ tool, x1: drag.current.x, y1: drag.current.y, x2: p.x, y2: p.y })
    }
  }

  function onUp(e: React.PointerEvent) {
    if (!drag.current) return
    const p = toCanvas(e)
    const start = drag.current
    drag.current = null
    if (tool === 'mosaic') {
      pixelate(start.x, start.y, p.x - start.x, p.y - start.y)
      redraw()
    } else if (tool === 'rect' || tool === 'arrow') {
      annotations.current.push({ tool, x1: start.x, y1: start.y, x2: p.x, y2: p.y })
      redraw()
    }
  }

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'rect', icon: 'square', label: 'Rectangle' },
    { id: 'arrow', icon: 'arrow-up-right', label: 'Arrow' },
    { id: 'text', icon: 'typography', label: 'Text' },
    { id: 'mosaic', icon: 'grid-dots', label: 'Blur / mosaic' },
  ]

  return (
    <div className="col">
      <div className="toolbar">
        {tools.map((t) => (
          <button
            key={t.id}
            className={`tool ${tool === t.id ? 'active' : ''}`}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTool(t.id)}
          >
            <Icon name={t.icon} />
          </button>
        ))}
        <button
          className="tool"
          aria-label={expanded ? 'Collapse' : 'Expand to edit'}
          title={expanded ? 'Collapse' : 'Expand to edit'}
          onClick={onToggleExpand}
          style={{ marginLeft: 'auto' }}
        >
          <Icon name={expanded ? 'minimize' : 'maximize'} />
        </button>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={displayRef}
          className={`canvas tool-${tool}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      </div>
    </div>
  )
}
