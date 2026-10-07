// ── Router / Shell de la app ────────────────────────────────────────────────
// Decide: si no hay API Key muestra el login; si la hay, carga el dashboard
// con las 5 pestañas de documento + el listado de DEs.
import { state, $ } from './core/state.js'
import { loadSession, saveSession, clearSession } from './core/session.js'
import { fetchJSON } from './core/api.js'
import { esc } from './core/ui.js'
import { renderFormFactura, bindFacturaForm } from './formas/factura.js'
import { renderFormNC, bindNCForm } from './formas/notaCredito.js'
import { renderFormND, bindNDForm } from './formas/notaDebito.js'
import { renderFormAF, bindAFForm } from './formas/autofactura.js'
import { renderFormNR, bindNRForm } from './formas/notaRemision.js'
import { renderTabDE, bindDEList } from './formas/deLista.js'

export async function render() {
  loadSession()
  if (!state.apiKey) return renderLogin()
  await loadDashboard()
}

// ── Pantalla de Login (ingresar API Key) ─────────────────
function renderLogin() {
  $('app').innerHTML = `
<div id="login">
  <h1>🧾 Integración SIFEN</h1>
  <p>Simulador de facturación electrónica (API Key)</p>
  <div class="card">
    <div class="form-group">
      <label>API Key</label>
      <input type="text" id="login-apikey" placeholder="sk_live_..." autocomplete="off" style="font-family:monospace">
    </div>
    <button class="btn btn-primary" id="login-btn">Ingresar</button>
    <div class="login-error" id="login-err"></div>
  </div>
  <p class="text-muted" style="margin-top:1rem;font-size:0.85rem">
    Obtené tu API Key en el panel de administración → API Keys
  </p>
</div>`
  $('login-btn').onclick = doLogin
  $('login-apikey').onkeydown = e => { if (e.key === 'Enter') doLogin() }
}

async function doLogin() {
  const btn = $('login-btn'); const err = $('login-err')
  btn.disabled = true; err.textContent = ''
  try {
    const apiKey = $('login-apikey').value.trim()
    if (!apiKey) { err.textContent = 'Ingrese una API Key'; btn.disabled = false; return }

    state.apiKey = apiKey
    saveSession()
    // Comprobar la API Key pidiendo las empresas.
    const empresas = await fetchJSON('GET', '/empresas')
    if (!empresas) throw new Error('API Key inválida')
    await render()
  } catch (e) {
    err.textContent = e.message
    btn.disabled = false
    state.apiKey = null
    clearSession()
  }
}

// ── Dashboard ──────────────────────────────────
async function loadDashboard() {
  try {
    const [empresas, timbrados] = await Promise.all([
      fetchJSON('GET', '/empresas'),
      fetchJSON('GET', '/de/timbrados'),
    ])
    state.empresas = empresas?.results || []
    state.timbrados = timbrados?.results || []
    const uuidEmp = state.empresas[0]?.uuid || ''
    if (uuidEmp) {
      const [personas, productos, empleados] = await Promise.all([
        fetchJSON('GET', `/crm?page=1&limit=50&uuidEmpresa=${uuidEmp}`),
        fetchJSON('GET', `/productos?page=1&limit=50&uuidEmpresa=${uuidEmp}`),
        fetchJSON('GET', '/empleados?page=1&limit=1'),
      ])
      state.personas = personas?.results || []
      state.productos = productos?.results || []
      const empList = empleados?.results || empleados || []
      state.uuidEmpleado = empList[0]?.uuid || null
    }
  } catch (e) {
    console.error('Error loading data:', e)
  }
  renderDashboard()
}

function renderDashboard() {
  const empresa = state.empresas[0] || {}
  const timb = state.timbrados[0] || {}

  $('app').innerHTML = `
<div class="header">
  <div>
    <h1>🧾 ${esc(empresa.nombreRazon || empresa.razon_social || 'Sistema')}</h1>
    <div class="text-sm text-muted">API Key: ${(state.apiKey || '').slice(0, 16)}...</div>
  </div>
  <div class="user-info">
    <button class="logout" id="logout-btn">Salir</button>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="num">${state.personas.length}</div><div class="label">Clientes</div></div>
  <div class="stat"><div class="num">${state.productos.length}</div><div class="label">Productos</div></div>
  <div class="stat"><div class="num">${state.timbrados.length}</div><div class="label">Timbrados</div></div>
  <div class="stat"><div class="num">${esc(timb.numero_timbrado || '—')}</div><div class="label">N° Timbrado</div></div>
</div>

<div class="tabs" id="tabs">
  <button class="tab active" data-tab="tab-factura">Factura</button>
  <button class="tab" data-tab="tab-nc">NC</button>
  <button class="tab" data-tab="tab-nd">ND</button>
  <button class="tab" data-tab="tab-af">Autofactura</button>
  <button class="tab" data-tab="tab-nr">NR</button>
  <button class="tab" data-tab="tab-de">Documentos</button>
</div>

<div id="tab-factura" class="tab-content active">${renderFormFactura()}</div>
<div id="tab-nc" class="tab-content">${renderFormNC()}</div>
<div id="tab-nd" class="tab-content">${renderFormND()}</div>
<div id="tab-af" class="tab-content">${renderFormAF()}</div>
<div id="tab-nr" class="tab-content">${renderFormNR()}</div>
<div id="tab-de" class="tab-content">${renderTabDE()}</div>

<div id="log-area"></div>`

  $('logout-btn').onclick = () => { clearSession(); render() }

  // Cambio de pestañas
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'))
    t.classList.add('active')
    $(t.dataset.tab).classList.add('active')
  })

  // Vincular formularios
  bindFacturaForm()
  bindNCForm()
  bindNDForm()
  bindAFForm()
  bindNRForm()
  bindDEList()
}