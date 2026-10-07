// ── Widget Productos (repetidor: catálogo o texto libre) ───────────────────
import { state, $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { productoOption, esc } from '../core/ui.js'

let itemSeq = 0

export function productoRowHTML(prefix, idx, values = {}) {
  const cant = values.cant ?? 1
  const precio = values.precio ?? 0
  return `
<div class="item-row" data-idx="${idx}">
  <div class="form-grid">
    <div class="form-group">
      <label>Producto</label>
      <div class="seg" id="${prefix}-producto-modo-${idx}">
        <button type="button" class="active" data-modo="sel">Catálogo</button>
        <button type="button" data-modo="libre">Texto libre</button>
      </div>
      <select id="${prefix}-producto-select-${idx}" style="margin-top:.5rem"><option value="">— Seleccionar —</option>
        ${state.productos.map(p => `<option value="${esc(p.uuid)}">${esc(productoOption(p).text)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Cantidad</label><input type="number" id="${prefix}-cantidad-${idx}" value="${cant}" min="1"></div>
    <div class="form-group"><label>Precio Unitario (Gs.)</label><input type="number" id="${prefix}-precio-${idx}" value="${precio}" min="0"></div>
    <div class="form-group"><label>Descuento (Gs.)</label><input type="number" id="${prefix}-descuento-${idx}" value="0" min="0"></div>
    <div class="form-group"><label>Tasa IVA</label>
      <select id="${prefix}-producto-iva-${idx}">${opts(SIFEN.iva)}</select>
    </div>
    <div class="form-group"><label>Tipo Afectación IVA</label>
      <select id="${prefix}-afectacion-${idx}">${opts(SIFEN.tipoAfectacionIva)}</select>
    </div>
    <div class="form-group" id="${prefix}-prop-wrap-${idx}" style="display:none"><label>Proporción Gravada (%)</label><input type="number" id="${prefix}-proporcion-${idx}" value="50" min="1" max="99"></div>
    <div class="form-group" style="justify-content:flex-end"><button type="button" class="btn btn-danger btn-sm" data-remove>✕ Quitar</button></div>
  </div>
  <div class="form-subset" id="${prefix}-producto-libre-${idx}" style="display:none">
    <div class="form-group"><label>Descripción</label><input type="text" id="${prefix}-producto-descripcion-${idx}" placeholder="Ej. SERVICIO DE CONSULTORÍA"></div>
    <div class="form-group"><label>Código Interno</label><input type="text" id="${prefix}-producto-codigo-interno-${idx}"></div>
    <div class="form-group"><label>Unidad de Medida</label>
      <select id="${prefix}-producto-um-${idx}">${opts(SIFEN.um)}</select>
    </div>
    <div class="form-group"><label>GTIN Producto</label><input type="text" id="${prefix}-producto-gtin-${idx}"></div>
    <div class="form-group"><label>GTIN Paquete</label><input type="text" id="${prefix}-producto-gtin-paq-${idx}"></div>
    <div class="form-group"><label>Código DNCP General</label><input type="text" id="${prefix}-producto-dncp-g-${idx}"></div>
    <div class="form-group"><label>Código DNCP Específico</label><input type="text" id="${prefix}-producto-dncp-e-${idx}"></div>
  </div>
</div>`
}

export function renderProductosWidget(prefix) {
  return `
<div style="grid-column:1/-1">
  <div class="flex-between mb">
    <label class="text-sm" style="font-weight:500;color:var(--text2)">Productos</label>
    <button type="button" class="btn btn-outline btn-sm" id="${prefix}-add-producto">+ Agregar producto</button>
  </div>
  <div id="${prefix}-items"></div>
</div>`
}

export function bindProductos(prefix, opts = {}) {
  const add = $(`${prefix}-add-producto`)
  if (add) add.onclick = () => addProductoRow(prefix, opts)
  addProductoRow(prefix, opts)
}

export function addProductoRow(prefix, values = {}) {
  const container = $(`${prefix}-items`)
  if (!container) return
  const idx = ++itemSeq
  const div = document.createElement('div')
  div.innerHTML = productoRowHTML(prefix, idx, values)
  const row = div.firstElementChild
  container.appendChild(row)

  const seg = row.querySelector(`#${prefix}-producto-modo-${idx}`)
  seg?.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const libre = btn.dataset.modo === 'libre'
      row.querySelector(`#${prefix}-producto-select-${idx}`).style.display = libre ? 'none' : ''
      row.querySelector(`#${prefix}-producto-libre-${idx}`).style.display = libre ? '' : 'none'
    }
  })

  const afect = row.querySelector(`#${prefix}-afectacion-${idx}`)
  afect.onchange = () => {
    row.querySelector(`#${prefix}-prop-wrap-${idx}`).style.display = afect.value === '4' ? '' : 'none'
  }

  row.querySelector('[data-remove]').onclick = () => row.remove()
}

