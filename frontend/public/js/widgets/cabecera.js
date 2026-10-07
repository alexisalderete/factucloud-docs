// ── Cabecera DE común (tipo emisión / transacción / impuesto / presencia) ──
import { $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'

export function renderDEHeader(prefix, { permitirSinNombre = true } = {}) {
  return `
<div style="grid-column:1/-1">
  <div class="form-grid">
    <div class="form-group"><label>Tipo Emisión</label>
      <select id="${prefix}-tipo-emision">${opts(SIFEN.tipoEmision)}</select>
    </div>
    <div class="form-group"><label>Tipo Transacción</label>
      <select id="${prefix}-tipo-transaccion">${opts(SIFEN.tipoTransaccion)}</select>
    </div>
    <div class="form-group"><label>Tipo Impuesto</label>
      <select id="${prefix}-tipo-impuesto">${opts(SIFEN.tipoImpuesto)}</select>
    </div>
    <div class="form-group"><label>Indicador de Presencia</label>
      <select id="${prefix}-presencia">${opts(SIFEN.presencia)}</select>
    </div>
    <div class="form-group"><label><input type="checkbox" id="${prefix}-emitir-ci"> Emitir con CI (ignora RUC)</label></div>
    ${permitirSinNombre
      ? `<div class="form-group"><label><input type="checkbox" id="${prefix}-emitir-sin-nombre"> Emitir sin nombre</label></div>`
      : ''}
  </div>
</div>`
}

export function collectDEHeader(prefix) {
  return {
    tipoEmision: Number($(`${prefix}-tipo-emision`)?.value || 1),
    tipoTransaccion: Number($(`${prefix}-tipo-transaccion`)?.value || 1),
    tipoImpuesto: Number($(`${prefix}-tipo-impuesto`)?.value || 1),
    presencia: Number($(`${prefix}-presencia`)?.value || 1),
    emitirConCi: !!$(`${prefix}-emitir-ci`)?.checked,
    emitirSinNombre: !!$(`${prefix}-emitir-sin-nombre`)?.checked,
  }
}