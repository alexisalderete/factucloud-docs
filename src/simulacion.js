import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'descargas')

// ─────────────────────────────────────────────
//  FUNCIONES DE AYUDA (logging)
// ─────────────────────────────────────────────

function p(msg)  { console.log(`\n\x1b[36m>>> ${msg}\x1b[0m`) }
function ok(msg) { console.log(`  \x1b[32m✓ ${msg}\x1b[0m`) }
function warn(m) { console.log(`  \x1b[33m⚠ ${m}\x1b[0m`) }
function info(m) { console.log(`  \x1b[90m${m}\x1b[0m`) }

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
}

function formatoFecha() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// ─────────────────────────────────────────────
//  CONFIGURACIÓN BASE
//  Obtiene del sistema los datos necesarios
//  para emitir comprobantes electrónicos.
// ─────────────────────────────────────────────

async function getConfigBasica(client) {
  const empRes = await client.listarEmpresas()
  const empresa = empRes?.results?.[0] || empRes?.[0]
  const uuidEmpresa = empresa?.uuid || ''

  const empListRes = await client.get('/empleados?page=1&limit=1')
  const primerEmpleado = empListRes?.results?.[0] || empListRes?.[0]
  const uuidEmpleado = primerEmpleado?.uuid || ''

  const timbrados = await client.listarTimbrados()
  const t = timbrados?.results?.[0]

  const ests = await client.get(`/de/timbrados/${t.uuid_timbrado}/establecimientos`)
  const est = ests?.results?.[0]

  const pts = await client.get(`/de/timbrados/${t.uuid_timbrado}/establecimientos/${est.uuid}/puntos`)
  const pto = pts?.results?.[0]

  const prod = (await client.listarProductos(1, 1, uuidEmpresa))?.results?.[0]
  const personas = await client.listarPersonas(1, 1, uuidEmpresa)
  const pers = personas?.results?.[0]

  return { uuidEmpresa, uuidEmpleado, timbrado: t, establecimiento: est, punto: pto, producto: prod, persona: pers }
}

// ─────────────────────────────────────────────
//  RECEPTOR DESDE PERSONA DEL CRM
//  Convierte una persona del CRM al receptor
//  que espera el backend (con `naturaleza`).
//  Alineado con PersonaNormalizer: ruc sin DV
//  + dvRuc separado; no contribuyente con
//  nombre/apellido/numeroDocumento/tipoDocumento.
// ─────────────────────────────────────────────

function receptorDesdePersona(persona) {
  const base = {
    direccion: persona.direccion || 'Dirección simulada',
    email: persona.email || 'cliente@ejemplo.com',
    departamento: persona.cod_departamento || '1',
    distrito: persona.cod_distrito || '1',
    ciudad: persona.cod_ciudad || '1',
  }
  const tipo = Number(persona.tipo_documento) || 1
  if (tipo === 2) {
    const [apellido, nombre = ''] = (persona.nombre_razon || '').split(',')
    return {
      ...base,
      naturaleza: '2',
      nombre: (nombre || 'SIN').trim(),
      apellido: (apellido || 'NOMBRE').trim(),
      numeroDocumento: String(persona.ruc || '0'),
      tipoDocumento: tipo,
    }
  }
  return {
    ...base,
    naturaleza: '1',
    ruc: String(persona.ruc || '99999999'),
    dvRuc: String(persona.dv_ruc || '0'),
    nombreRazon: persona.nombre_razon || 'CLIENTE S.A.',
  }
}

// ─────────────────────────────────────────────
//  EJEMPLO 1: CICLO COMPLETO DE FACTURACIÓN
//
//  Secuencia típica de integración:
//    1. Autenticación
//    2. Obtener configuración (empresa, timbrado, prods, clientes)
//    3. Crear venta (opcional, puede emitirse DE directo)
//    4. Crear Documento Electrónico (DE)
//    5. Generar y firmar XML
//    6. Enviar a SIFEN
//    7. Descargar PDF / XML firmado
//
//  El parámetro `opciones` permite personalizar:
//    receptor       → datos manuales del receptor (se crea en CRM)
//    receptorRuc    → RUC de un receptor existente en CRM
//    generarXML     → true (default) o false
//    enviarSIFEN    → true o false (default)
//    descargarPDF   → true (default) o false
//    descargarXML   → true (default) o false
// ─────────────────────────────────────────────