export function collectProductos(prefix) {
  const rows = document.querySelectorAll(`#${prefix}-items .item-row`)
  if (!rows.length) throw new Error('Agregue al menos un producto')
  const items = []
  rows.forEach(row => {
    const idx = row.dataset.idx
    const tipoAfectacionIva = Number(row.querySelector(`#${prefix}-afectacion-${idx}`).value)
    const base = {
      cantidad: Number(row.querySelector(`#${prefix}-cantidad-${idx}`).value) || 1,
      precioUnitario: Number(row.querySelector(`#${prefix}-precio-${idx}`).value) || 0,
      descuentoMonto: Number(row.querySelector(`#${prefix}-descuento-${idx}`).value) || 0,
      tipoAfectacionIva,
      proporcionGravada: tipoAfectacionIva === 4 ? (Number(row.querySelector(`#${prefix}-proporcion-${idx}`).value) || 0) : (tipoAfectacionIva === 1 ? 100 : 0),
    }
    const modo = row.querySelector(`#${prefix}-producto-modo-${idx} button.active`).dataset.modo
    if (modo === 'libre') {
      const descripcion = (row.querySelector(`#${prefix}-producto-descripcion-${idx}`).value || '').trim()
      if (!descripcion) throw new Error('Ingrese la descripción del producto')
      const codigoInterno = (row.querySelector(`#${prefix}-producto-codigo-interno-${idx}`).value || '').trim()
      const gtinProducto = (row.querySelector(`#${prefix}-producto-gtin-${idx}`).value || '').trim()
      const gtinPaquete = (row.querySelector(`#${prefix}-producto-gtin-paq-${idx}`).value || '').trim()
      const codigoDncpGeneral = (row.querySelector(`#${prefix}-producto-dncp-g-${idx}`).value || '').trim()
      const codigoDncpEspecifico = (row.querySelector(`#${prefix}-producto-dncp-e-${idx}`).value || '').trim()
      const item = {
        ...base,
        descripcion,
        codUnidadMedida: row.querySelector(`#${prefix}-producto-um-${idx}`).value || '77',
        iva: Number(row.querySelector(`#${prefix}-producto-iva-${idx}`).value || 10),
      }
      if (codigoInterno) item.codigoInterno = codigoInterno
      if (gtinProducto) item.gtinProducto = gtinProducto
      if (gtinPaquete) item.gtinPaquete = gtinPaquete
      if (codigoDncpGeneral) item.codigoDncpGeneral = codigoDncpGeneral
      if (codigoDncpEspecifico) item.codigoDncpEspecifico = codigoDncpEspecifico
      items.push(item)
    } else {
      const sel = row.querySelector(`#${prefix}-producto-select-${idx}`)
      if (!sel.value) throw new Error('Seleccione un producto')
      items.push({
        ...base,
        uuidProducto: sel.value,
        codUnidadMedida: '77',
        iva: Number(row.querySelector(`#${prefix}-producto-iva-${idx}`).value || 10),
      })
    }
  })
  return items
}