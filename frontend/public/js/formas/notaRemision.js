// ── Formulario: Nota de Remisión (tipo 7) ──────────────────────────────────
import { state, $ } from '../core/state.js'
import { fetchJSON } from '../core/api.js'
import { getConfigFiscal } from '../core/fiscal.js'
import { buildNRBody } from '../core/payload.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { esc } from '../core/ui.js'
import { bindJsonPreview, renderJsonPreview } from '../widgets/jsonPreview.js'
import { renderClienteWidget, bindCliente, collectCliente } from '../widgets/cliente.js'
import { renderDEHeader, collectDEHeader } from '../widgets/cabecera.js'
import { renderProductosWidget, bindProductos, collectProductos } from '../widgets/productos.js'
import { bindVehiculos, collectVehiculos } from '../widgets/vehiculos.js'
import { renderTransportistaWidget, bindTransportista, collectTransportista } from '../widgets/transportista.js'

export function renderFormNR() {
  return `
<div class="card">
  <h2>Nota de Remisión (tipo 7)</h2>
  <div class="form-grid">
    ${renderClienteWidget('nr')}
    ${renderDEHeader('nr', { permitirSinNombre: false })}
    ${renderProductosWidget('nr')}

    <div class="form-grid col-1 de-section" style="grid-column:1/-1">
      <div class="section-title">E6 — Cabecera Nota de Remisión</div>
      <div class="form-group"><label>Motivo de Emisión</label>
        <select id="nr-motivo">${opts(SIFEN.motivoNR)}</select>
      </div>
      <div class="form-group"><label>Responsable de Emisión</label>
        <select id="nr-responsable-emision">${opts(SIFEN.responsableEmision)}</select>
      </div>
      <div class="form-group"><label>Km Estimado</label><input type="number" id="nr-km-estimado" min="0"></div>
      <div class="form-group"><label>Fecha de Emisión Futura</label><input type="date" id="nr-fecha-emision-futura"></div>
    </div>

    <div class="form-grid col-1 de-section" style="grid-column:1/-1">
      <div class="section-title">E10 — Transporte</div>
      <div class="form-group"><label>Tipo de Transporte</label>
        <select id="nr-tipo-transporte">${opts(SIFEN.tipoTransporte)}</select>
      </div>
      <div class="form-group"><label>Modalidad de Traslado</label>
        <select id="nr-modalidad">${opts(SIFEN.modalidadTraslado)}</select>
      </div>
      <div class="form-group"><label>Responsable del Flete</label>
        <select id="nr-responsable-flete">${opts(SIFEN.responsableFlete)}</select>
      </div>
      <div class="form-group"><label>Condición de Negociación (Incoterm)</label>
        <select id="nr-condicion-negociacion"><option value="">— Ninguno —</option>${opts(SIFEN.condicionNegociacion)}</select>
      </div>
      <div class="form-group"><label>N° Manifiesto</label><input type="text" id="nr-manifiesto"></div>
      <div class="form-group"><label>N° Despacho de Importación</label><input type="text" id="nr-despacho-importacion"></div>
      <div class="form-group"><label>Fecha Inicio Traslado</label><input type="date" id="nr-fecha-inicio-traslado"></div>
      <div class="form-group"><label>Fecha Fin Traslado</label><input type="date" id="nr-fecha-fin-traslado"></div>
      <div class="form-group"><label>País Destino</label>
        <select id="nr-pais-destino">${opts(SIFEN.pais)}</select>
      </div>
      <div class="form-group"><label>Descripción País Destino</label><input type="text" id="nr-des-pais-destino"></div>
    </div>

    <div class="form-grid col-1 de-section" style="grid-column:1/-1">
      <div class="section-title">E10.1 — Local de Salida</div>
      <div class="form-group"><label>Dirección</label><input type="text" id="nr-salida-direccion" value="Salida"></div>
      <div class="form-group"><label>N° Casa</label><input type="text" id="nr-salida-numero-casa" value="0"></div>
      <div class="form-group"><label>Complemento 1</label><input type="text" id="nr-salida-complemento-1"></div>
      <div class="form-group"><label>Complemento 2</label><input type="text" id="nr-salida-complemento-2"></div>
      <div class="form-group"><label>Código Departamento</label><input type="text" id="nr-salida-departamento" value="1"></div>
      <div class="form-group"><label>Desc. Departamento</label><input type="text" id="nr-salida-des-departamento" value="CAPITAL"></div>
      <div class="form-group"><label>Código Distrito</label><input type="text" id="nr-salida-distrito"></div>
      <div class="form-group"><label>Desc. Distrito</label><input type="text" id="nr-salida-des-distrito"></div>
      <div class="form-group"><label>Código Ciudad</label><input type="text" id="nr-salida-ciudad" value="1"></div>
      <div class="form-group"><label>Desc. Ciudad</label><input type="text" id="nr-salida-des-ciudad" value="ASUNCION"></div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="nr-salida-telefono"></div>
    </div>

    <div class="form-grid col-1 de-section" style="grid-column:1/-1">
      <div class="section-title">E10.2 — Local de Entrega</div>
      <div class="form-group"><label>Dirección</label><input type="text" id="nr-entrega-direccion" value="Entrega"></div>
      <div class="form-group"><label>N° Casa</label><input type="text" id="nr-entrega-numero-casa" value="0"></div>
      <div class="form-group"><label>Complemento 1</label><input type="text" id="nr-entrega-complemento-1"></div>
      <div class="form-group"><label>Complemento 2</label><input type="text" id="nr-entrega-complemento-2"></div>
      <div class="form-group"><label>Código Departamento</label><input type="text" id="nr-entrega-departamento" value="1"></div>
      <div class="form-group"><label>Desc. Departamento</label><input type="text" id="nr-entrega-des-departamento" value="CAPITAL"></div>
      <div class="form-group"><label>Código Distrito</label><input type="text" id="nr-entrega-distrito"></div>
      <div class="form-group"><label>Desc. Distrito</label><input type="text" id="nr-entrega-des-distrito"></div>
      <div class="form-group"><label>Código Ciudad</label><input type="text" id="nr-entrega-ciudad" value="1"></div>
      <div class="form-group"><label>Desc. Ciudad</label><input type="text" id="nr-entrega-des-ciudad" value="ASUNCION"></div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="nr-entrega-telefono"></div>
    </div>

    <div class="form-grid col-1 de-section" style="grid-column:1/-1">
      <div class="section-title">E10.3 — Vehículos</div>
      <div class="flex-between" style="grid-column:1/-1">
        <label class="text-sm" style="font-weight:500;color:var(--text2)">Vehículos</label>
        <button type="button" class="btn btn-outline btn-sm" id="nr-add-vehiculo">+ Agregar vehículo</button>
      </div>
      <div id="nr-vehiculos"></div>
    </div>

    ${renderTransportistaWidget('nr')}
  </div>
  <button class="btn btn-primary mt" id="nr-crear">Crear Nota de Remisión</button>
</div>
${renderJsonPreview('nr', 'Simulador: JSON que se enviará (POST /nota-remision)')}
<div id="log-area-nr" class="log"></div>`
}