export async function simulacionCicloCompleto(client, opciones = {}) {
  ensureOutputDir()

  const {
    receptor: datosReceptor,
    receptorRuc,
    receptorUuid,
    generarXML = true,
    enviarSIFEN = false,
    descargarPDF = true,
    descargarXML = true,
  } = opciones

  const inicio = Date.now()

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  CICLO COMPLETO — FACTURA ELECTRÓNICA (tipo 1)`)
  console.log(`  ${formatoFecha()}`)
  console.log(`${'═'.repeat(50)}`)

  // ── Paso 1: Datos del sistema ──────────────
  p('Paso 1/6: Datos del sistema')

  // 1a. Empresa
  const empRes = await client.listarEmpresas()
  const empresa = (empRes?.results?.[0] || empRes?.[0])
  const uuidEmpresa = empresa?.uuid || ''
  ok(`Empresa: ${empresa?.nombreRazon || empresa?.razon_social || empresa?.uuid}`)

  // 1b. Empleado
  const empListRes = await client.get('/empleados?page=1&limit=1')
  const primerEmpleado = empListRes?.results?.[0] || empListRes?.[0]
  const uuidEmpleado = primerEmpleado?.uuid || ''
  ok(`Empleado: ${primerEmpleado?.nombre || primerEmpleado?.apellido || uuidEmpleado || 'N/A'}`)

  // ── Paso 2: Configuración fiscal ────────────
  p('Paso 2/6: Configuración fiscal')

  // 2b. Timbrado
  const timbrados = await client.listarTimbrados()
  const timbrado = timbrados?.results?.[0]
  if (!timbrado) throw new Error('No hay timbrados activos — Configure uno desde el panel.')
  ok(`Timbrado: ${timbrado.numero_timbrado || timbrado.uuid_timbrado}`)

  // 2c. Establecimiento y punto de expedición
  const ests = await client.get(`/de/timbrados/${timbrado.uuid_timbrado}/establecimientos`)
  const estab = ests?.results?.[0]
  if (!estab) throw new Error('No hay establecimientos.')
  ok(`Establecimiento: ${estab.codigo || estab.uuid}`)

  const pts = await client.get(`/de/timbrados/${timbrado.uuid_timbrado}/establecimientos/${estab.uuid}/puntos`)
  const punto = pts?.results?.[0]
  ok(`Punto expedición: ${punto?.codigo || '001'}`)

  // 2d. Productos
  const prodRes = await client.listarProductos(1, 1, uuidEmpresa)
  const producto = prodRes?.results?.[0]

  // 2e. Personas (clientes)
  const persRes = await client.listarPersonas(1, 50, uuidEmpresa)
  let personaList = persRes?.results || []
  ok(`${personaList.length} cliente(s) disponible(s)`)

  // ── Selección del receptor ──────────────────
  // Prioridad:
  //   1. Si se pasan datos manuales → crear persona en CRM
  //   2. Si se pasa un RUC → buscar en CRM
  //   3. Si se pasa un UUID → buscar en CRM
  //   4. Si no → usar el primer cliente disponible

  if (datosReceptor) {
    // Opción A: Receptor con datos ingresados manualmente
    const creada = await client.crearPersona({
      uuidEmpresa,
      nombreRazon: datosReceptor.nombreRazon,
      ruc: datosReceptor.ruc,
      dv: datosReceptor.dvRuc || '0',
      codPais: datosReceptor.codPais || 'PRY',
      direccion: datosReceptor.direccion || '',
      email: datosReceptor.email || '',
      telefono: datosReceptor.telefono || '',
      departamento: datosReceptor.departamento || '1',
      distrito: datosReceptor.distrito || '1',
      ciudad: datosReceptor.ciudad || '1',
    })
    const uuidCreada = creada?.uuid
    if (uuidCreada) {
      personaList = [{ uuid: uuidCreada, ...datosReceptor }]
      info(`Receptor creado en CRM: ${datosReceptor.nombreRazon} (${datosReceptor.ruc}-${datosReceptor.dvRuc || '0'})`)
    } else {
      throw new Error('No se pudo crear el receptor en CRM.')
    }

  } else if (receptorRuc) {
    // Opción B: Buscar receptor por RUC en CRM
    const match = personaList.find(p =>
      `${p.ruc}-${p.dv_ruc}` === receptorRuc || p.ruc === receptorRuc
    )
    if (match) {
      personaList = [match]
      info(`Receptor encontrado por RUC: ${receptorRuc}`)
    } else {
      warn(`RUC "${receptorRuc}" no encontrado — se usará el primer cliente disponible.`)
    }

  } else if (receptorUuid) {
    // Opción C: Buscar receptor por UUID en CRM
    const match = personaList.find(p => p.uuid === receptorUuid)
    if (match) {
      personaList = [match]
      info(`Receptor encontrado por UUID`)
    } else {
      warn(`UUID "${receptorUuid}" no encontrado — se usará el primer cliente disponible.`)
    }
  }

  const persona = personaList[0] || { uuid: null, nombreRazon: 'Cliente Simulado', ruc: '99999999-0' }
  // ── Fin selección receptor ──────────────────

  // ── Paso 3: Crear venta ─────────────────────
  // La venta es el registro comercial interno.
  // El DE se vincula a una venta existente.
  p('Paso 3/6: Creando venta')
  if (!producto) {
    // Crear producto si no existe ninguno
    const nuevo = await client.post('/productos', {
      uuidEmpresa,
      codigoInterno: 'PROD-EJEMPLO-001',
      descripcion: 'Producto de ejemplo',
      precioUnitario: 100000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      stock: 100,
    })
    const prods = [nuevo]
    producto = prods[0]
  }

  const ventaRes = await client.crearVenta({
    uuidPersona: persona.uuid,
    idEmpleado: uuidEmpleado,
    items: [{
      uuidProducto: producto.uuid,
      cantidad: 2,
      precioUnitario: 100000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      proporcionGravada: 100,
    }],
    condicion: {
      tipo: 1, // 1=Contado, 2=Crédito
      entregas: [{ tipo: '1', monto: 200000, moneda: 'PYG' }],
    },
    observacion: 'Venta generada por simulador',
  })

  const venta = ventaRes?.venta || ventaRes?.data || ventaRes
  const idVenta = venta?.uuid || venta?.id_venta
  ok(`Venta creada: ${idVenta}`)
  info(`  Total: Gs. ${(venta?.monto_total || 200000).toLocaleString('es-PY')}`)

  // ── Paso 4: Crear Documento Electrónico ─────
  p('Paso 4/6: Creando Documento Electrónico (DE)')
  const deCreado = await client.crearDE({
    tipoDocumento: 1,              // 1=Factura, 4=Autofactura, 5=NC, 6=ND, 7=NR
    idEmpleado: uuidEmpleado,
    id_venta: idVenta,
    idTimbrado: timbrado.uuid_timbrado,
    idEstablecimiento: estab.uuid,
    idPunto: punto?.uuid || 1,
    tipoEmision: 1,                // 1=Normal
    tipoTransaccion: 1,            // 1=Venta
    tipoImpuesto: 1,               // 1=IVA
    condicion: 1,                  // 1=Contado
    presencia: 1,                  // 1=Presencial
  })

  const uuidDE = deCreado?.uuid || deCreado?.data?.uuid
  if (!uuidDE) throw new Error('No se obtuvo UUID del DE')
  ok(`DE creado: ${uuidDE}`)

  // ── Paso 5: Generar y firmar XML ────────────
  if (generarXML) {
    p('Paso 5/6: Generando XML')
    await client.generarXML(uuidDE)
    ok('XML generado y firmado correctamente')

    // ── Paso 6: Enviar a SIFEN ──────────────────
    if (enviarSIFEN) {
      p('Paso 6/6: Enviando a SIFEN')
      try {
        const envio = await client.enviarSIFEN(uuidDE)
        const estado = envio?.estado_sifen || envio?.estado || 'ENVIADO'
        ok(`Resultado SIFEN: ${estado}`)
        if (estado === 'APROBADO') {
          ok('Documento aprobado por SET')
        } else {
          info(`Estado: ${estado} — revisar en el panel`)
        }
      } catch (e) {
        warn(`Error al enviar a SIFEN: ${e.message}`)
        info('  El ambiente de pruebas SET puede no estar disponible.')
      }
    }

    // Descargar PDF
    if (descargarPDF) {
      try {
        const pdfPath = join(OUTPUT_DIR, `factura_${uuidDE.slice(0, 8)}.pdf`)
        await client.descargarPDF(uuidDE, 'normal', pdfPath)
        ok(`PDF descargado: ${pdfPath}`)
      } catch (e) {
        warn(`No se pudo descargar PDF: ${e.message}`)
      }
    }

    // Descargar XML firmado
    if (descargarXML) {
      try {
        const xmlPath = join(OUTPUT_DIR, `factura_${uuidDE.slice(0, 8)}.xml`)
        await client.descargarXML(uuidDE, xmlPath)
        ok(`XML descargado: ${xmlPath}`)
      } catch (e) {
        warn(`No se pudo descargar XML: ${e.message}`)
      }
    }
  }

  // ── Resumen final ─────────────────────────
  const elapsed = ((Date.now() - inicio) / 1000).toFixed(1)
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  SIMULACIÓN COMPLETADA en ${elapsed}s`)
  console.log(`  Documento: ${uuidDE}`)
  console.log(`  Archivos en: ${OUTPUT_DIR}`)
  console.log(`${'═'.repeat(50)}\n`)

  return { de: deCreado, uuid: uuidDE }
}

