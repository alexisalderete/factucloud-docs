// ── Widget Cliente (seleccionar existente / crear nuevo) ───────────────────
// Reutilizable por todos los documentos (Factura, NC, ND, NR).
import { state, $ } from '../core/state.js'
import { SIFEN, opts } from '../constantes/sifen.js'
import { personaOption, esc } from '../core/ui.js'

// Opciones de país con PRY seleccionado por defecto (el backend exige codPais;
// PRY es el caso más común y evita el primer elemento del catálogo, que es MKD).
function optsPais() {
  const pry = SIFEN.pais.filter(p => p.v === 'PRY')
  const resto = SIFEN.pais.filter(p => p.v !== 'PRY')
  return [...pry, ...resto]
    .map(p => `<option value="${esc(p.v)}"${p.v === 'PRY' ? ' selected' : ''}>${esc(p.t)}</option>`)
    .join('')
}

export function renderClienteWidget(prefix) {
  return `
<div class="form-group">
  <label>Cliente</label>
  <div class="seg" id="${prefix}-cliente-modo">
    <button type="button" class="active" data-modo="sel">Seleccionar</button>
    <button type="button" data-modo="nuevo">Nuevo</button>
  </div>
  <select id="${prefix}-cliente-select" style="margin-top:.5rem"><option value="">— Seleccionar —</option>
    ${state.personas.map(p => `<option value="${esc(p.uuid)}">${esc(personaOption(p).text)}</option>`).join('')}
  </select>
</div>
<div class="form-subset" id="${prefix}-cliente-nuevo" style="display:none">
  <div class="form-group"><label>Naturaleza</label>
    <select id="${prefix}-cliente-naturaleza">
      <option value="1">1 — Contribuyente</option>
      <option value="2">2 — No contribuyente</option>
    </select>
  </div>
  <div class="form-group" id="${prefix}-cliente-nombre-razon-wrap"><label>Nombre / Razón Social</label><input type="text" id="${prefix}-cliente-nombre-razon"></div>
  <div class="form-group" id="${prefix}-cliente-nombre-wrap" style="display:none"><label>Nombre</label><input type="text" id="${prefix}-cliente-nombre"></div>
  <div class="form-group" id="${prefix}-cliente-apellido-wrap" style="display:none"><label>Apellido</label><input type="text" id="${prefix}-cliente-apellido"></div>
  <div class="form-group"><label>RUC</label><input type="text" id="${prefix}-cliente-ruc"></div>
  <div class="form-group"><label>DV</label><input type="text" id="${prefix}-cliente-dv" value="0"></div>
  <div class="form-group" id="${prefix}-cliente-doc-wrap" style="display:none"><label>N° Documento (CI)</label><input type="text" id="${prefix}-cliente-documento"></div>
  <div class="form-group" id="${prefix}-cliente-tipo-doc-wrap" style="display:none"><label>Tipo Documento</label>
    <select id="${prefix}-cliente-tipo-documento">${opts(SIFEN.tipoDocReceptor)}</select>
  </div>
  <div class="form-group"><label>Teléfono</label><input type="text" id="${prefix}-cliente-telefono"></div>
  <div class="form-group"><label>Celular</label><input type="text" id="${prefix}-cliente-celular"></div>
  <div class="form-group"><label>Email</label><input type="text" id="${prefix}-cliente-email"></div>
  <div class="form-group"><label>Dirección</label><input type="text" id="${prefix}-cliente-direccion"></div>
  <div class="form-group"><label>N° Casa</label><input type="text" id="${prefix}-cliente-numero-casa" value="0"></div>
  <div class="form-group"><label>Departamento</label><input type="text" id="${prefix}-cliente-departamento" value="1"></div>
  <div class="form-group"><label>Distrito</label><input type="text" id="${prefix}-cliente-distrito" value="1"></div>
  <div class="form-group"><label>Ciudad</label><input type="text" id="${prefix}-cliente-ciudad" value="1"></div>
  <div class="form-group"><label>País</label>
    <select id="${prefix}-cliente-pais">${optsPais()}</select>
  </div>
  <div class="form-group"><label><input type="checkbox" id="${prefix}-cliente-entidad-publica"> Entidad Pública</label></div>
</div>`
}

