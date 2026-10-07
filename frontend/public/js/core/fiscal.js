// ── Configuración fiscal (timbrado / establecimiento / punto) ──────────────
// Cada documento electrónico debe indicar de qué timbrado, establecimiento y
// punto de expedición sale. Usamos el primero activo de la cuenta.
import { state } from './state.js'
import { fetchJSON } from './api.js'

export async function getConfigFiscal() {
  if (state.fiscalConfig) return state.fiscalConfig
  const timb = state.timbrados[0]
  const ests = await fetchJSON('GET', `/de/timbrados/${timb.uuid_timbrado}/establecimientos`)
  const est = ests?.results?.[0]
  const pts = est ? await fetchJSON('GET', `/de/timbrados/${timb.uuid_timbrado}/establecimientos/${est.uuid}/puntos`) : null
  const pto = pts?.results?.[0]
  return (state.fiscalConfig = {
    timbrado: timb.uuid_timbrado,
    establecimiento: est?.uuid,
    punto: pto?.uuid,
  })
}