export function bindNRForm() {
  bindCliente('nr')
  bindProductos('nr', { cant: 5, precio: 0 })
  bindVehiculos('nr')
  bindTransportista('nr')

  function buildNRContextForm() {
    const header = collectDEHeader('nr')
    const base = { cliente: header.emitirSinNombre ? {} : collectCliente('nr'), items: collectProductos('nr'), de: header }

    const hoy = new Date().toISOString().slice(0, 10)
    const transporte = { tipoTransporte: Number($('nr-tipo-transporte').value),
      modalidadTraslado: Number($('nr-modalidad').value), responsableFlete: Number($('nr-responsable-flete').value),
      fechaInicioTraslado: $('nr-fecha-inicio-traslado').value || hoy }
    const condicionNeg = $('nr-condicion-negociacion').value.trim()
    const manifiesto = $('nr-manifiesto').value.trim()
    const despacho = $('nr-despacho-importacion').value.trim()
    const fechaFin = $('nr-fecha-fin-traslado').value
    const paisDestino = $('nr-pais-destino').value
    const desPais = $('nr-des-pais-destino').value.trim()
    if (condicionNeg) transporte.condicionNegociacion = condicionNeg
    if (manifiesto) transporte.numeroManifiesto = manifiesto
    if (despacho) transporte.numeroDespachoImportacion = despacho
    if (fechaFin) transporte.fechaFinTraslado = fechaFin
    if (paisDestino) transporte.codPaisDestino = paisDestino
    if (desPais) transporte.desPaisDestino = desPais

    const local = (p) => ({
      direccion: $(`${p}-direccion`).value.trim(), numeroCasa: $(`${p}-numero-casa`).value.trim(),
      codDepartamento: $(`${p}-departamento`).value.trim(), desDepartamento: $(`${p}-des-departamento`).value.trim(),
      codCiudad: $(`${p}-ciudad`).value.trim(), desCiudad: $(`${p}-des-ciudad`).value.trim(),
    })
    const salida = local('nr-salida'); const entrega = local('nr-entrega')
    ;['salida', 'entrega'].forEach(se => {
      const c1 = $(`nr-${se}-complemento-1`).value.trim(); const c2 = $(`nr-${se}-complemento-2`).value.trim()
      const dis = $(`nr-${se}-distrito`).value.trim(); const desDis = $(`nr-${se}-des-distrito`).value.trim(); const tel = $(`nr-${se}-telefono`).value.trim()
      const obj = se === 'salida' ? salida : entrega
      if (c1) obj.complemento1 = c1
      if (c2) obj.complemento2 = c2
      if (dis) obj.codDistrito = dis
      if (desDis) obj.desDistrito = desDis
      if (tel) obj.telefono = tel
    })

    base.nr = {
      motivoEmision: Number($('nr-motivo').value),
      responsableEmision: Number($('nr-responsable-emision').value),
      kmEstimado: Number($('nr-km-estimado').value) || 0,
      fechaEmisionFutura: $('nr-fecha-emision-futura').value || undefined,
      transporte,
      localSalida: salida,
      localEntrega: entrega,
      vehiculos: collectVehiculos('nr'),
      transportista: collectTransportista('nr'),
    }
    return base
  }
  async function buildNRRequest(ctx, cfg) {
    return { method: 'POST', url: '/nota-remision', body: buildNRBody({ cfg, de: ctx.de, cliente: ctx.cliente, items: ctx.items, nr: ctx.nr, empleadoId: state.uuidEmpleado }) }
  }

  bindJsonPreview('nr', async () => [await buildNRRequest(buildNRContextForm(), await getConfigFiscal())])

  $('nr-crear').onclick = async () => {
    const L = $('log-area-nr'); L.innerHTML = ''
    let ctx
    try { ctx = buildNRContextForm() }
    catch (e) { return L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
    try {
      L.innerHTML += `<span class="info">▶ Creando NR...</span>\n`
      const cfg = await getConfigFiscal()
      const req = await buildNRRequest(ctx, cfg)
      const res = await fetchJSON(req.method, req.url, req.body)
      const nrUuid = res?.uuid || res?.data?.uuid
      L.innerHTML += `<span class="ok">✓ NR: ${esc(nrUuid)}</span>\n`

      L.innerHTML += `<span class="info">▶ Generando XML...</span>\n`
      await fetchJSON('POST', '/xml', { documentoUuid: nrUuid })
      L.innerHTML += `<span class="ok">✓ XML generado</span>\n`
    } catch (e) { L.innerHTML += `<span class="err">✗ ${esc(e.message)}</span>\n` }
  }
}