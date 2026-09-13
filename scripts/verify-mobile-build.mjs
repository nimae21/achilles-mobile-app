import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const files = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(full)
    else files.push(full)
  }
}

await walk(dist)
const relative = files.map((file) => path.relative(dist, file).replaceAll('\\', '/'))
const forbidden = relative.filter((file) => /(?:legacy|polyfill|systemjs)/i.test(file))
if (forbidden.length) throw new Error(`Legacy output remains: ${forbidden.join(', ')}`)

const rawHtml = await readFile(path.join(dist, 'index.html'), 'utf8')
const html = rawHtml.replaceAll('&#39;', "'").replaceAll('&quot;', '"')
if (!html.includes('Content-Security-Policy')) throw new Error('Production CSP is missing.')
if (!html.includes("script-src 'self'")) throw new Error('Production script policy is missing.')
if (html.includes("'unsafe-eval'") || html.includes("'unsafe-inline'")) {
  throw new Error('Production CSP contains an unsafe script/style source.')
}
if (/fonts\.(?:googleapis|gstatic)\.com/i.test(html)) {
  throw new Error('Production HTML still loads a remote Google font.')
}

const js = relative.filter((file) => file.endsWith('.js'))
const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce(
  (sum, size) => sum + size,
  0,
)
const jsBytes = (await Promise.all(js.map(async (file) => (await stat(path.join(dist, file))).size)))
  .reduce((sum, size) => sum + size, 0)

console.log(`Verified Chrome/WebView 89 build: ${js.length} JavaScript files, ${jsBytes} JS bytes, ${totalBytes} total bytes, no legacy duplicates.`)