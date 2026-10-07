// ── Widget Vehículos (Nota de Remisión) ───────────────────────────────────
import { $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'

let vehSeq = 0

function vehiculoRowHTML(prefix, idx) {
  return `
<div class="item-row" data-vidx="${idx}">
  <div class="form-grid">
    <div class="form-group"><label>Tipo de Vehículo (4-10 chars)</label><input type="text" id="${prefix}-veh-tipo-${idx}" value="CAMION"></div>
    <div class="form-group"><label>Marca</label><input type="text" id="${prefix}-veh-marca-${idx}" value="TOYOTA"></div>
    <div class="form-group"><label>Tipo Identificación</label>
      <select id="${prefix}-veh-id-tipo-${idx}">${opts(SIFEN.tipoIdentificacionVehiculo)}</select>
    </div>
    <div class="form-group"><label>N° Identificación</label><input type="text" id="${prefix}-veh-id-${idx}"></div>
    <div class="form-group"><label>N° Matrícula</label><input type="text" id="${prefix}-veh-matricula-${idx}" value="ABC123"></div>
    <div class="form-group"><label>N° Vuelo</label><input type="text" id="${prefix}-veh-vuelo-${idx}"></div>
    <div class="form-group"><label>Datos Adicionales</label><input type="text" id="${prefix}-veh-datos-${idx}"></div>
    <div class="form-group" style="justify-content:flex-end"><button type="button" class="btn btn-danger btn-sm" data-remove-veh>✕ Quitar</button></div>
  </div>
</div>`
}

export function bindVehiculos(prefix) {
  const add = $(`${prefix}-add-vehiculo`)
  if (add) add.onclick = () => addVehiculoRow(prefix)
  addVehiculoRow(prefix)
}

function addVehiculoRow(prefix) {
  const container = $(`${prefix}-vehiculos`)
  if (!container) return
  const idx = ++vehSeq
  const div = document.createElement('div')
  div.innerHTML = vehiculoRowHTML(prefix, idx)
  const row = div.firstElementChild
  container.appendChild(row)
  row.querySelector('[data-remove-veh]').onclick = () => row.remove()
}

export function collectVehiculos(prefix) {
  const rows = document.querySelectorAll(`#${prefix}-vehiculos .item-row`)
  if (!rows.length) throw new Error('Agregue al menos un vehículo')
  const vehiculos = []
  rows.forEach(row => {
    const idx = row.dataset.vidx
    const tipoIdentificacion = Number(row.querySelector(`#${prefix}-veh-id-tipo-${idx}`).value)
    const tipoVehiculo = row.querySelector(`#${prefix}-veh-tipo-${idx}`).value.trim()
    if (tipoVehiculo.length < 4 || tipoVehiculo.length > 10) throw new Error('Tipo de vehículo debe tener entre 4 y 10 caracteres')
    const veh = {
      tipoVehiculo,
      marca: row.querySelector(`#${prefix}-veh-marca-${idx}`).value.trim(),
      tipoIdentificacion,
    }
    const numId = row.querySelector(`#${prefix}-veh-id-${idx}`).value.trim()
    const matricula = row.querySelector(`#${prefix}-veh-matricula-${idx}`).value.trim()
    const vuelo = row.querySelector(`#${prefix}-veh-vuelo-${idx}`).value.trim()
    const datos = row.querySelector(`#${prefix}-veh-datos-${idx}`).value.trim()
    if (tipoIdentificacion === 1) {
      if (!numId) throw new Error('Ingrese el número de identificación del vehículo')
      veh.numeroIdentificacion = numId
    } else {
      if (!matricula) throw new Error('Ingrese el número de matrícula del vehículo')
      veh.numeroMatricula = matricula
    }
    if (vuelo) veh.numeroVuelo = vuelo
    if (datos) veh.datosAdicionales = datos
    vehiculos.push(veh)
  })
  return vehiculos
}