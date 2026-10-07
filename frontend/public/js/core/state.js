// ── Estado global de la aplicación ─────────────────────────────────────────
// Único lugar con la "memoria" del simulador en el navegador.
export const state = {
  apiKey: null,
  uuidEmpleado: null,
  empresas: [],
  timbrados: [],
  personas: [],
  productos: [],
  deList: [],
}

// Atajo para Document.getElementById
export const $ = id => document.getElementById(id)