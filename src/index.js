import 'dotenv/config'
import { createInterface } from 'readline'
import { stdin as input, stdout as output } from 'process'
import ApiClient from './api-client.js'
import {
  simulacionCicloCompleto,
  simulacionNotaCredito,
  simulacionNotaDebito,
  simulacionAutofactura,
  simulacionNotaRemision,
  simulacionLote,
  simulacionDiagnostico
} from './simulacion.js'

const rl = createInterface({ input, output })

function pregunta(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

function menu() {
  console.log(`\n\x1b[34m╔══════════════════════════════════════════════╗\x1b[0m`)
  console.log(`\x1b[34m║   SIMULADOR DE INTEGRACIÓN - FACTURACIÓN     ║\x1b[0m`)
  console.log(`\x1b[34m╚══════════════════════════════════════════════╝\x1b[0m`)
  console.log(`  API: ${process.env.API_URL || 'http://localhost:3000'}`)
  console.log(`  API Key: ${(process.env.API_KEY || '—').slice(0, 16)}...`)
  console.log(``)
  console.log(`  1. Diagnóstico de integración`)
  console.log(`  2. Ciclo completo de facturación`)
  console.log(`  3. Nota de Crédito (tipo 5)`)
  console.log(`  4. Nota de Débito (tipo 6)`)
  console.log(`  5. Autofactura (tipo 4)`)
  console.log(`  6. Nota de Remisión (tipo 7)`)
  console.log(`  7. Envío por lote`)
  console.log(`  8. Salir`)
  console.log(``)
}

async function main() {
  const client = new ApiClient()

  if (process.argv.includes('--auto') || process.argv.includes('-a')) {
    console.log(`Modo automático — ejecutando ciclo completo...\n`)
    try {
      let opts = {}
      const receptorIdx = process.argv.indexOf('--receptor')
      if (receptorIdx >= 0 && receptorIdx + 1 < process.argv.length) {
        opts.receptorRuc = process.argv[receptorIdx + 1]
      }
      const dataIdx = process.argv.indexOf('--receptor-data')
      if (dataIdx >= 0 && dataIdx + 6 < process.argv.length) {
        opts.receptor = {
          ruc: process.argv[dataIdx + 1],
          dvRuc: process.argv[dataIdx + 2],
          nombreRazon: process.argv[dataIdx + 3],
          direccion: process.argv[dataIdx + 4],
          email: process.argv[dataIdx + 5],
          telefono: process.argv[dataIdx + 6] || '',
          departamento: process.argv[dataIdx + 7] || '1',
          distrito: process.argv[dataIdx + 8] || '1',
          ciudad: process.argv[dataIdx + 9] || '1',
        }
      }
      await simulacionCicloCompleto(client, opts)
    } catch (e) {
      console.error(`\x1b[31mERROR: ${e.message}\x1b[0m`)
      process.exit(1)
    }
    rl.close()
    return
  }

  if (process.argv.includes('--diagnostico') || process.argv.includes('-d')) {
    await simulacionDiagnostico(client)
    rl.close()
    return
  }

  let running = true
  while (running) {
    menu()
    const op = await pregunta('  Seleccione una opción [1-5]: ')

    try {
      switch (op.trim()) {
        case '1': {
          await simulacionDiagnostico(client)
          break
        }
        case '2': {
          const modo = (await pregunta('  Receptor: (1) existente por RUC, (2) manual, Enter=primero: ')).trim()
          let opts = {}
          if (modo === '1') {
            const ruc = await pregunta('  RUC del receptor: ') || ''
            if (ruc.trim()) opts.receptorRuc = ruc.trim()
          } else if (modo === '2') {
            opts.receptor = {
              ruc: await pregunta('  RUC: ') || '99999999-0',
              dvRuc: await pregunta('  DV: ') || '0',
              nombreRazon: await pregunta('  Nombre/Razón Social: ') || 'Cliente Manual',
              direccion: await pregunta('  Dirección: ') || 'Dirección manual',
              email: await pregunta('  Email: ') || 'manual@ejemplo.com',
              telefono: await pregunta('  Teléfono: ') || '+595000000000',
              departamento: await pregunta('  Departamento (cód. SIFEN): ') || '1',
              distrito: await pregunta('  Distrito (cód. SIFEN): ') || '1',
              ciudad: await pregunta('  Ciudad (cód. SIFEN): ') || '1',
            }
          }
          const res = await simulacionCicloCompleto(client, opts)
          if (res?.uuid) {
            const nc = await pregunta('\n  ¿Desea crear una Nota de Crédito? (s/N): ')
            if (nc.toLowerCase() === 's') {
              await simulacionNotaCredito(client, res.uuid)
            }
          }
          break
        }
        case '3': {
          const cdc = await pregunta('  CDC del documento original: ')
          await simulacionNotaCredito(client, cdc.trim())
          break
        }
        case '4': {
          const cdc = await pregunta('  CDC del documento original: ')
          await simulacionNotaDebito(client, cdc.trim())
          break
        }
        case '5': {
          await simulacionAutofactura(client)
          break
        }
        case '6': {
          await simulacionNotaRemision(client)
          break
        }
        case '7': {
          const uuidsStr = await pregunta('  UUIDs separados por coma: ')
          const uuids = uuidsStr.split(',').map(s => s.trim()).filter(Boolean)
          if (uuids.length === 0) {
            console.log('  No se ingresaron UUIDs.')
            break
          }
          await simulacionLote(client, uuids)
          break
        }
        case '8': {
          running = false
          console.log('  Saliendo...')
          break
        }
        default:
          console.log('  Opción inválida.')
      }
    } catch (e) {
      console.error(`\x1b[31m  ERROR: ${e.message}\x1b[0m`)
      console.error(`  \x1b[90mRevise la conexión con la API y los datos de configuración.\x1b[0m`)
    }

    if (running && op.trim() !== '8') {
      await pregunta('\n  Presione Enter para continuar...')
    }
  }

  rl.close()
}

main().catch(e => {
  console.error(`\x1b[31mError fatal: ${e.message}\x1b[0m`)
  process.exit(1)
})
