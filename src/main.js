// Rete v2 + Vue + Connection + AutoArrange (manual only)
import { NodeEditor, ClassicPreset } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { VuePlugin, Presets as VuePresets } from 'rete-vue-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin'
import ELK from 'elkjs/lib/elk.bundled.js'

const any = new ClassicPreset.Socket('any')
if (!window.__rete) window.__rete = {}

class MinimalNode extends ClassicPreset.Node {
  // важны размеры для ELK
  width = 260
  height = 140
  constructor(title = 'Node', initial = 'ok') {
    super(title)
    this.addInput('in', new ClassicPreset.Input(any, 'in', true))
    this.addOutput('out', new ClassicPreset.Output(any, 'out'))
    this.addControl('txt', new ClassicPreset.InputControl('text', { initial }))
  }
}

const waitMounted = () =>
  new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))

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

  // подключаем, но НЕ вызываем автоматически
  const arrange = new AutoArrangePlugin({ engine: new ELK() })
  area.use(arrange)
  arrange.addPreset(ArrangePresets.classic.setup({
    spacing: { nodeNode: 80, nodeEdge: 40, edgeEdge: 20 }
  }))

  // стартовые ноды
  const a = new MinimalNode('A', 'hello')
  const b = new MinimalNode('B', 'world')
  const c = new MinimalNode('C', 'next')
  await editor.addNode(a); await editor.addNode(b); await editor.addNode(c)
  await editor.addConnection(new ClassicPreset.Connection(a, 'out', b, 'in'))
  await editor.addConnection(new ClassicPreset.Connection(b, 'out', c, 'in'))

  // просто зум-ту-фит без авто-раскладки
  await AreaExtensions.zoomAt?.(area, [a, b, c])

  const $ = id => document.getElementById(id)

  // добавление НОВОЙ ноды БЕЗ авто-раскладки
  $('btnAdd')?.addEventListener('click', async () => {
    const nodes = editor.getNodes()
    const last = nodes.at(-1)
    const n = new MinimalNode('N', 'new')
    await editor.addNode(n)

    // ставим рядом с последней нодой
    const baseX = last?.position?.[0] ?? 120
    const baseY = last?.position?.[1] ?? 150
    if (typeof area.translate === 'function') {
      await area.translate(n.id, { x: baseX + 300, y: baseY })
    } else {
      n.position = [baseX + 300, baseY]
    }

    await waitMounted()
    await AreaExtensions.zoomAt?.(area, editor.getNodes())
  })

  // авто-раскладка ТОЛЬКО по кнопке
  $('btnAuto')?.addEventListener('click', async () => {
    try {
      await waitMounted()
      await arrange.layout?.()
      await AreaExtensions.zoomAt?.(area, editor.getNodes())
    } catch (e) {
      console.error('[arrange] failed', e)
    }
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
