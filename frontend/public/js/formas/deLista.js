// ── Pestaña: Listado de Documentos Electrónicos ────────────────────────────
import { state, $ } from '../core/state.js'
import { API, fetchJSON, downloadBinary } from '../core/api.js'
import { esc } from '../core/ui.js'

export function renderTabDE() {
  return `
<div class="card">
  <div class="flex-between mb">
    <h2>Documentos Electrónicos</h2>
    <div class="flex gap">
      <button class="btn btn-outline btn-sm" id="de-refresh">⟳ Actualizar</button>
      <button class="btn btn-primary btn-sm" id="de-enviar-lote">Enviar lote a SIFEN</button>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th><input type="checkbox" id="de-select-all"></th>
          <th>Tipo</th><th>Estado</th><th>N° Doc</th><th>Fecha</th><th>Monto</th><th>Acciones</th>
      </tr></thead>
        <tbody id="de-tbody"><tr><td colspan="7" class="text-center text-muted">Cargando...</td></tr></tbody>
    </table>
  </div>
</div>
<div id="log-area-de" class="log"></div>`
}

export async function bindDEList() {
  const tbody = $('de-tbody'); const L = $('log-area-de')

  async function loadDEs() {
    try {
      const res = await fetchJSON('GET', '/de/documentos?page=1&limit=20')
      state.deList = res?.results || []
      tbody.innerHTML = state.deList.map(d => {
        const tipo = { 1: 'Factura', 4: 'AF', 5: 'NC', 6: 'ND', 7: 'NR' }[d.tipo_documento] || d.tipo_documento
        const estado = d.estado_sifen || 'PENDIENTE'
        const badge = d.cdc ? (estado === 'APROBADO' ? 'badge-success' : estado === 'RECHAZADO' ? 'badge-err' : 'badge-pending') : 'badge-warn'
        const num = `${d.establecimiento || '—'}-${d.punto_expedicion || '—'}-${String(d.numero_documento).padStart(7, '0')}`
        return `<tr>
          <td><input type="checkbox" class="de-check" value="${esc(d.uuid)}"></td>
          <td>${esc(tipo)}</td>
          <td><span class="badge ${badge}">${esc(estado)}</span></td>
          <td class="truncate">${esc(num)}</td>
          <td>${esc((d.fecha_emision || d.fecha_creacion || '').slice(0, 16).replace('T', ' ') || '—')}</td>
          <td>${d.monto_total ? `Gs. ${Number(d.monto_total).toLocaleString('es-PY')}` : '—'}</td>
          <td>
            <button class="btn btn-outline btn-sm de-xml" data-uuid="${esc(d.uuid)}" data-num="${esc(num)}">XML</button>
            <button class="btn btn-outline btn-sm de-pdf" data-uuid="${esc(d.uuid)}" data-num="${esc(num)}">PDF</button>
            <button class="btn btn-outline btn-sm de-enviar" data-uuid="${esc(d.uuid)}">Enviar</button>
          </td>
        </tr>`
      }).join('')

      document.querySelectorAll('.de-xml').forEach(b => b.onclick = async () => {
        const uuid = b.dataset.uuid
        const num = b.dataset.num || uuid.slice(0, 8)
        const res = await fetch(`${API}/de/documentos/${uuid}/xml`, { headers: { 'Authorization': `Bearer ${state.apiKey}` } })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `${num}.xml`; a.click()
          URL.revokeObjectURL(url)
        } else if (res.status === 404) {
          try {
            await fetchJSON('POST', '/xml', { documentoUuid: uuid })
            L.innerHTML += `<span class="ok">✓ XML generado para ${esc(uuid.slice(0, 8))}</span>\n`
            loadDEs()
          } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
        } else {
          L.innerHTML += `<span class="err">✗ Error HTTP ${esc(res.status)}</span>\n`
        }
      })

      document.querySelectorAll('.de-pdf').forEach(b => b.onclick = async () => {
        try {
          const num = b.dataset.num || b.dataset.uuid.slice(0, 8)
          await downloadBinary(`/de/documentos/${b.dataset.uuid}/kude?format=normal`, `${num}.pdf`)
        } catch (e) { alert(`Error al descargar PDF: ${e.message}`) }
      })

      document.querySelectorAll('.de-enviar').forEach(b => b.onclick = async () => {
        try {
          const r = await fetchJSON('POST', '/xml/enviar', { documentoUuid: b.dataset.uuid })
          L.innerHTML += `<span class="ok">✓ ${esc(r?.estado_sifen || 'ENVIADO')}</span>\n`
          loadDEs()
        } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
      })

      $('de-select-all').onchange = function () { document.querySelectorAll('.de-check').forEach(c => c.checked = this.checked) }
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error: ${esc(e.message)}</td></tr>` }
  }

  $('de-refresh').onclick = loadDEs
  $('de-enviar-lote').onclick = async () => {
    const uuids = [...document.querySelectorAll('.de-check:checked')].map(c => c.value)
    if (!uuids.length) return L.innerHTML += `<span class="warn">Seleccione documentos</span>\n`
    try {
      await fetchJSON('POST', '/xml/lote/enviar', { documentosUuids: uuids })
      L.innerHTML += `<span class="ok">✓ Lote enviado (${esc(uuids.length)} docs)</span>\n`
      loadDEs()
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }

  loadDEs()
}