// ─────────────────────────────────────────────
//  EJEMPLO 2: NOTA DE CRÉDITO (tipo 5)
//
//  Requiere el CDC de una factura existente.
//  La NC anula total o parcialmente una factura.
// ─────────────────────────────────────────────

export async function simulacionNotaCredito(client, cdcOrigen) {
  ensureOutputDir()
  const config = await getConfigBasica(client)
  if (!config.producto) throw new Error('Se requiere al menos un producto')

  // Buscar el DE original por su CDC para obtener el UUID
  const deOrig = (await client.listarDEs(1, 10, { search: cdcOrigen }))?.results?.[0]
  const uuidOrigen = deOrig?.uuid
  if (!uuidOrigen) throw new Error(`No se encontró DE con CDC ${cdcOrigen}`)

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  NOTA DE CRÉDITO (tipo 5)`)
  console.log(`${'═'.repeat(50)}`)

  p('Creando Nota de Crédito')
  const ncRes = await client.crearNotaCredito({
    idEmpleado: config.uuidEmpleado,
    idTimbrado: config.timbrado.uuid_timbrado,
    idEstablecimiento: config.establecimiento.uuid,
    idPunto: config.punto.uuid,
    tipoEmision: 1,
    tipoTransaccion: 1,
    tipoImpuesto: 1,
    condicion: 1,
    presencia: 1,
    motivoEmision: 1,
receptor: receptorDesdePersona(config.persona),
    documentosAsociados: [{
      tipoDocumentoAsociado: 1,
      uuidDocumentoAfectado: uuidOrigen,
      cdc: cdcOrigen,
      numeroDocumentoFiscalAsociado: '001-001-0000001',
    }],
    items: [{
      uuidProducto: config.producto.uuid,
      cantidad: 1,
      precioUnitario: 50000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      proporcionGravada: 100,
    }],
  })

  const uuidNC = ncRes?.uuid || ncRes?.data?.uuid
  ok(`NC creada: ${uuidNC}`)

  p('Generando XML')
  try {
    await client.generarXML(uuidNC)
    ok('XML generado y firmado')
  } catch (e) {
    warn(`Error generando XML: ${e.message}`)
    info('  Verifique configuración de la empresa (certificado, actividades económicas).')
  }

  return { uuid: uuidNC }
}

// ─────────────────────────────────────────────
//  EJEMPLO 3: NOTA DE DÉBITO (tipo 6)
//
//  Similar a NC pero incrementa el monto
//  de la factura original.
// ─────────────────────────────────────────────

export async function simulacionNotaDebito(client, cdcOrigen) {
  ensureOutputDir()
  const config = await getConfigBasica(client)
  if (!config.producto) throw new Error('Se requiere al menos un producto')

  const deOrig = (await client.listarDEs(1, 10, { search: cdcOrigen }))?.results?.[0]
  const uuidOrigen = deOrig?.uuid
  if (!uuidOrigen) throw new Error(`No se encontró DE con CDC ${cdcOrigen}`)

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  NOTA DE DÉBITO (tipo 6)`)
  console.log(`${'═'.repeat(50)}`)

  p('Creando Nota de Débito')
  const ndRes = await client.crearNotaDebito({
    idEmpleado: config.uuidEmpleado,
    idTimbrado: config.timbrado.uuid_timbrado,
    idEstablecimiento: config.establecimiento.uuid,
    idPunto: config.punto.uuid,
    tipoEmision: 1,
    tipoTransaccion: 1,
    tipoImpuesto: 1,
    condicion: 1,
    presencia: 1,
    motivoEmision: 1,
    receptor: receptorDesdePersona(config.persona),
    documentosAsociados: [{
      tipoDocumentoAsociado: 1,
      uuidDocumentoAfectado: uuidOrigen,
      cdc: cdcOrigen,
      numeroDocumentoFiscalAsociado: '001-001-0000001',
    }],
    items: [{
      uuidProducto: config.producto.uuid,
      cantidad: 1,
      precioUnitario: 50000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      proporcionGravada: 100,
    }],
  })

  const uuidND = ndRes?.uuid || ndRes?.data?.uuid
  ok(`ND creada: ${uuidND}`)

  p('Generando XML')
  try {
    await client.generarXML(uuidND)
    ok('XML generado y firmado')
  } catch (e) {
    warn(`Error generando XML: ${e.message}`)
  }

  return { uuid: uuidND }
}

