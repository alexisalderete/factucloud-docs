// ═══════════════════════════════════════════════════════════════════════════════
//  JSON (payloads) del integrador
// ═══════════════════════════════════════════════════════════════════════════════
//  Este módulo es la ÚNICA fuente que construye los JSON que se envían al API
//  del backend. Cada función devuelve exactamente el `body` que se manda en un
//  `POST`. Si querés usar SIFEN desde tu sistema, tomá estos objetos como plantilla
//  y completalor con tus datos.
//
//  Endpoints que usa este integrador (todos con `Authorization: Bearer <API_KEY>`):
//    POST /ventas                 → Registra primero la venta (Factura tipo 1)
//    POST /de                     → Crea el Documento Electrónico (Factura, Autofactura)
//    POST /de/nota-credito        → Nota de Crédito (tipo 5)
//    POST /de/nota-debito         → Nota de Débito (tipo 6)
//    POST /nota-remision          → Nota de Remisión (tipo 7)
//    POST /xml                    → Genera y firma el XML de un documento { documentoUuid }
//    POST /xml/enviar             → Envía a SIFEN            { documentoUuid }
//    POST /xml/lote/enviar        → Envía un lote            { documentosUuids: [] }
//
//  Valores de catálogo relevantes (campo → significadorder):
//    tipoDocumento : 1=Factura 4=Autofactura 5=NC 6=ND 7=NR
//    tipoEmision   : 1=Normal 2=Contingencia
//    tipoTransaccion: 1=Venta 2=Alquiler 3=Fesiones 4=...
//    tipoImpuesto  : 1=IVA
//    presencia (indicadoresPresencias): 2=presencia de los 2 sujetos...
//    condicion     : 1=Contado / 2=Crédito
//    tipoAfectacionIva (por item):
//       1=IVA 5%  2=IVA 10%  3=Exenta  4=No gravado  5=5% parcial
//    codUnidadMedida: 77=Unidad  83=Kilogramos (catálogo SIFEN) — las unidades completas en
//                         constantes/sifen.js → SIFEN.um
// ═══════════════════════════════════════════════════════════════════════════════

// Ayuda visual: marca un JSON con el nombre de su requst
export const REQUEST = (m, u, body) => ({ method: m, url: u, body })

// Marcador usado en la vista previa cuando aún no existe un UUID de venta/DE
export const UUID_PENDING = '<uuid-que-devolverá-el-backend>'

// ──────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES (composición de campos comunes)
// ──────────────────────────────────────────────────────────────────────────────

// Contexto fiscal del girante: de qué timbrado/establecimiento/punto sale el DE.
export function buildFiscalContext({ cfg, tipoDocumento }) {
  return {
    idTimbrado: cfg.timbrado,
    idEstablecimiento: cfg.establecimiento,
    idPunto: cfg.punto,
  }
}

