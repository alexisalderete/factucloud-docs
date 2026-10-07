// ── Widget Transportista (Nota de Remisión) ───────────────────────────────
import { $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'

export function renderTransportistaWidget(prefix) {
  return `
<div class="form-grid col-1 de-section" style="grid-column:1/-1">
  <div class="section-title">E10.4 — Transportista</div>
  <div class="form-group"><label>Naturaleza</label>
    <select id="${prefix}-transp-naturaleza">${opts(SIFEN.naturalezaTransportista)}</select>
  </div>
  <div class="form-group"><label>Nombre / Razón Social</label><input type="text" id="${prefix}-transp-nombre" value="TRANSPORTISTA SA"></div>
  <div class="form-group" id="${prefix}-transp-ruc-wrap"><label>RUC</label><input type="text" id="${prefix}-transp-ruc" value="80000000"></div>
  <div class="form-group" id="${prefix}-transp-dv-wrap"><label>DV</label><input type="text" id="${prefix}-transp-dv" value="0"></div>
  <div class="form-group" id="${prefix}-transp-tipo-doc-wrap" style="display:none"><label>Tipo Documento</label>
    <select id="${prefix}-transp-tipo-doc">${opts(SIFEN.tipoDocIdentidad)}</select>
  </div>
  <div class="form-group" id="${prefix}-transp-num-doc-wrap" style="display:none"><label>N° Documento</label><input type="text" id="${prefix}-transp-num-doc"></div>
  <div class="form-group"><label>Dirección</label><input type="text" id="${prefix}-transp-direccion"></div>
  <div class="form-group"><label>País</label>
    <select id="${prefix}-transp-pais">${opts(SIFEN.pais)}</select>
  </div>
  <div class="form-group"><label>Departamento</label><input type="text" id="${prefix}-transp-departamento" value="1"></div>
  <div class="form-group"><label>Distrito</label><input type="text" id="${prefix}-transp-distrito" value="1"></div>
  <div class="form-group"><label>Ciudad</label><input type="text" id="${prefix}-transp-ciudad" value="1"></div>
  <div class="form-group"><label>Nombre del Chofer</label><input type="text" id="${prefix}-transp-chofer-nombre"></div>
  <div class="form-group"><label>Tipo Documento Chofer</label>
    <select id="${prefix}-transp-chofer-tipo-doc">${opts(SIFEN.tipoDocIdentidad)}</select>
  </div>
  <div class="form-group"><label>Documento Chofer</label><input type="text" id="${prefix}-transp-chofer-doc"></div>
  <div class="form-group"><label>Dirección Chofer</label><input type="text" id="${prefix}-transp-chofer-direccion"></div>
</div>`
}

export function bindTransportista(prefix) {
  const nat = $(`${prefix}-transp-naturaleza`)
  if (!nat) return
  nat.onchange = () => {
    const contribuyente = nat.value === '1'
    const show = id => { const el = $(id); if (el) el.style.display = contribuyente ? 'none' : '' }
    const showC = id => { const el = $(id); if (el) el.style.display = contribuyente ? '' : 'none' }
    showC(`${prefix}-transp-ruc-wrap`)
    showC(`${prefix}-transp-dv-wrap`)
    show(`${prefix}-transp-tipo-doc-wrap`)
    show(`${prefix}-transp-num-doc-wrap`)
  }
}

export function collectTransportista(prefix) {
  const naturaleza = Number($(`${prefix}-transp-naturaleza`).value)
  const nombreRazon = ($(`${prefix}-transp-nombre`).value || '').trim()
  if (!nombreRazon) throw new Error('Ingrese el nombre o razón social del transportista')
  const t = { naturaleza, nombreRazon }
  if (naturaleza === 1) {
    const ruc = ($(`${prefix}-transp-ruc`).value || '').trim()
    const dv = ($(`${prefix}-transp-dv`).value || '0').trim()
    if (!ruc) throw new Error('Ingrese el RUC del transportista')
    t.ruc = ruc
    t.dvRuc = dv
  } else {
    const numeroDocumento = ($(`${prefix}-transp-num-doc`).value || '').trim()
    if (!numeroDocumento) throw new Error('Ingrese el número de documento del transportista')
    t.tipoDocumentoIdentidad = Number($(`${prefix}-transp-tipo-doc`).value)
    t.numeroDocumento = numeroDocumento
  }
  const direccion = ($(`${prefix}-transp-direccion`).value || '').trim()
  const pais = ($(`${prefix}-transp-pais`).value || 'PRY')
  if (direccion) t.direccion = direccion
  if (pais) t.codPais = pais
  const dep = ($(`${prefix}-transp-departamento`).value || '').trim()
  const dis = ($(`${prefix}-transp-distrito`).value || '').trim()
  const ciu = ($(`${prefix}-transp-ciudad`).value || '').trim()
  if (dep) t.codDepartamento = dep
  if (dis) t.codDistrito = dis
  if (ciu) t.codCiudad = ciu
  const choferNombre = ($(`${prefix}-transp-chofer-nombre`).value || '').trim()
  const choferDoc = ($(`${prefix}-transp-chofer-doc`).value || '').trim()
  if (choferNombre) t.nombreChofer = choferNombre
  if (choferDoc) {
    t.documentoChofer = choferDoc
    t.tipoDocumentoChofer = Number($(`${prefix}-transp-chofer-tipo-doc`).value)
  }
  const choferDir = ($(`${prefix}-transp-chofer-direccion`).value || '').trim()
  if (choferDir) t.direccionChofer = choferDir
  return t
}