export function bindCliente(prefix) {
  const seg = $(`${prefix}-cliente-modo`)
  if (seg) seg.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const libre = btn.dataset.modo === 'nuevo'
      const select = $(`${prefix}-cliente-select`)
      const panel = $(`${prefix}-cliente-nuevo`)
      if (select) select.style.display = libre ? 'none' : ''
      if (panel) panel.style.display = libre ? '' : 'none'
    }
  })
  const nat = $(`${prefix}-cliente-naturaleza`)
  if (nat) nat.onchange = () => {
    const contribuyente = nat.value === '1'
    const show = id => { const el = $(id); if (el) el.style.display = contribuyente ? 'none' : '' }
    const showC = id => { const el = $(id); if (el) el.style.display = contribuyente ? '' : 'none' }
    showC(`${prefix}-cliente-nombre-razon-wrap`)
    show(`${prefix}-cliente-nombre-wrap`)
    show(`${prefix}-cliente-apellido-wrap`)
    show(`${prefix}-cliente-doc-wrap`)
    show(`${prefix}-cliente-tipo-doc-wrap`)
  }
}

// Recolecta los datos del cliente → { receptor } o { uuidPersona }
export function collectCliente(prefix) {
  const modo = $(`${prefix}-cliente-modo`)?.querySelector('button.active')?.dataset?.modo
  if (modo === 'nuevo') {
    const naturaleza = ($(`${prefix}-cliente-naturaleza`)?.value || '1')
    const ruc = ($(`${prefix}-cliente-ruc`)?.value || '').trim()
    const dv = ($(`${prefix}-cliente-dv`)?.value || '0').trim()
    const nombre = ($(`${prefix}-cliente-nombre`)?.value || '').trim()
    const apellido = ($(`${prefix}-cliente-apellido`)?.value || '').trim()
    const nombreRazon = naturaleza === '2'
      ? `${apellido}, ${nombre}`.trim().toUpperCase()
      : ($(`${prefix}-cliente-nombre-razon`)?.value || '').trim()
    const numeroDocumento = ($(`${prefix}-cliente-documento`)?.value || '').trim()
    const tipoDocumento = ($(`${prefix}-cliente-tipo-documento`)?.value || '').trim()

    if (naturaleza === '1') {
      if (!nombreRazon) throw new Error('Ingrese el nombre o razón social del cliente')
      if (!ruc) throw new Error('Ingrese el RUC del cliente')
      if (!dv) throw new Error('Ingrese el DV del cliente')
    } else {
      if (!nombre) throw new Error('Ingrese el nombre del cliente')
      if (!apellido) throw new Error('Ingrese el apellido del cliente')
      if (!numeroDocumento) throw new Error('Ingrese el número de documento del cliente')
      if (!tipoDocumento) throw new Error('Seleccione el tipo de documento del cliente')
    }

    const receptor = {
      naturaleza,
      ruc, dvRuc: dv,
      nombreRazon, nombre, apellido,
      numeroDocumento,
      tipoDocumento: naturaleza === '1' ? 1 : Number(tipoDocumento),
      telefono: ($(`${prefix}-cliente-telefono`)?.value || '').trim(),
      celular: ($(`${prefix}-cliente-celular`)?.value || '').trim(),
      email: ($(`${prefix}-cliente-email`)?.value || '').trim(),
      direccion: ($(`${prefix}-cliente-direccion`)?.value || '').trim(),
      numeroCasa: ($(`${prefix}-cliente-numero-casa`)?.value || '0').trim(),
      departamento: ($(`${prefix}-cliente-departamento`)?.value || '1').trim(),
      distrito: ($(`${prefix}-cliente-distrito`)?.value || '1').trim(),
      ciudad: ($(`${prefix}-cliente-ciudad`)?.value || '1').trim(),
      codPais: ($(`${prefix}-cliente-pais`)?.value || 'PRY'),
      esEntidadPublica: !!$(`${prefix}-cliente-entidad-publica`)?.checked,
    }
    return { receptor }
  }

  const sel = $(`${prefix}-cliente-select`)
  if (!sel || !sel.value) throw new Error('Seleccione un cliente')
  return { uuidPersona: sel.value }
}