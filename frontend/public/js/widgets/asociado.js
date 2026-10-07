// ── Widget Documento Asociado (NC / ND) ───────────────────────────────────
// La NC/ND debe referenciar el documento original (electrónico o impreso).
import { $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { fetchJSON } from '../core/api.js'

export function renderAsociadoWidget(prefix) {
  return `
<div style="grid-column:1/-1">
  <div class="form-group">
    <label>Tipo de Documento Asociado</label>
    <select id="${prefix}-asoc-tipo">${opts(SIFEN.tipoDocAsociado)}</select>
  </div>
  <div class="form-subset" id="${prefix}-asoc-electronico">
    <div class="form-group"><label>CDC del documento original</label><input type="text" id="${prefix}-asoc-cdc" placeholder="010078152250010010..."></div>
  </div>
  <div class="form-subset" id="${prefix}-asoc-impreso" style="display:none">
    <div class="form-group"><label>Timbrado Impreso</label><input type="text" id="${prefix}-asoc-timbrado"></div>
    <div class="form-group"><label>Tipo Documento Impreso</label>
      <select id="${prefix}-asoc-tipo-doc-impreso">${opts(SIFEN.tipoDocImpreso)}</select>
    </div>
    <div class="form-group"><label>Establecimiento</label><input type="text" id="${prefix}-asoc-establecimiento" value="001"></div>
    <div class="form-group"><label>Punto de Expedición</label><input type="text" id="${prefix}-asoc-punto" value="001"></div>
    <div class="form-group"><label>Número</label><input type="text" id="${prefix}-asoc-numero" value="0000001"></div>
    <div class="form-group"><label>Fecha de Emisión</label><input type="date" id="${prefix}-asoc-fecha"></div>
  </div>
</div>`
}

export function bindAsociado(prefix) {
  const sel = $(`${prefix}-asoc-tipo`)
  if (!sel) return
  sel.onchange = () => {
    const impreso = sel.value === '2'
    $(`${prefix}-asoc-electronico`).style.display = impreso ? 'none' : ''
    $(`${prefix}-asoc-impreso`).style.display = impreso ? '' : 'none'
  }
}

export async function collectAsociado(prefix) {
  const tipo = Number($(`${prefix}-asoc-tipo`).value)
  if (tipo === 1) {
    const cdc = ($(`${prefix}-asoc-cdc`).value || '').trim()
    if (!cdc) throw new Error('Ingrese el CDC del documento original')
    const deOrig = await fetchJSON('GET', `/de/documentos?page=1&limit=10&cdc=${cdc}`)
    const uuidOrig = deOrig?.results?.[0]?.uuid
    if (!uuidOrig) throw new Error(`No se encontró DE con CDC ${cdc}`)
    const est = cdc.slice(10, 12) || '001'
    const pto = cdc.slice(12, 14) || '001'
    const num = cdc.slice(14, 22) || '0000001'
    return {
      tipoDocumentoAsociado: 1,
      uuidDocumentoAfectado: uuidOrig,
      cdc,
      numeroDocumentoFiscalAsociado: `${est}-${pto}-${num}`,
    }
  }
  const fecha = ($(`${prefix}-asoc-fecha`).value || '').trim()
  const timbrado = ($(`${prefix}-asoc-timbrado`).value || '').trim()
  const establecimiento = ($(`${prefix}-asoc-establecimiento`).value || '').trim()
  const punto = ($(`${prefix}-asoc-punto`).value || '').trim()
  const numero = ($(`${prefix}-asoc-numero`).value || '').trim()
  if (!timbrado) throw new Error('Ingrese el timbrado del documento impreso')
  if (!/^\d{8}$/.test(timbrado)) throw new Error('El timbrado del documento impreso debe tener exactamente 8 números')
  if (!establecimiento) throw new Error('Ingrese el establecimiento del documento impreso')
  if (!punto) throw new Error('Ingrese el punto de expedición del documento impreso')
  if (!numero) throw new Error('Ingrese el número del documento impreso')
  if (!fecha) throw new Error('Ingrese la fecha de emisión del documento impreso')
  const asoc = {
    tipoDocumentoAsociado: 2,
    timbradoImpreso: timbrado,
    tipoDocumentoImpreso: Number($(`${prefix}-asoc-tipo-doc-impreso`).value),
    establecimientoImpreso: establecimiento,
    puntoImpreso: punto,
    numeroImpreso: numero,
    fechaEmisionImpreso: fecha,
  }
  return asoc
}