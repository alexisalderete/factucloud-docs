// ── Formulario: Autofactura (tipo 4) ───────────────────────────────────────
import { state, $ } from '../core/state.js'
import { fetchJSON } from '../core/api.js'
import { getConfigFiscal } from '../core/fiscal.js'
import { buildAFCuer } from '../core/payload.js'
import { esc } from '../core/ui.js'
import { bindJsonPreview, renderJsonPreview } from '../widgets/jsonPreview.js'
import { renderDEHeader, collectDEHeader } from '../widgets/cabecera.js'
import { renderProductosWidget, bindProductos, collectProductos } from '../widgets/productos.js'

export function renderFormAF() {
  return `
<div class="card">
  <h2>Autofactura (tipo 4)</h2>
  <div class="form-grid col-3">
    <div class="form-group">
      <label>Nombre vendedor</label>
      <input type="text" id="af-nombre" value="JUAN">
    </div>
    <div class="form-group">
      <label>Apellido vendedor</label>
      <input type="text" id="af-apellido" value="PEREZ">
    </div>
    <div class="form-group">
      <label>CI / Documento</label>
      <input type="text" id="af-documento" value="1234567">
    </div>
    <div class="form-group">
      <label>N° Constancia (11 dígitos)</label>
      <input type="text" id="af-num-constancia" value="00000000001">
    </div>
    <div class="form-group">
      <label>Control Constancia (8 caracteres)</label>
      <input type="text" id="af-control-constancia" value="ABC12345">
    </div>
    ${renderDEHeader('af')}
    ${renderProductosWidget('af')}
  </div>
  <button class="btn btn-primary mt" id="af-crear">Crear Autofactura</button>
</div>
${renderJsonPreview('af', 'Simulador: JSON que se enviará (POST /de — Autofactura)')}
<div id="log-area-af" class="log"></div>`
}

export function bindAFForm() {
  bindProductos('af', { cant: 1, precio: 30000 })

  async function buildAFFormRequest() {
    const cfg = await getConfigFiscal()
    const vendedor = {
      nombre: $('af-nombre').value, apellido: $('af-apellido').value,
      nombreRazon: `${$('af-apellido').value}, ${$('af-nombre').value}`,
      documento: $('af-documento').value,
    }
    const constancia = {
      numero: $('af-num-constancia').value,
      control: $('af-control-constancia').value,
    }
    return {
      method: 'POST', url: '/de',
      body: buildAFCuer({ cfg, de: collectDEHeader('af'), vendedor, constancia, items: collectProductos('af'), empleadoId: state.uuidEmpleado }),
    }
  }

  bindJsonPreview('af', async () => [await buildAFFormRequest()])

  $('af-crear').onclick = async () => {
    const L = $('log-area-af'); L.innerHTML = ''
    try {
      L.innerHTML += `<span class="info">▶ Creando AF...</span>\n`
      const req = await buildAFFormRequest()
      const res = await fetchJSON(req.method, req.url, req.body)
      const afUuid = res?.uuid || res?.data?.uuid
      L.innerHTML += `<span class="ok">✓ AF: ${esc(afUuid)}</span>\n`

      L.innerHTML += `<span class="info">▶ Generando XML...</span>\n`
      await fetchJSON('POST', '/xml', { documentoUuid: afUuid })
      L.innerHTML += `<span class="ok">✓ XML generado</span>\n`
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }
}