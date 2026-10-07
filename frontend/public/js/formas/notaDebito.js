// ── Formulario: Nota de Débito (tipo 6) ────────────────────────────────────
import { state, $ } from '../core/state.js'
import { fetchJSON } from '../core/api.js'
import { getConfigFiscal } from '../core/fiscal.js'
import { buildNDDebito } from '../core/payload.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { esc } from '../core/ui.js'
import { bindJsonPreview, renderJsonPreview } from '../widgets/jsonPreview.js'
import { renderClienteWidget, bindCliente, collectCliente } from '../widgets/cliente.js'
import { renderDEHeader, collectDEHeader } from '../widgets/cabecera.js'
import { renderAsociadoWidget, bindAsociado, collectAsociado } from '../widgets/asociado.js'
import { renderProductosWidget, bindProductos, collectProductos } from '../widgets/productos.js'

export function renderFormND() {
  return `
<div class="card">
  <h2>Nota de Débito (tipo 6)</h2>
  <div class="form-grid">
    ${renderClienteWidget('nd')}
    ${renderDEHeader('nd', { permitirSinNombre: false })}
    ${renderAsociadoWidget('nd')}
    ${renderProductosWidget('nd')}
    <div class="form-group">
      <label>Motivo Emisión</label>
      <select id="nd-motivo">${opts(SIFEN.motivoND)}</select>
    </div>
  </div>
  <button class="btn btn-primary mt" id="nd-crear">Crear Nota de Débito</button>
</div>
${renderJsonPreview('nd', 'Simulador: JSON que se enviará (POST /de/nota-debito)')}
<div id="log-area-nd" class="log"></div>`
}

export function bindNDForm() {
  bindCliente('nd')
  bindProductos('nd', { cant: 1, precio: 50000 })
  bindAsociado('nd')

  async function buildNDContextForm() {
    const header = collectDEHeader('nd')
    return {
      cliente: header.emitirSinNombre ? {} : collectCliente('nd'),
      items: collectProductos('nd'),
      asoc: await collectAsociado('nd'),
      de: header,
      motivo: Number($('nd-motivo').value),
    }
  }
  async function buildNDRequest(ctx, cfg) {
    return { method: 'POST', url: '/de/nota-debito', body: buildNDDebito({ cfg, cliente: ctx.cliente, items: ctx.items, asoc: ctx.asoc, de: ctx.de, motivo: ctx.motivo, empleadoId: state.uuidEmpleado }) }
  }

  bindJsonPreview('nd', async () => [await buildNDRequest(await buildNDContextForm(), await getConfigFiscal())])

  $('nd-crear').onclick = async () => {
    const L = $('log-area-nd'); L.innerHTML = ''
    let ctx
    try { ctx = await buildNDContextForm() }
    catch (e) { return L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
    try {
      L.innerHTML += `<span class="info">▶ Creando ND...</span>\n`
      const cfg = await getConfigFiscal()
      const req = await buildNDRequest(ctx, cfg)
      const res = await fetchJSON(req.method, req.url, req.body)
      const ndUuid = res?.uuid || res?.data?.uuid
      L.innerHTML += `<span class="ok">✓ ND: ${esc(ndUuid)}</span>\n`

      L.innerHTML += `<span class="info">▶ Generando XML...</span>\n`
      await fetchJSON('POST', '/xml', { documentoUuid: ndUuid })
      L.innerHTML += `<span class="ok">✓ XML generado</span>\n`
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }
}