// ─────────────────────────────────────────────
//  EJEMPLO 4: AUTOFACTURA (tipo 4)
//
//  Emitida por un contribuyente que compra
//  a un productor no registrado (agricultor,
//  microproductor). El receptor (gDatRec) es
//  la propia empresa. Los datos del vendedor
//  se envían en la sección autoFactura.
// ─────────────────────────────────────────────

export async function simulacionAutofactura(client) {
  ensureOutputDir()
  const config = await getConfigBasica(client)
  if (!config.producto) throw new Error('Se requiere al menos un producto')

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  AUTOFACTURA (tipo 4)`)
  console.log(`${'═'.repeat(50)}`)

  p('Creando Autofactura')
  const afRes = await client.crearDE({
    idEmpleado: config.uuidEmpleado,
    idTimbrado: config.timbrado.uuid_timbrado,
    idEstablecimiento: config.establecimiento.uuid,
    idPunto: config.punto.uuid,
    tipoDocumento: 4,
    tipoEmision: 1,
    tipoTransaccion: 1,
    tipoImpuesto: 1,
    condicion: null,
    presencia: 1,
    // Datos del vendedor (productor no contribuyente)
    receptor: {
      nombre: 'JUAN',
      apellido: 'PEREZ',
      nombreRazon: 'PEREZ, JUAN',
      numeroDocumento: '1234567',
      tipoDocumento: 1,  // 1=CI
      naturaleza: '2',
      direccion: 'dir',
      codPais: 'PRY',
      departamento: '1',
      distrito: '1',
      ciudad: '1',
    },
    // Constancia de compra (obligatoria para AF)
    documentosAsociados: [{
      tipoDocumentoAsociado: 3,   // 3=Constancia
      tipoConstancia: 1,
      numeroConstancia: '00000000001',  // 11 dígitos
      controlConstancia: 'ABC12345',    // 8 caracteres
    }],
    items: [{
      uuidProducto: config.producto.uuid,
      cantidad: 1,
      precioUnitario: 30000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      proporcionGravada: 100,
    }],
  })

  const uuidAF = afRes?.uuid || afRes?.data?.uuid
  ok(`Autofactura creada: ${uuidAF}`)

  p('Generando XML')
  try {
    await client.generarXML(uuidAF)
    ok('XML generado y firmado')
  } catch (e) {
    warn(`Error generando XML: ${e.message}`)
  }

  return { uuid: uuidAF }
}

// ─────────────────────────────────────────────
//  EJEMPLO 5: NOTA DE REMISIÓN (tipo 7)
//
//  Documento de transporte. Requiere datos
//  del vehículo, transportista, y lugares
//  de salida y entrega.
// ─────────────────────────────────────────────

export async function simulacionNotaRemision(client) {
  ensureOutputDir()
  const config = await getConfigBasica(client)
  if (!config.producto) throw new Error('Se requiere al menos un producto')

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  NOTA DE REMISIÓN (tipo 7)`)
  console.log(`${'═'.repeat(50)}`)

  p('Creando Nota de Remisión')
  const nrRes = await client.post('/nota-remision', {
    idEmpleado: config.uuidEmpleado,
    idTimbrado: config.timbrado.uuid_timbrado,
    idEstablecimiento: config.establecimiento.uuid,
    idPunto: config.punto.uuid,
    tipoEmision: 1,
    tipoTransaccion: 1,
    tipoImpuesto: 1,
    condicion: 1,
    presencia: 1,
    motivoEmision: 1,
    responsableEmision: 1,
    kmEstimado: 100,
    receptor: receptorDesdePersona(config.persona),
    items: [{
      uuidProducto: config.producto.uuid,
      descripcion: 'Item NR',
      cantidad: 5,
      precioUnitario: 10000,
      codUnidadMedida: '77',
      iva: 10,
      tipoAfectacionIva: 1,
      proporcionGravada: 100,
    }],
    transporte: {
      tipoTransporte: 1,     // 1=Terrestre
      modalidadTraslado: 1,  // 1=Propio
      responsableFlete: 1,
      fechaInicioTraslado: new Date().toISOString().slice(0, 10),
      fechaFinTraslado: new Date().toISOString().slice(0, 10),
    },
    localSalida: {
      direccion: 'SALIDA',
      numeroCasa: '0',
      codDepartamento: '1',
      desDepartamento: 'CAPITAL',
      codCiudad: '1',
      desCiudad: 'ASUNCION',
    },
    localEntrega: {
      direccion: 'LLEGADA',
      numeroCasa: '0',
      codDepartamento: '1',
      desDepartamento: 'CAPITAL',
      codCiudad: '1',
      desCiudad: 'ASUNCION',
    },
    vehiculos: [{
      tipoVehiculo: 'CAMION',  // texto 4-10 caracteres
      marca: 'TOYOTA',
      tipoIdentificacion: 1,
      numeroIdentificacion: 'ABC123',
    }],
    transportista: {
      naturaleza: 1,
      nombreRazon: 'TRANSPORTISTA SA',
      ruc: '80000000',
      dvRuc: '0',
      codPais: 'PRY',
      direccion: 'Av. Transporte 456',
      nombreChofer: 'JUAN PEREZ',
      documentoChofer: '1234567',
      tipoDocumentoChofer: 1,
      direccionChofer: 'Calle del Chofer 789',
    },
  })

  const uuidNR = nrRes?.uuid || nrRes?.data?.uuid
  ok(`NR creada: ${uuidNR}`)

  p('Generando XML')
  try {
    await client.generarXML(uuidNR)
    ok('XML generado y firmado')
  } catch (e) {
    warn(`Error generando XML: ${e.message}`)
  }

  return { uuid: uuidNR }
}

