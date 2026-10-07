// ── Formulario: Factura Electrónica (tipo 1) ───────────────────────────────
// Flujo completo: 1) crear venta, 2) crear DE, 3) generar+consumir XML,
// y descargar el PDF/XML. En el visor "JSON" podés copiar el payload exacto.
import { state, $ } from '../core/state.js'
import { fetchJSON, downloadBinary } from '../core/api.js'
import { getConfigFiscal } from '../core/fiscal.js'
import { buildVentaBody, buildDefacturaBody, UUID_PENDING } from '../core/payload.js'
import { log, clearLog, esc } from '../core/ui.js'
import { renderJsonPreview, bindJsonPreview } from '../widgets/jsonPreview.js'
import { renderClienteWidget, bindCliente, collectCliente } from '../widgets/cliente.js'
import { renderDEHeader, collectDEHeader } from '../widgets/cabecera.js'
import { renderProductosWidget, bindProductos, collectProductos } from '../widgets/productos.js'
import { renderCondicionWidget, bindCondicion, collectCondicion } from '../widgets/condicion.js'

export function renderFormFactura() {
  return `
<div class="card">
  <div class="flex-between mb">
    <h2>Factura Electrónica (tipo 1)</h2>
    <button class="btn btn-outline btn-sm" id="factura-load-data">Cargar datos del sistema</button>
  </div>
  <div class="form-grid">
    ${renderClienteWidget('fac')}
    ${renderDEHeader('fac')}
    ${renderProductosWidget('fac')}
    ${renderCondicionWidget('fac')}
  </div>
  <div class="flex gap mt">
    <button class="btn btn-primary" id="factura-crear-de">1. Crear DE</button>
    <button class="btn btn-primary" id="factura-generar-xml">2. Generar XML</button>
    <button class="btn btn-warn" id="factura-enviar-sifen">3. Enviar a SIFEN</button>
  </div>
  <div class="flex gap mt">
    <button class="btn btn-outline btn-sm" id="factura-descargar-pdf">📄 PDF</button>
    <button class="btn btn-outline btn-sm" id="factura-descargar-xml">📎 XML</button>
  </div>
</div>
${renderJsonPreview('factura', 'Simulador: JSON que se enviará (POST /ventas → POST /de)')}
<div id="log-area-factura" class="log"></div>`
}

// Colecciona el formulario. Devuelve el contexto que construye los payloads.
function collectFacturaForm() {
  const header = collectDEHeader('fac')
  return {
    cliente: header.emitirSinNombre ? {} : collectCliente('fac'),
    items: collectProductos('fac'),
    condicion: collectCondicion('fac'),
    de: header,
  }
}

// Los 2 requests del flujo completa. `ctx` sale de collectFacturaForm();
// `ventaId` lo da el backend tras el POST /ventas (placeholder en el preview).
function buildFacturaRequests(ctx, cfg, ventaId = UUID_PENDING) {
  return [
    { method: 'POST', url: '/ventas', body: buildVentaBody({ ...ctx, empleadoId: state.uuidEmpleado }) },
    { method: 'POST', url: '/de', body: buildDefacturaBody({ cfg, de: ctx.de, condicion: ctx.condicion, ventaId, empleadoId: state.uuidEmpleado }) },
  ]
}

export function bindFacturaForm() {
  const L = $('log-area-factura')
  let deId = null, ventaId = null

  const STEPS = ['crear-de', 'generar-xml', 'enviar-sifen']
  const setStatus = (step) => {
    STEPS.forEach((s, i) => {
      const btn = $(`factura-${s}`)
      if (btn) btn.disabled = i > step + 1
    })
    ;['descargar-pdf', 'descargar-xml'].forEach(s => { const b = $(`factura-${s}`); if (b) b.disabled = step < 1 })
  }
  setStatus(-1)

  bindCliente('fac')
  bindProductos('fac', { cant: 2, precio: 100000 })
  bindCondicion('fac')

  // El preview usa la misma construcción que el submit → nunca se desincroniza.
  bindJsonPreview('factura', async () => buildFacturaRequests(collectFacturaForm(), await getConfigFiscal(), ventaId))

  $('factura-crear-de').onclick = async () => {
    clearLog(); L.innerHTML = ''
    let ctx
    try { ctx = collectFacturaForm() }
    catch (e) { return L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }

    try {
      const cfg = await getConfigFiscal()
      const [ventaReq, deReq] = buildFacturaRequests(ctx, cfg, ventaId || undefined)

      L.innerHTML += `<span class="info">▶ ${esc(ventaReq.method)} ${esc(ventaReq.url)}...</span>\n`
      const ventaRes = await fetchJSON(ventaReq.method, ventaReq.url, ventaReq.body)
      ventaId = ventaRes?.uuid || ventaRes?.data?.uuid
      L.innerHTML += `<span class="ok">✓ Venta creada: ${esc(ventaId)}</span>\n`

      deReq.body.id_venta = ventaId
      L.innerHTML += `<span class="info">▶ ${esc(deReq.method)} ${esc(deReq.url)}...</span>\n`
      const deRes = await fetchJSON(deReq.method, deReq.url, deReq.body)
      deId = deRes?.uuid || deRes?.data?.uuid
      L.innerHTML += `<span class="ok">✓ DE creado: ${esc(deId)}</span>\n`
      setStatus(0)
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }

  $('factura-generar-xml').onclick = async () => {
    if (!deId) return
    L.innerHTML += `<span class="info">▶ Generando XML...</span>\n`
    try {
      await fetchJSON('POST', '/xml', { documentoUuid: deId })
      L.innerHTML += `<span class="ok">✓ XML generado y firmado</span>\n`
      setStatus(2)
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }

  $('factura-enviar-sifen').onclick = async () => {
    if (!deId) return
    L.innerHTML += `<span class="info">▶ Enviando a SIFEN...</span>\n`
    try {
      const res = await fetchJSON('POST', '/xml/enviar', { documentoUuid: deId })
      L.innerHTML += `<span class="ok">✓ ${esc(res?.estado_sifen || res?.estado || 'ENVIADO')}</span>\n`
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }

  $('factura-descargar-pdf').onclick = async () => {
    if (!deId) return
    try { await downloadBinary(`/de/documentos/${deId}/kude?format=normal`, `factura-${deId.slice(0, 8)}.pdf`) }
    catch (e) { log('err', `Error PDF: ${e.message}`) }
  }

  $('factura-descargar-xml').onclick = async () => {
    if (!deId) return
    try { await downloadBinary(`/de/documentos/${deId}/xml`, `factura-${deId.slice(0, 8)}.xml`) }
    catch (e) { log('err', `Error XML: ${e.message}`) }
  }
}