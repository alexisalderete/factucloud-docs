// ── Persistencia de la API Key en sessionStorage ───────────────────────────
import { state } from './state.js'

const STORAGE_KEY = 'sifen_apikey'

export function loadSession() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) state.apiKey = saved
  } catch { /* sessionStorage no disponible */ }
}

export function saveSession() {
  try {
    if (state.apiKey) sessionStorage.setItem(STORAGE_KEY, state.apiKey)
  } catch { /* sessionStorage no disponible */ }
}

export function clearSession() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  state.apiKey = null
}