// Cabecera operativa común a todos los documentos (campos "De gran escala").
export function buildDEHeader(de, condicion) {
  return {
    tipoEmision: de.tipoEmision,      // 1=Normal
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,    // 1=IVA
    condicion,
    presencia: de.presencia,          // indicadoresPresencia
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1) FACTURA ELECTRÓNICA (tipo 1) — dos pasos /ventas → /de
// ═══════════════════════════════════════════════════════════════════════════════
//  La factura es el único DE que pasa por una VENTA primero: así se registra la
//  operación comercial y se calculan los montos (base, IVA, total).
//  En el paso 2 el /de solo hace referencia a la venta; no repite productos.

// Paso 1 — crear la venta
export function buildVentaBody({ cliente, items, condicion, de, empleadoId }) {
  return {
    ...cliente,                       // { receptor: {...} } o { uuidPersona }
    idEmpleado: empleadoId,           // quién factura
    items,                             // array de productos (ver buildItem)
    condicion,                         // { tipo:1, entregas:[...] } o { tipo:2, credito:{...} }
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    indicadoresPresencias: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
  }
}

// POST 2 — el documento electrónico (misma operación) que referencia la venta
export function buildDefacturaBody({ cfg, de, condicion, ventaId, empleadoId }) {
  return {
    tipoDocumento: 1,                 // 1=Factura
    idEmpleado: empleadoId,
    id_venta: ventaId,                // uuid devuelto por /ventas
    ...buildFiscalContext({ cfg }),
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    condicion: condicion.tipo,        // 1=Contado / 2=Crédito
    presencia: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
  }
}

// Un item de producto. El widget `productos` ya lo deja con la forma exacta que
// espera el backend: es un passthrough documentado.
export function buildItem(item) {
  // item = {
  //   cantidad, precioUnitario, descuentoMonto,
  //   tipoAfectacionIva,   // 1=IVA5 2=IVA10 3=Exenta 4=NoGravado 5=parcial
  //   proporcionGravada,   // 0 / 100 / proporción (afectación 4)
  //   descripcion | uuidProducto,
  //   codUnidadMedida, iva, y códigos opcionales (gtin, dncp, codigoInterno)
  // }
  return item
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON de documentos asociados (NC/ND: el DE que anula/rebate)
// ──────────────────────────────────────────────────────────────────────────────
// El widget `asociado` ya arma dos formas posibles según qué busca el usuario:
//   A) Por CDC (documento electrónico existente):
//        { tipoDocumentoTipoAsociado:1, uuidDocumentoAfectado, cdc,
//          numeroDocumentoFiscalAsociado }
//   B) Por documento IMPRESO (de un papel con timbrado):
//        { tipoDocumentoAsociado:2, timbradoImpreso, tipoDocumentoImpreso,
//          establecimientoImpreso, puntoImpreso, numeroImpreso, fechaEmisionImpreso }
//        (timbradoImpreso de exactamente 8 dígitos; fechaEmisionImpreso obligatoria)
// Pasamos el objeto tal cual: el backend ya lo entiende.
export function buildDocumentoAsociado(asoc) {
  return asoc
}

// ═══════════════════════════════════════════════════════════════════════════════
//  2) NOTA DE CRÉDITO (tipo 5) — POST /de/nota-credito
// ═══════════════════════════════════════════════════════════════════════════════
export function buildNCCreditoBody({ cfg, de, cliente, items, asoc, motivo, empleadoId }) {
  return {
    idEmpleado: empleadoId,
    ...buildFiscalContext({ cfg }),
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    condicion: 1,                       // NC siempre "contado"
    presencia: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
    motivoEmision: motivo,              // catálogo motivoNC
    documentosAsociados: [buildDocumentoAsociado(asoc)],
    items,                              // productos que se REVERTEN a la venta
    ...cliente,                         // { receptor: {...} } o { uuidPersona }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  3) NOTA DE DÉBITO (tipo 6) — POST /de/nota-debito
// ═══════════════════════════════════════════════════════════════════════════════
export function buildNDDebito({ cfg, de, cliente, items, asoc, motivo, empleadoId }) {
  return {
    idEmpleado: empleadoId,
    ...buildFiscalContext({ cfg }),
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    condicion: 1,
    presencia: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
    motivoEmision: motivo,              // catálogo motivoND
    documentosAsociados: [buildDocumentoAsociado(asoc)],
    items,
    ...cliente,                         // { receptor: {...} } o { uuidPersona }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  4) AUTOFACTURA (tipo 4) — POST /de
// ═══════════════════════════════════════════════════════════════════════════════
//  Compra a un productor (no contribuyente): el vendedor consta pero emite el comprador.
export function buildAFCuer({ cfg, de, vendedor, constancia, items, empleadoId }) {
  return {
    idEmpleado: empleadoId,
    ...buildFiscalContext({ cfg }),
    tipoDocumento: 4,                   // 4=Autofactura
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    condicion: null,
    presencia: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
    receptor: {                         // el VENDEDOR primario del productor
      nombre: vendedor.nombre, apellido: vendedor.apellido,
      nombreRazon: vendedor.nombreRazon,
      numeroDocumento: vendedor.documento, tipoDocumento: 1, naturaleza: '2',
      direccion: vendedor.direccion || 'Dir', codPais: 'PRY',
      departamento: '1', distrito: '1', ciudad: '1',
    },
    documentosAsociados: [{             // constancia del CS (dato del productor)
      tipoDocumentoAsociado: 3,          // constancia
      tipoConstancia: 1,
      numeroConstancia: constancia.numero,
      controlConstancia: constancia.control,
    }],
    items,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  5) NOTA DE REMISIÓN (tipo 7) — POST /nota-remision
// ═══════════════════════════════════════════════════════════════════════════════
//  Usa las secciones E6 (cabecera NR), E10 (transporte) y E10.1/E10.2 (locales).
export function buildNRBody({ cfg, de, cliente, items, nr, empleadoId }) {
  return {
    idEmpleado: empleadoId,
    ...buildFiscalContext({ cfg }),
    tipoEmision: de.tipoEmision,
    tipoTransaccion: de.tipoTransaccion,
    tipoImpuesto: de.tipoImpuesto,
    condicion: 1,
    presencia: de.presencia,
    emitirConCi: de.emitirConCi,
    emitirSinNombre: de.emitirSinNombre,
    motivoEmision: nr.motivoEmision,
    responsableEmision: nr.responsableEmision,
    kmEstimado: nr.kmEstimado,
    fechaEmisionFutura: nr.fechaEmisionFutura,
    items,
    transporte: nr.transporte,        // E10 tipoTransporte, modalidad, fletes...
    localSalida: nr.localSalida,        // E10.1
    localEntrega: nr.localEntrega,      // E10.2
    vehiculos: nr.vehiculos,            // E10.3
    transportista: nr.transportista,    // datos del transportista
    ...cliente,                         // { receptor: {...} } o { uuidPersona }
  }
}