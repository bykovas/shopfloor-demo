// Lauresta skin demo: Rete v2 + Vue + Connection + AutoArrange (manual) + TaskNode + JSON export
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

class TaskNode extends ClassicPreset.Node {
  width = 500
  height = 240
  constructor(init = {}) {
    super(init.title ?? 'Task')

    this.addInput('inp', new ClassicPreset.Input(any, 'dependsOn', true))
    this.addOutput('out', new ClassicPreset.Output(any, 'prerequisite'))

    this.addControl('taskType',
      new ClassicPreset.InputControl('text', { initial: init.taskType ?? 'CUT_FABRIC' }))
    this.addControl('wc',
      new ClassicPreset.InputControl('text', { initial: init.wc ?? 'FAB' }))

    this.addControl('terminal',
      new ClassicPreset.InputControl('checkbox', { initial: !!init.terminal }))
    this.addControl('mandatory',
      new ClassicPreset.InputControl('checkbox', { initial: init.mandatory ?? true }))

    this.addControl('kitImpact',
      new ClassicPreset.InputControl('number', { initial: Number(init.kitImpact ?? 10) }))

    // Пока без textarea — просто длинная строка; позже сделаем кастомный control
    this.addControl('formulasText',
      new ClassicPreset.InputControl('text', {
        initial: init.formulasText ?? '',
        placeholder: 'fabric_length_mm = CEILING((height_mm + 20) * 1.01, 1)'
      }))
  }
}

function collect(editor, area) {
  const nodes = editor.getNodes().map(n => {
    const data = {
      taskType: n.controls.taskType?.value || 'TASK',
      wc: n.controls.wc?.value || 'WC',
      terminal: !!n.controls.terminal?.value,
      kitImpact: Number(n.controls.kitImpact?.value || 0),
      mandatory: !!n.controls.mandatory?.value,
      formulasText: n.controls.formulasText?.value || ''
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

  // seed nodes
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
    kitImpact: 100, mandatory: true, terminal: true
  })

  await editor.addNode(a); await editor.addNode(b); await editor.addNode(c)

  // manual initial positions (no auto-layout on load)
  a.position=[80,180]; b.position=[580,180]; c.position=[1080,180]

  await editor.addConnection(new ClassicPreset.Connection(a, 'out', c, 'inp'))
  await editor.addConnection(new ClassicPreset.Connection(b, 'out', c, 'inp'))

  await AreaExtensions.zoomAt?.(area, [a, b, c])

  const $ = id => document.getElementById(id)

  $('btnAdd')?.addEventListener('click', async () => {
    const nodes = editor.getNodes()
    const last = nodes.at(-1)
    const n = new TaskNode({ title: 'TASK', taskType: 'TASK', wc: 'WC' })
    await editor.addNode(n)
    n.position = [(last?.position?.[0] ?? 80) + 500, last?.position?.[1] ?? 180]
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  })

  $('btnAuto')?.addEventListener('click', async () => {
    await arrange.layout?.()
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  })

  $('btnDelete')?.addEventListener('click', () => {
    // простое удаление: уберём последний добавленный узел (или выделенный?)
    const nodes = editor.getNodes()
    const last = nodes.at(-1)
    if (last) editor.removeNode(last.id)
  })

  $('btnExport')?.addEventListener('click', () => {
    const payload = collect(editor, area)
    downloadJson(payload, 'tech_rules_export.json')
  })

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
