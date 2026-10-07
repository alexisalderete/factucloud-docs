// ── Utilidades de interfaz ─────────────────────────────────────────────────
import { state, $ } from './state.js'

// Escapa texto antes de insertarlo en el DOM (previene XSS).
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// Loguear un mensaje en un área <div> del documento.
export function log(msg, type = 'info') {
  const area = $('log-area')
  if (!area) return
  area.innerHTML += `<div class="log"><span class="${esc(type)}">${esc(msg)}</span></div>`
  area.scrollTop = area.scrollHeight
}

export function clearLog() {
  const area = $('log-area')
  if (area) area.innerHTML = ''
}

// Lee el valor de un <select> y devuelve { value, text, data } de la colección.
export function getSelected(tableId) {
  const sel = $(tableId)
  if (!sel) return null
  const idx = sel.selectedIndex
  if (idx < 0) return null
  return {
    value: sel.value,
    text: sel.options[idx].text,
    data: state[tableId.replace('sel-', '')]?.find?.(x => x.uuid === sel.value),
  }
}

// Etiqueta corta para mostrar una persona en un <option>.
export function personaOption(p) {
  const nombre = p.nombre_razon || p.nombreRazon || ''
  const short = nombre.length > 35 ? nombre.slice(0, 35) + '…' : nombre
  return { value: p.uuid, text: `${short} (${p.ruc || ''}-${p.dv_ruc || ''})` }
}

// Etiqueta corta para mostrar un producto en un <option>.
export function productoOption(p) {
  const desc = p.descripcion || p.codigo_interno || ''
  const short = desc.length > 35 ? desc.slice(0, 35) + '…' : desc
  return { value: p.uuid, text: `${short} — Gs. ${Number(p.precio_unitario || 0).toLocaleString('es-PY')}` }
}