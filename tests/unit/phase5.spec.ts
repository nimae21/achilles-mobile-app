import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from '../../build/csp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

function vueFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name)
    return statSync(full).isDirectory() ? vueFiles(full) : full.endsWith('.vue') ? [full] : []
  })
}

describe('Phase 5 browser bundle contract', () => {
  it('pins Chrome/WebView 89 and does not configure the legacy plugin', () => {
    const vite = read('vite.config.ts')
    const browsers = read('.browserslistrc')
    const packageJson = JSON.parse(read('package.json'))

    expect(vite).toContain("target: 'chrome89'")
    expect(browsers).toContain('ChromeAndroid >=89')
    expect(vite).not.toContain('@vitejs/plugin-legacy')
    expect(packageJson.devDependencies).not.toHaveProperty('@vitejs/plugin-legacy')
  })

  it('keeps routed screens lazy-loaded', () => {
    const router = read('src/router/index.ts')
    const lazyPages = router.match(/component:\s*\(\)\s*=>\s*import\(/g) ?? []
    expect(lazyPages.length).toBeGreaterThanOrEqual(18)
    expect(router).toContain("import TabsPage from '../views/TabsPage.vue'")
  })

  it('packages Inter locally and has no remote font reference', () => {
    const html = read('index.html')
    const theme = read('src/theme/variables.css')
    const font = path.join(root, 'src/theme/fonts/Inter-latin.woff2')

    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(theme).toContain("url('./fonts/Inter-latin.woff2')")
    expect(existsSync(font)).toBe(true)
    expect(statSync(font).size).toBeGreaterThan(10_000)
  })

  it('removes dependencies with no source or native responsibility', () => {
    const packageJson = JSON.parse(read('package.json'))
    const removed = [
      'firebase',
      '@capacitor-firebase/messaging',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/status-bar',
    ]
    for (const dependency of removed) {
      expect(packageJson.dependencies).not.toHaveProperty(dependency)
    }
    expect(packageJson.dependencies).toHaveProperty('@capacitor/app')
    expect(packageJson.dependencies).toHaveProperty('@capacitor/preferences')
    expect(packageJson.dependencies).toHaveProperty('@capacitor/push-notifications')
  })
})

describe('Phase 5 CSP and startup contract', () => {
  it('permits only packaged resources and the HTTPS API in production', () => {
    const policy = buildContentSecurityPolicy('https://api.example.test/api', true)
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("style-src 'self' 'nonce-achilles-ionic'")
    expect(policy).toContain("style-src-attr 'none'")
    expect(policy).toContain("connect-src 'self' https://api.example.test")
    expect(policy).toContain('upgrade-insecure-requests')
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(() => buildContentSecurityPolicy('http://api.example.test/api', true)).toThrow(/HTTPS/)
  })

  it('removes inline style attributes that the production policy blocks', () => {
    for (const file of vueFiles(path.join(root, 'src'))) {
      expect(readFileSync(file, 'utf8'), path.relative(root, file)).not.toMatch(/\s(?::?style)=/)
    }
  })

  it('mounts a safe shell before restoring storage and leaves cache cleanup in the background', () => {
    const main = read('src/main.ts')
    expect(main.indexOf("app.mount('#app')")).toBeGreaterThan(-1)
    expect(main.indexOf("app.mount('#app')")).toBeLessThan(main.indexOf('void initializeSession()'))
    expect(main).toContain('void hydrateCache().catch')
    expect(read('src/App.vue')).toContain('v-if="!session.ready"')
  })

  it('keeps production cleartext disabled and release shrinking enabled', () => {
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain(
      'android:usesCleartextTraffic="false"',
    )
    expect(read('android/app/src/debug/AndroidManifest.xml')).toContain(
      'android:usesCleartextTraffic="true"',
    )
    const gradle = read('android/app/build.gradle')
    expect(gradle).toContain('minifyEnabled true')
    expect(gradle).toContain('shrinkResources true')
    expect(gradle).toContain('debuggable false')
  })

  it('uses the Ionic style nonce facility required by the strict policy', () => {
    const ionic = read('node_modules/@ionic/core/components/p-1sJ0ZDPe.js')
    expect(ionic).toContain('csp-nonce')
  })
})