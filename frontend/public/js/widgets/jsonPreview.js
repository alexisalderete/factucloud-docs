// ── Visor de JSON (payload) del integrador ───────────────────────────────────
// Muestra en vivo y permite copiar el JSON exacto que se enviará a cada endpoint.
// Uso:
//   renderJsonPreview('factura')              → los `<details>` del panel
//   bindJsonPreview('factura', buildRequests) → buildRequests devuelve
//     [{ method, url, body }]  (lo mismo que consume el botón "Crear DE")
import { $ } from '../core/state.js'

export function renderJsonPreview(prefix, label = 'JSON que se enviará al API') {
  return `
<div class="card preview">
  <div class="flex-between">
    <span class="text-sm" style="font-weight:600;color:var(--text2)">${label}</span>
    <div class="flex gap">
      <button class="btn btn-outline btn-sm" id="${prefix}-preview-copy">⧉ Copiar</button>
      <button class="btn btn-outline btn-sm" id="${prefix}-preview-refresh">⟳ Actualizar</button>
    </div>
  </div>
  <pre id="${prefix}-preview-pre" class="pre">Presiona "Actualizar" para ver el JSON del formulario.</pre>
</div>`
}

// `build` es la MISMA función que usa el botón de envío, para que el preview nunca
// se desincronice con lo que realmente se manda.
export function bindJsonPreview(prefix, build) {
  const pre = $(`${prefix}-preview-pre`)

  const refresh = async () => {
    try {
      const requests = await build()
      pre.textContent = requests.length
        ? requests.map(r => `${r.method} ${r.url}\n${JSON.stringify(r.body, null, 2)}`).join('\n\n')
        : '(sin requests que mostrar)'
    } catch (e) {
      pre.textContent = `⚠ Completa el formulario: ${e.message}`
    }
  }

  const copy = async () => {
    await refresh()
    const text = pre.textContent
    if (text.includes('Completa el formulario') || text.includes('sin requests')) {
      alert('Completa primero el formulario.')
      return
    }
    await navigator.clipboard.writeText(text)
    const b = $(`${prefix}-preview-copy`)
    const prev = b.textContent; b.textContent = '✓ Copiado'; setTimeout(() => b.textContent = prev, 1200)
  }

  $(`${prefix}-preview-copy`).onclick = copy
  $(`${prefix}-preview-refresh`).onclick = refresh
  refresh()
}