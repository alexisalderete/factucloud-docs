// ── Cliente HTTP / API del backend ─────────────────────────────────────────
// El simulador no llama directo al backend: pasa por el proxy /api
// (el server.js reenvía /api/* a <API_URL>/api/v1/*). Así el navegador solo
// ve un origen y la API Key viaja en el header Authorization.
import { state } from './state.js'

export const API = '/api'

// Petición JSON con la API Key.
export async function fetchJSON(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (state.apiKey) headers['Authorization'] = `Bearer ${state.apiKey}`
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(data?.message || data?.error || text || `HTTP ${res.status}`)
  return data
}

// Descarga un binario (XML/PDF) desde el backend y fuerza la descarga.
export async function downloadBinary(path, filename) {
  const res = await fetch(`${API}${path}`, { headers: { 'Authorization': `Bearer ${state.apiKey}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}