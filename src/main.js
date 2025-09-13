// Lauresta skin demo: Rete v2 + Vue + Connection + AutoArrange (manual) + TaskNode (compact) + JSON export
import { NodeEditor, ClassicPreset } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { VuePlugin, Presets as VuePresets } from 'rete-vue-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin'
import ELK from 'elkjs/lib/elk.bundled.js'

const any = new ClassicPreset.Socket('any')
if (!window.__rete) window.__rete = {}

function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
}

// Compact TaskNode: показываем только TaskType и WC.
// Остальные поля храним в _defaults для экспорта.
class TaskNode extends ClassicPreset.Node {
  width = 480
  height = 0 // выставим ниже из расчёта

  constructor(init = {}) {
    super(init.title ?? (init.taskType ?? 'Task'))

    // дефолты «скрытых» полей
    this._defaults = {
      terminal: !!init.terminal,
      mandatory: init.mandatory ?? true,
      kitImpact: Number(init.kitImpact ?? 10),
      formulasText: init.formulasText ?? ''
    }

    this.addInput('inp', new ClassicPreset.Input(any, 'dependsOn', true))
    this.addOutput('out', new ClassicPreset.Output(any, 'prerequisite'))

    // видимые поля
    this.addControl('taskType',
      new ClassicPreset.InputControl('text', { initial: init.taskType ?? 'CUT_FABRIC' }))
    this.addControl('wc',
      new ClassicPreset.InputControl('text', { initial: init.wc ?? 'FAB' }))

    // 🔧 авто-высота ноды по количеству видимых контролов
    const visibleControls = 2       // taskType + wc
    const base = 120                // шапка, отступы, сокеты
    const perRow = 40               // одна строка контрола
    this.height = base + visibleControls * perRow // ≈ 200px
  }
}

function collect(editor, area) {
  const nodes = editor.getNodes().map(n => {
    const defaults = n._defaults ?? {}
    const data = {
      taskType: n.controls.taskType?.value || 'TASK',
      wc: n.controls.wc?.value || 'WC',
      terminal: !!(n.controls.terminal?.value ?? defaults.terminal ?? false),
      kitImpact: Number(n.controls.kitImpact?.value ?? defaults.kitImpact ?? 0),
      mandatory: !!(n.controls.mandatory?.value ?? defaults.mandatory ?? true),
      formulasText: n.controls.formulasText?.value ?? defaults.formulasText ?? ''
    }
    const pos = area.area?.transformations?.get(n.id)?.position ?? n.position ?? [0, 0]
    return { id: n.id, title: n.label, ...data, position: pos }
  })

  const edges = editor.getConnections().map(c => ({ from: c.source, to: c.target }))
  const depends = {}
  edges.forEach(e => { (depends[e.to] ||= []).push(e.from) })

  const runTasks = nodes.map(n => ({
    taskType: n.taskType,
    wc: n.wc,
    isTerminal: n.terminal,
    dependsOn: (depends[n.id] || [])
      .map(id => nodes.find(x => x.id === id)?.taskType)
      .filter(Boolean)
  }))

  const formulasByTask = {}
  nodes.forEach(n => {
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

  // seed
  const a = new TaskNode({
    title: 'CUT_FABRIC', taskType: 'CUT_FABRIC', wc: 'FAB',
    kitImpact: 10, mandatory: true,
    formulasText: 'fabric_length_mm = CEILING((height_mm + 20) * 1.01, 1)'
  })
  const b = new TaskNode({
    title: 'CUT_PROFILE', taskType: 'CUT_PROFILE', wc: 'PRF',
    kitImpact: 10, mandatory: true,
    formulasText: 'tube_length_mm = ROUND(width_mm - 2, 0)'
  })
  const c = new TaskNode({
    title: 'ASM_ROLLER', taskType: 'ASM_ROLLER', wc: 'ASM',
    terminal: true, kitImpact: 100, mandatory: true
  })

  await editor.addNode(a); await editor.addNode(b); await editor.addNode(c)
  a.position=[80,180]; b.position=[560,180]; c.position=[1040,180]
  await editor.addConnection(new ClassicPreset.Connection(a, 'out', c, 'inp'))
  await editor.addConnection(new ClassicPreset.Connection(b, 'out', c, 'inp'))
  await AreaExtensions.zoomAt?.(area, [a,b,c])

  const $ = id => document.getElementById(id)

  $('btnAdd').onclick = async () => {
    const nodes = editor.getNodes(); const last = nodes.at(-1)
    const n = new TaskNode({ title:'TASK', taskType:'TASK', wc:'WC' })
    await editor.addNode(n)
    n.position = [(last?.position?.[0]??80)+480, last?.position?.[1]??180]
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  }
  $('btnAuto').onclick = async () => {
    await arrange.layout?.()
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
