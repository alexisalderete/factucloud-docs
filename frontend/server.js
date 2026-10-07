import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const PORT = process.env.PORT || 8090
const HOST = process.env.HOST || '127.0.0.1'
const API_URL = process.env.API_URL || 'http://localhost:3000'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const DIR = fileURLToPath(new URL('.', import.meta.url))

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  // Proxy API calls → /api/v1/*
  if (path.startsWith('/api/')) {
    const target = `${API_URL}/api/v1${path.slice(4)}${url.search}`
    const headers = {}
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization']
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']

    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((resolve) => {
        let d = ''
        req.on('data', c => d += c)
        req.on('end', () => resolve(d || undefined))
      })

      const apiRes = await fetch(target, {
        method: req.method,
        headers,
        body,
      })

      const contentType = apiRes.headers.get('content-type') || ''
      const isBinary = contentType.includes('application/pdf') || contentType.includes('image/') || contentType.includes('application/octet-stream')

      if (isBinary) {
        const buffer = Buffer.from(await apiRes.arrayBuffer())
        res.writeHead(apiRes.status, {
          'Content-Type': contentType,
          'Content-Length': buffer.length,
        })
        res.end(buffer)
      } else {
        const text = await apiRes.text()
        res.writeHead(apiRes.status, {
          'Content-Type': contentType,
        })
        res.end(text)
      }
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Error proxying to ${target}: ${e.message}` }))
    }
    return
  }

  // Serve static files
  let filePath = join(DIR, 'public', path === '/' ? 'index.html' : path)

  if (!existsSync(filePath)) {
    filePath = join(DIR, 'public', 'index.html')
  }

  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
}).listen(PORT, HOST, () => {
  console.log(`Frontend: http://${HOST}:${PORT}`)
  console.log(`API Proxy: http://${HOST}:${PORT}/api/ → ${API_URL}/api/v1/`)
})
