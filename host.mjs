import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const CLIENT = path.join(DIST, 'client')
const PORT = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.map': 'application/json',
}

async function tryStatic(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\0/g, '')
  for (const base of [DIST, CLIENT]) {
    const file = path.join(base, clean)
    if (!file.startsWith(base)) continue // 防目录穿越
    try {
      const s = await stat(file)
      if (s.isDirectory()) continue
      return {
        data: await readFile(file),
        mime: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      }
    } catch { /* miss, try next */ }
  }
  return null
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')

  // 1) 静态资源（/client/assets/** 等）
  if (req.method === 'GET' || req.method === 'HEAD') {
    const st = await tryStatic(url.pathname)
    if (st) {
      res.writeHead(200, {
        'content-type': st.mime,
        'cache-control': url.pathname.startsWith('/client/assets/')
          ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      res.end(req.method === 'HEAD' ? undefined : st.data)
      return
    }
  }

  // 2) SSR / API：转成 Web Request 交给 TanStack Start 服务端
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v)
    else if (Array.isArray(v)) for (const item of v) headers.append(k, item)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const request = new Request(url, {
    method: req.method, headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
  })

  const entry = (await import('./dist/server/server.js')).default
  const response = await entry.fetch(request)

  const outHeaders = {}
  response.headers.forEach((v, k) => { outHeaders[k] = v })
  const setCookies = response.headers.getSetCookie?.() || []
  if (setCookies.length) outHeaders['set-cookie'] = setCookies
  res.writeHead(response.status, outHeaders)
  response.body ? Readable.fromWeb(response.body).pipe(res) : res.end()
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[host] error:', err)
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error: ' + (err?.message ?? err))
  })
}).listen(PORT, '0.0.0.0', () => console.log(`[host] listening on :${PORT}`))
