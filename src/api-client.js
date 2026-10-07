import 'dotenv/config'

const API_KEY = process.env.API_KEY || ''
const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const API_PREFIX = '/api/v1'

class ApiClient {
  constructor(apiKey) {
    this.baseUrl = BASE_URL
    this.apiKey = apiKey || API_KEY
    this._ensureApiKey()
  }

  _ensureApiKey() {
    if (!this.apiKey) {
      console.warn('⚠ API_KEY no configurada. Usá .env o pasala al constructor.')
    }
  }

  get headers() {
    const h = { 'Content-Type': 'application/json' }
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`
    }
    return h
  }

  async _fetch(method, path, body = undefined) {
    const url = `${this.baseUrl}${API_PREFIX}${path}`
    const opts = { method, headers: this.headers }
    if (body !== undefined) {
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(url, opts)
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || text
      throw new Error(`[${res.status}] ${method} ${API_PREFIX}${path}: ${msg}`)
    }
    return data
  }

  get(path) { return this._fetch('GET', path) }
  post(path, body) { return this._fetch('POST', path, body) }
  put(path, body) { return this._fetch('PUT', path, body) }
  patch(path, body) { return this._fetch('PATCH', path, body) }
  del(path) { return this._fetch('DELETE', path) }

  async listarProductos(page = 1, limit = 20, uuidEmpresa = '') {
    let q = `?page=${page}&limit=${limit}`
    if (uuidEmpresa) q += `&uuidEmpresa=${encodeURIComponent(uuidEmpresa)}`
    return this.get(`/productos${q}`)
  }

  async crearVenta(data) {
    return this.post('/ventas', data)
  }

  async listarVentas(page = 1, limit = 10, search = '') {
    let q = `?page=${page}&limit=${limit}`
    if (search) q += `&search=${encodeURIComponent(search)}`
    return this.get(`/ventas${q}`)
  }

  async getVenta(id) {
    return this.get(`/ventas/${id}`)
  }

  async getDocumentosVenta(id) {
    return this.get(`/ventas/${id}/documentos-electronicos`)
  }

  async crearDE(payload) {
    return this.post('/de', payload)
  }

  async crearNotaCredito(payload) {
    return this.post('/de/nota-credito', payload)
  }

  async crearNotaDebito(payload) {
    return this.post('/de/nota-debito', payload)
  }

  async listarDEs(page = 1, limit = 10, filtros = {}) {
    let q = `page=${page}&limit=${limit}`
    if (filtros.estado) q += `&estado=${filtros.estado}`
    if (filtros.tipo) q += `&tipoDocumento=${filtros.tipo}`
    if (filtros.search) q += `&search=${encodeURIComponent(filtros.search)}`
    return this.get(`/de/documentos?${q}`)
  }

  async getDE(id) {
    return this.get(`/de/documentos/${id}`)
  }

  async generarXML(documentoUuid) {
    return this.post('/xml', { documentoUuid })
  }

  async enviarSIFEN(documentoUuid) {
    return this.post('/xml/enviar', { documentoUuid })
  }

  async consultarSIFEN(id) {
    return this.get(`/xml/consultar/${id}`)
  }

  async enviarLote(documentosUuids) {
    return this.post('/xml/lote/enviar', { documentosUuids })
  }

  async descargarPDF(id, format = 'normal', outputPath = null) {
    const url = `${this.baseUrl}${API_PREFIX}/de/documentos/${id}/kude?format=${format}`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Error descargando PDF: ${res.status}`)
    if (outputPath) {
      const fs = await import('fs')
      const buffer = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(outputPath, buffer)
      console.log(`  PDF guardado en: ${outputPath}`)
    }
    return res
  }

  async descargarXML(id, outputPath = null) {
    const url = `${this.baseUrl}${API_PREFIX}/de/documentos/${id}/xml`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Error descargando XML: ${res.status}`)
    if (outputPath) {
      const fs = await import('fs')
      const buffer = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(outputPath, buffer)
      console.log(`  XML guardado en: ${outputPath}`)
    }
    return res
  }

  async buscarContribuyente(search) {
    return this.get(`/contribuyente/search?search=${encodeURIComponent(search)}`)
  }

  async listarEmpresas() {
    return this.get('/empresas')
  }

  async listarTimbrados() {
    return this.get('/de/timbrados')
  }

  async listarPersonas(page = 1, limit = 20, uuidEmpresa = '') {
    let q = `?page=${page}&limit=${limit}`
    if (uuidEmpresa) q += `&uuidEmpresa=${encodeURIComponent(uuidEmpresa)}`
    return this.get(`/crm${q}`)
  }

  async crearPersona(data) {
    return this.post('/crm', data)
  }

  async health() {
    try {
      const res = await fetch(`${this.baseUrl}${API_PREFIX}/empresas?page=1&limit=1`, { headers: this.headers })
      return res.ok
    } catch {
      return false
    }
  }
}

export default ApiClient
