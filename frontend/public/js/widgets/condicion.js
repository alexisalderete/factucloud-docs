// ── Widget Condición de Operación (Contado / Crédito) ────────────────────
import { $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'

let pagoSeq = 0
let cuotaSeq = 0

export function renderCondicionWidget(prefix) {
  return `
<div style="grid-column:1/-1">
  <div class="form-group">
    <label>Condición de Operación</label>
    <select id="${prefix}-condicion-tipo">${opts(SIFEN.condicion)}</select>
  </div>
  <div class="form-subset" id="${prefix}-bloque-contado">
    <div class="flex-between" style="grid-column:1/-1">
      <label>Pagos / Entregas</label>
      <button type="button" class="btn btn-outline btn-sm" id="${prefix}-add-pago">+ Agregar pago</button>
    </div>
    <div id="${prefix}-pagos"></div>
  </div>
  <div class="form-subset" id="${prefix}-bloque-credito" style="display:none">
    <div class="form-group"><label>Condición del Crédito</label>
      <select id="${prefix}-credito-tipo">${opts(SIFEN.tipoCredito)}</select>
    </div>
    <div class="form-group" id="${prefix}-credito-plazo-wrap"><label>Plazo</label><input type="text" id="${prefix}-credito-plazo" placeholder="Ej. 30 DÍAS"></div>
    <div class="form-group" id="${prefix}-credito-cuotas-wrap" style="display:none"><label>Cantidad de Cuotas</label><input type="number" id="${prefix}-credito-cuotas" value="3" min="1"></div>
    <div class="form-group"><label>Monto Entrega Inicial</label><input type="number" id="${prefix}-credito-monto-entrega" value="0" min="0"></div>
    <div class="form-group"><label>Monto Total</label><input type="number" id="${prefix}-credito-monto-total" value="0" min="0"></div>
    <div class="flex-between" style="grid-column:1/-1">
      <label>Cuotas detalladas</label>
      <button type="button" class="btn btn-outline btn-sm" id="${prefix}-add-cuota">+ Agregar cuota</button>
    </div>
    <div id="${prefix}-cuotas"></div>
  </div>
</div>`
}

// ── Pagos (contado) ─────────────────────────────
function pagoRowHTML(prefix, idx) {
  return `
<div class="item-row" data-pidx="${idx}">
  <div class="form-grid">
    <div class="form-group"><label>Tipo de Pago</label>
      <select id="${prefix}-pago-tipo-${idx}">${opts(SIFEN.tipoPago)}</select>
    </div>
    <div class="form-group"><label>Monto</label><input type="number" id="${prefix}-pago-monto-${idx}" value="0" min="0"></div>
    <div class="form-group"><label>Moneda</label>
      <select id="${prefix}-pago-moneda-${idx}">${opts(SIFEN.moneda)}</select>
    </div>
    <div class="form-group" id="${prefix}-pago-cambio-wrap-${idx}" style="display:none"><label>Tipo de Cambio</label><input type="number" id="${prefix}-pago-cambio-${idx}" step="0.01" value="1"></div>
    <div class="form-group" style="justify-content:flex-end"><button type="button" class="btn btn-danger btn-sm" data-remove-pago>✕ Quitar</button></div>
  </div>
  <div class="form-subset" id="${prefix}-pago-tarjeta-${idx}" style="display:none">
    <div class="form-group"><label>Denominación Tarjeta</label>
      <select id="${prefix}-pago-tarj-tipo-${idx}">${opts(SIFEN.denomTarjeta)}</select>
    </div>
    <div class="form-group"><label>Forma de Procesamiento</label>
      <select id="${prefix}-pago-tarj-medio-${idx}">${opts(SIFEN.medioPago)}</select>
    </div>
    <div class="form-group"><label>Titular</label><input type="text" id="${prefix}-pago-tarj-titular-${idx}"></div>
    <div class="form-group"><label>RUC Procesadora</label><input type="text" id="${prefix}-pago-tarj-ruc-${idx}" placeholder="1234567-8"></div>
    <div class="form-group"><label>Razón Social Procesadora</label><input type="text" id="${prefix}-pago-tarj-razon-${idx}"></div>
    <div class="form-group"><label>Código Autorización</label><input type="text" id="${prefix}-pago-tarj-cod-${idx}" placeholder="6-10 dígitos"></div>
  </div>
  <div class="form-subset" id="${prefix}-pago-cheque-${idx}" style="display:none">
    <div class="form-group"><label>Número de Cheque</label><input type="text" id="${prefix}-pago-cheq-num-${idx}" placeholder="hasta 8 dígitos"></div>
    <div class="form-group"><label>Banco Emisor</label><input type="text" id="${prefix}-pago-cheq-banco-${idx}"></div>
  </div>
</div>`
}

function addPagoRow(prefix) {
  const container = $(`${prefix}-pagos`)
  if (!container) return
  const idx = ++pagoSeq
  const div = document.createElement('div')
  div.innerHTML = pagoRowHTML(prefix, idx)
  const row = div.firstElementChild
  container.appendChild(row)

  const tipo = row.querySelector(`#${prefix}-pago-tipo-${idx}`)
  tipo.onchange = () => {
    const t = Number(tipo.value)
    row.querySelector(`#${prefix}-pago-tarjeta-${idx}`).style.display = [3, 4, 8].includes(t) ? '' : 'none'
    row.querySelector(`#${prefix}-pago-cheque-${idx}`).style.display = t === 2 ? '' : 'none'
  }
  const moneda = row.querySelector(`#${prefix}-pago-moneda-${idx}`)
  moneda.onchange = () => {
    row.querySelector(`#${prefix}-pago-cambio-wrap-${idx}`).style.display = moneda.value === 'PYG' ? 'none' : ''
  }
  row.querySelector('[data-remove-pago]').onclick = () => row.remove()
}

function collectPagos(prefix) {
  const rows = document.querySelectorAll(`#${prefix}-pagos .item-row`)
  if (!rows.length) throw new Error('Agregue al menos un pago (contado)')
  const entregas = []
  rows.forEach(row => {
    const idx = row.dataset.pidx
    const tipo = Number(row.querySelector(`#${prefix}-pago-tipo-${idx}`).value)
    const moneda = row.querySelector(`#${prefix}-pago-moneda-${idx}`).value
    const pago = { tipo, monto: Number(row.querySelector(`#${prefix}-pago-monto-${idx}`).value) || 0, moneda }
    if (moneda !== 'PYG') pago.cambio = Number(row.querySelector(`#${prefix}-pago-cambio-${idx}`).value) || 1
    if ([3, 4, 8].includes(tipo)) {
      const info = {
        tipo: Number(row.querySelector(`#${prefix}-pago-tarj-tipo-${idx}`).value),
        medioPago: Number(row.querySelector(`#${prefix}-pago-tarj-medio-${idx}`).value),
        titular: row.querySelector(`#${prefix}-pago-tarj-titular-${idx}`).value.trim(),
        ruc: row.querySelector(`#${prefix}-pago-tarj-ruc-${idx}`).value.trim(),
        razonSocial: row.querySelector(`#${prefix}-pago-tarj-razon-${idx}`).value.trim(),
        codigoAutorizacion: row.querySelector(`#${prefix}-pago-tarj-cod-${idx}`).value.trim(),
      }
      Object.keys(info).forEach(k => { if (!info[k]) delete info[k] })
      pago.infoTarjeta = info
    }
    if (tipo === 2) {
      pago.infoCheque = {
        numeroCheque: row.querySelector(`#${prefix}-pago-cheq-num-${idx}`).value.trim(),
        banco: row.querySelector(`#${prefix}-pago-cheq-banco-${idx}`).value.trim(),
      }
    }
    entregas.push(pago)
  })
  return entregas
}

// ── Cuotas (crédito) ────────────────────────────
function cuotaRowHTML(prefix, idx) {
  return `
<div class="item-row" data-cidx="${idx}">
  <div class="form-grid">
    <div class="form-group"><label>Moneda</label>
      <select id="${prefix}-cuota-moneda-${idx}">${opts(SIFEN.moneda)}</select>
    </div>
    <div class="form-group"><label>Monto</label><input type="number" id="${prefix}-cuota-monto-${idx}" value="0" min="0"></div>
    <div class="form-group"><label>Vencimiento</label><input type="date" id="${prefix}-cuota-vencimiento-${idx}"></div>
    <div class="form-group" style="justify-content:flex-end"><button type="button" class="btn btn-danger btn-sm" data-remove-cuota>✕ Quitar</button></div>
  </div>
</div>`
}

function addCuotaRow(prefix) {
  const container = $(`${prefix}-cuotas`)
  if (!container) return
  const idx = ++cuotaSeq
  const div = document.createElement('div')
  div.innerHTML = cuotaRowHTML(prefix, idx)
  const row = div.firstElementChild
  container.appendChild(row)
  row.querySelector('[data-remove-cuota]').onclick = () => row.remove()
}

function collectCuotas(prefix) {
  const rows = document.querySelectorAll(`#${prefix}-cuotas .item-row`)
  const cuotas = []
  rows.forEach(row => {
    const idx = row.dataset.cidx
    cuotas.push({
      moneda: row.querySelector(`#${prefix}-cuota-moneda-${idx}`).value,
      monto: Number(row.querySelector(`#${prefix}-cuota-monto-${idx}`).value) || 0,
      vencimiento: row.querySelector(`#${prefix}-cuota-vencimiento-${idx}`).value,
    })
  })
  return cuotas
}

// ── Bind + collect ──────────────────────────────
export function bindCondicion(prefix) {
  const sel = $(`${prefix}-condicion-tipo`)
  if (!sel) return
  sel.onchange = () => {
    const credito = sel.value === '2'
    $(`${prefix}-bloque-contado`).style.display = credito ? 'none' : ''
    $(`${prefix}-bloque-credito`).style.display = credito ? '' : 'none'
  }
  const csel = $(`${prefix}-credito-tipo`)
  if (csel) csel.onchange = () => {
    const cuota = csel.value === '2'
    $(`${prefix}-credito-plazo-wrap`).style.display = cuota ? 'none' : ''
    $(`${prefix}-credito-cuotas-wrap`).style.display = cuota ? '' : 'none'
  }
  addPagoRow(prefix)
  addCuotaRow(prefix)
  const addP = $(`${prefix}-add-pago`)
  if (addP) addP.onclick = () => addPagoRow(prefix)
  const addC = $(`${prefix}-add-cuota`)
  if (addC) addC.onclick = () => addCuotaRow(prefix)
}

export function collectCondicion(prefix) {
  const tipo = Number($(`${prefix}-condicion-tipo`)?.value || 1)
  if (tipo === 1) {
    return { tipo, entregas: collectPagos(prefix) }
  }
  const credito = { tipo: Number($(`${prefix}-credito-tipo`)?.value || 1) }
  if (credito.tipo === 1) {
    credito.plazo = ($(`${prefix}-credito-plazo`)?.value || '').trim()
    if (!credito.plazo) throw new Error('Ingrese el plazo del crédito')
  } else {
    credito.cuotas = Number($(`${prefix}-credito-cuotas`)?.value) || 0
    if (credito.cuotas <= 0) throw new Error('Ingrese la cantidad de cuotas')
    credito.montoEntrega = Number($(`${prefix}-credito-monto-entrega`)?.value) || 0
    credito.montoTotal = Number($(`${prefix}-credito-monto-total`)?.value) || 0
    const cuotas = collectCuotas(prefix)
    if (cuotas.length) credito.infoCuotas = cuotas
  }
  return { tipo: 2, credito }
}