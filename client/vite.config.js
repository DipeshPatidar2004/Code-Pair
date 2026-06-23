import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin.default({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
    }),
    nodePolyfills({
      include: ['events', 'stream', 'util', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    })
  ]
})
