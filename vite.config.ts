/// <reference types="vitest" />

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { buildContentSecurityPolicy, CSP_NONCE } from './build/csp.ts'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function contentSecurityPolicy(apiUrl: string | undefined, production: boolean): Plugin {
  return {
    name: 'achilles-content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          { tag: 'meta', attrs: { name: 'csp-nonce', content: CSP_NONCE }, injectTo: 'head-prepend' },
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: buildContentSecurityPolicy(apiUrl, production),
            },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const production = mode === 'production'

  return {
    plugins: [contentSecurityPolicy(env.VITE_API_BASE_URL, production), vue(), tailwindcss()],
    server: { watch: { ignored: ['**/android/**'] } },
    resolve: { alias: { '@': path.resolve(projectRoot, './src') } },
    build: {
      // API 24 remains supported; the installed Android System WebView or
      // Chrome must be version 89 or newer.
      target: 'chrome89',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('@capacitor')) return 'capacitor'
            if (id.includes('@ionic') || id.includes('ionicons')) return 'ionic'
            if (id.includes('/vue/') || id.includes('vue-router')) return 'vue'
            return undefined
          },
        },
      },
    },
    test: { globals: true, environment: 'jsdom' },
  }
})
