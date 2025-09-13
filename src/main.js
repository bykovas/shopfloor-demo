// Start/Finish + Task nodes; manual auto-layout; animated edges; Shadow-DOM-safe colors; JSON export
import { NodeEditor, ClassicPreset } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { VuePlugin, Presets as VuePresets } from 'rete-vue-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin'
import ELK from 'elkjs/lib/elk.bundled.js'

const any = new ClassicPreset.Socket('any')
if (!window.__rete) window.__rete = {}

const waitMounted = () =>
  new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))

function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
}

/** High-contrast palettes per node kind */
const PALETTES = {
  start:  { bg: '#CFE3FF', border: '#5A8FD8', text: '#2B6CB0' }, // blue
  finish: { bg: '#C9F3D6', border: '#62B37A', text: '#2F855A' }, // green
  task:   { bg: '#FFE8B3', border: '#E0A200', text: '#B7791F' }  // orange
}

/** Shadow DOM safe coloring: wait for mount and style inner ".node" + ".title" */
async function colorizeNode(area, node, kind) {
  await waitMounted()
  const view = area.nodeViews?.get(node.id)
  const host = view?.element || view?.root || null
  if (!host) return
  const box = host.querySelector?.('.node') || host

  const pal = PALETTES[kind] ?? PALETTES.task

  // body
  box.style.background = pal.bg
  box.style.border = `1px solid ${pal.border}`
  box.style.borderRadius = '12px'
  box.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)'

  // apply text color for all descendants
  box.style.color = pal.text
  box.querySelectorAll('*').forEach(el => {
    el.style.color = pal.text
  })
}
/* ===== Node types ===== */

// Start: only OUT
class StartNode extends ClassicPreset.Node {
  width = 420; height = 120
  constructor(title = 'Job Received') {
    super(title)
    this._kind = 'start'
    this.addOutput('out', new ClassicPreset.Output(any, 'flow'))
  }
}

// Finish: only IN
class FinishNode extends ClassicPreset.Node {
  width = 420; height = 120
  constructor(title = 'Assemble & Complete Product • Print Label') {
    super(title)
    this._kind = 'finish'
    this.addInput('inp', new ClassicPreset.Input(any, 'flow', true))
  }
}

// Task: visible TaskType + WC (compact)
class TaskNode extends ClassicPreset.Node {
  width = 480; height = 180
  constructor(init = {}) {
    super(init.title ?? (init.taskType ?? 'Task'))
    this._kind = 'task'

    this._defaults = {
      terminal: !!init.terminal,
      mandatory: init.mandatory ?? true,
      kitImpact: Number(init.kitImpact ?? 10),
      formulasText: init.formulasText ?? ''
    }

    this.addInput('inp', new ClassicPreset.Input(any, 'dependsOn', true))
    this.addOutput('out', new ClassicPreset.Output(any, 'prerequisite'))

    this.addControl('taskType',
      new ClassicPreset.InputControl('text', { initial: init.taskType ?? 'TASK' }))
    this.addControl('wc',
      new ClassicPreset.InputControl('text', { initial: init.wc ?? 'WC' }))
  }
}

