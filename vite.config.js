import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const retePath = path.resolve(__dirname, 'node_modules/rete')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // гарантируем одну копию rete
    alias: { 'rete': retePath },
    dedupe: ['rete']
  },
  optimizeDeps: {
    // позволяем Vite корректно «прожевать» зависимости
    include: [
      'rete',
      'rete-area-plugin',
      'rete-connection-plugin',
      'rete-vue-plugin',
      'rete-auto-arrange-plugin',
      'elkjs'
    ]
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true }
  }
})