// ─────────────────────────────────────────────
//  EJEMPLO 6: ENVÍO POR LOTE
//
//  Envía múltiples DEs a SIFEN en una
//  sola operación.
// ─────────────────────────────────────────────

export async function simulacionLote(client, uuids) {
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  ENVÍO POR LOTE (${uuids.length} documento(s))`)
  console.log(`${'═'.repeat(50)}`)

  for (const uuid of uuids) {
    p(`Procesando: ${uuid}`)
    try {
      await client.generarXML(uuid)
      ok('XML generado')

      await client.enviarSIFEN(uuid)
      ok('Enviado a SIFEN')
    } catch (e) {
      warn(`Error: ${e.message}`)
    }
  }
}

// ─────────────────────────────────────────────
//  EJEMPLO 7: DIAGNÓSTICO
//
//  Verifica conectividad y configuración
//  del sistema.
// ─────────────────────────────────────────────

export async function simulacionDiagnostico(client) {
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  DIAGNÓSTICO DE INTEGRACIÓN`)
  console.log(`${'═'.repeat(50)}`)

  p('Verificando conectividad')
  const alive = await client.health()
  if (!alive) {
    warn(`API no responde en ${client.baseUrl}`)
    console.log('\n  Verifique que el backend esté corriendo:')
    console.log(`  cd sistema-facturacion-backend && npm run dev`)
    return false
  }
  ok(`API reachable en ${client.baseUrl}`)

  p('Autenticando')
  try {
    ok(`Usando API Key: ${client.apiKey?.slice(0, 16)}...`)

    const empresas = await client.listarEmpresas()
    const empList = Array.isArray(empresas) ? empresas : empresas?.results || empresas?.data || []
    ok(`${empList.length} empresa(s) configurada(s)`)

    if (empList.length > 0) {
      const e = empList[0]
      const timbrados = await client.listarTimbrados(e.uuid || e.id_empresa)
      const tList = Array.isArray(timbrados) ? timbrados : timbrados?.results || []
      ok(`${tList.length} timbrado(s)`)
      tList.forEach(t => info(`  Timbrado ${t.numero_timbrado} (${t.estado || 'activo'})`))
    }

    return { loginData: null, empresas: empList }
  } catch (e) {
    warn(`Error en diagnóstico: ${e.message}`)
    return false
  }
}