/* ===== Export helpers ===== */
function collect(editor, area) {
  const nodes = editor.getNodes().map(n => {
    const kind = n._kind ?? 'task'
    const defaults = n._defaults ?? {}
    const data = {
      kind,
      taskType: n.controls?.taskType?.value ?? (kind !== 'task' ? (kind === 'start' ? 'START' : 'FINISH') : 'TASK'),
      wc: n.controls?.wc?.value ?? (kind !== 'task' ? 'SYS' : 'WC'),
      terminal: !!(n.controls?.terminal?.value ?? defaults.terminal ?? (kind === 'finish')),
      kitImpact: Number(n.controls?.kitImpact?.value ?? defaults.kitImpact ?? 0),
      mandatory: !!(n.controls?.mandatory?.value ?? defaults.mandatory ?? true),
      formulasText: n.controls?.formulasText?.value ?? defaults.formulasText ?? ''
    }
    const pos = area.area?.transformations?.get(n.id)?.position ?? n.position ?? [0, 0]
    return { id: n.id, title: n.label, ...data, position: pos }
  })

  const edges = editor.getConnections().map(c => ({ from: c.source, to: c.target }))

  // depends by node id
  const depends = {}
  edges.forEach(e => { (depends[e.to] ||= []).push(e.from) })

  // runtime tasks only for 'task' nodes
  const taskNodes = nodes.filter(n => n.kind === 'task')
  const runTasks = taskNodes.map(n => ({
    taskType: n.taskType,
    wc: n.wc,
    isTerminal: n.terminal,
    dependsOn: (depends[n.id] || [])
      .map(id => nodes.find(x => x.id === id)?.taskType)
      .filter(Boolean)
  }))

  const formulasByTask = {}
  taskNodes.forEach(n => {
    const map = {}
    ;(n.formulasText || '').split(/\r?\n/).forEach(ln => {
      const m = ln.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.+)$/)
      if (m) map[m[1]] = m[2].trim()
    })
    if (Object.keys(map).length) formulasByTask[n.taskType] = map
  })

  return {
    productCode: 'ROLLER_STD',
    graph: { nodes, edges },
    runtime: { tasks: runTasks, formulasByTask }
  }
}

/* ===== App ===== */
async function setup() {
  try { window.__rete.dispose?.() } catch {}

  const el = document.getElementById('rete')
  if (!el) throw new Error('#rete not found')

  const editor = new NodeEditor()
  const area = new AreaPlugin(el)
  editor.use(area)

  const vue = new VuePlugin()
  area.use(vue)
  vue.addPreset(VuePresets.classic.setup())

  const conn = new ConnectionPlugin()
  area.use(conn)
  conn.addPreset(ConnectionPresets.classic.setup())

  const arrange = new AutoArrangePlugin({ engine: new ELK() })
  area.use(arrange)
  arrange.addPreset(ArrangePresets.classic.setup({
    spacing: { nodeNode: 80, nodeEdge: 40, edgeEdge: 20 }
  }))

  // Initial: only Start and Finish (no connection)
  const start = new StartNode('Job Received')
  const finish = new FinishNode('Assemble & Complete Product • Print Label')

  await editor.addNode(start)
  await editor.addNode(finish)
  start.position = [120, 220]
  finish.position = [820, 220]

  // colorize initial nodes (after mount)
  await colorizeNode(area, start, 'start')
  await colorizeNode(area, finish, 'finish')

  await AreaExtensions.zoomAt?.(area, [start, finish])

  const $ = id => document.getElementById(id)

  // Add Task — create regular task node, place to the right and colorize
  $('btnAdd').onclick = async () => {
    const nodes = editor.getNodes()
    const last = nodes.at(-1)
    const n = new TaskNode({ title:'Task', taskType:'TASK', wc:'WC' })
    await editor.addNode(n)
    n.position = [(last?.position?.[0]??120)+480, last?.position?.[1]??220]
    await colorizeNode(area, n, 'task')
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  }

  $('btnAuto').onclick = async () => {
    await arrange.layout?.()
    // re-apply colors after any DOM churn
    for (const nd of editor.getNodes()) {
      await colorizeNode(area, nd, nd._kind ?? 'task')
    }
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  }

  $('btnDelete').onclick = () => {
    const nodes = editor.getNodes()
    const last = nodes.at(-1)
    if (last) editor.removeNode(last.id)
  }

  $('btnExport').onclick = () => downloadJson(collect(editor,area),'tech_rules_export.json')

  // HMR cleanup
  window.__rete.dispose = () => {
    try { area.destroy?.() } catch {}
    try { editor.destroy?.() } catch {}
    window.__rete.dispose = null
  }
  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.__rete.dispose?.())
  }
}

setup()
