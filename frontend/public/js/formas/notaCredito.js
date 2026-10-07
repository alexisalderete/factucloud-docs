// ── Formulario: Nota de Crédito (tipo 5) ───────────────────────────────────
import { state, $ } from '../core/state.js'
import { fetchJSON } from '../core/api.js'
import { getConfigFiscal } from '../core/fiscal.js'
import { buildNCCreditoBody } from '../core/payload.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { esc } from '../core/ui.js'
import { bindJsonPreview, renderJsonPreview } from '../widgets/jsonPreview.js'
import { renderClienteWidget, bindCliente, collectCliente } from '../widgets/cliente.js'
import { renderDEHeader, collectDEHeader } from '../widgets/cabecera.js'
import { renderAsociadoWidget, bindAsociado, collectAsociado } from '../widgets/asociado.js'
import { renderProductosWidget, bindProductos, collectProductos } from '../widgets/productos.js'

export function renderFormNC() {
  return `
<div class="card">
  <h2>Nota de Crédito (tipo 5)</h2>
  <div class="form-grid">
    ${renderClienteWidget('nc')}
    ${renderDEHeader('nc', { permitirSinNombre: false })}
    ${renderAsociadoWidget('nc')}
    ${renderProductosWidget('nc')}
    <div class="form-group">
      <label>Motivo Emisión</label>
      <select id="nc-motivo">${opts(SIFEN.motivoNC)}</select>
    </div>
  </div>
  <button class="btn btn-primary mt" id="nc-crear">Crear Nota de Crédito</button>
</div>
${renderJsonPreview('nc', 'Simulador: JSON que se enviará (POST /de/nota-credito)')}
<div id="log-area-nc" class="log"></div>`
}

export function bindNCForm() {
  bindCliente('nc')
  bindProductos('nc', { cant: 1, precio: 50000 })
  bindAsociado('nc')

  async function buildNCContextForm() {
    const header = collectDEHeader('nc')
    return {
      cliente: header.emitirSinNombre ? {} : collectCliente('nc'),
      items: collectProductos('nc'),
      asoc: await collectAsociado('nc'),
      de: header,
      motivo: Number($('nc-motivo').value),
    }
  }
  async function buildNCRequest(ctx, cfg) {
    return { method: 'POST', url: '/de/nota-credito', body: buildNCCreditoBody({ cfg, cliente: ctx.cliente, items: ctx.items, asoc: ctx.asoc, de: ctx.de, motivo: ctx.motivo, empleadoId: state.uuidEmpleado }) }
  }

  bindJsonPreview('nc', async () => [await buildNCRequest(await buildNCContextForm(), await getConfigFiscal())])

  $('nc-crear').onclick = async () => {
    const L = $('log-area-nc'); L.innerHTML = ''
    let ctx
    try { ctx = await buildNCContextForm() }
    catch (e) { return L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
    try {
      L.innerHTML += `<span class="info">▶ Creando NC...</span>\n`
      const cfg = await getConfigFiscal()
      const req = await buildNCRequest(ctx, cfg)
      const res = await fetchJSON(req.method, req.url, req.body)
      const ncUuid = res?.uuid || res?.data?.uuid
      L.innerHTML += `<span class="ok">✓ NC: ${esc(ncUuid)}</span>\n`

      L.innerHTML += `<span class="info">▶ Generando XML...</span>\n`
      await fetchJSON('POST', '/xml', { documentoUuid: ncUuid })
      L.innerHTML += `<span class="ok">✓ XML generado</span>\n`
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }
}