# Documentación de Integración SaaS - Facturación Electrónica SIFEN

Esta guía detalla cómo un sistema externo puede interactuar con nuestra API para generar
facturas electrónicas válidas en la SIFEN (Paraguay) sin necesidad de manejar criptografía ni XML.

El código de ejemplo está en [`src/simulacion.js`](src/simulacion.js).

> Existen **dos simuladores**: el **CLI** en `src/` (abajo) y el **Simulador Web**
> en `frontend/public` que muestra en vivo y permite copiar el **JSON exacto de cada
> documento**. Los payloads completos (Factura, Autofactura, NC, ND, NR) se documentan
> en este README; la única fuente de verdad de los JSON es
> [`frontend/public/js/core/payload.js`](frontend/public/js/core/payload.js).

---

## 1. Autenticación

### 1.1 API Key (para integración externa)

Todas las peticiones a la API externa deben incluir tu **API Key** en el header `Authorization`.
Puedes generar una desde el panel de administración del sistema en
**Menú lateral → Configuración → Integraciones → botón "Nueva API Key"**:

![Nueva API Key](img/Captura%20de%20pantalla%202026-08-10%20162628.png)

```
POST /api/v1/ventas
Authorization: Bearer sk_live_XXXXXXXXXXXXXXXXXXXXXX
Content-Type: application/json
```

Las rutas externas se montan bajo el prefijo `/api/v1` y utilizan exclusivamente API Key.

### 1.2 JWT (para integración interna / frontend)

Si consumes la API desde el mismo frontend o desde un sistema interno autorizado,
usa autenticación JWT:

```
POST /ventas
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

El token se obtiene mediante:

```
POST /auth/login
{
  "username": "mi_usuario",
  "password": "mi_contraseña"
}
```

Respuesta:
```json
{
  "message": "Inicio de sesión exitoso",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "uuid": "...",
    "username": "mi_usuario",
    "uuidEmpresa": "...",
    "uuidEmpleado": "...",
    "uuidRol": "...",
    "nombreRol": "Administrador",
    "permisos": ["ventas:crear", "ventas:ver", ...]
  }
}
```

> ⚠️ **Importante**: Todos los endpoints protegidos verifican permisos por rol.
> Si tu usuario no tiene el permiso requerido recibirás un `403 Forbidden`.

---

## 2. Gestión de Ventas y Factura Electrónica

Flujo recomendado:

1. Registrar/verificar el **cliente** (`POST /crm`)
2. Registrar/verificar el **producto** (`POST /productos`)
3. Crear la **venta** (`POST /ventas` o `POST /api/v1/ventas`)
4. Crear el **Documento Electrónico** (`POST /de` o `POST /api/v1/de`)
5. **Generar y firmar XML** (`POST /xml`)
6. **Enviar a SIFEN** (`POST /xml/enviar`)
7. Consultar estado (`GET /de/documentos/:id`)

### 2.1 Crear Cliente

```
POST /crm
Authorization: Bearer <token>
```

Envía el JSON **según el tipo de persona**. El backend lo deduce de **los campos que envías** (no existe un flag de "jurídica/física"; en el frontend ese selector aparece deshabilitado porque se infiere del RUC).

**Persona física y no contribuyente** cargan `nombre`/`apellido` de forma interna (no los envías sueltos excepto en el caso no contribuyente, donde sí son datos de entrada).

#### a) Persona Jurídica (`naturaleza` = contribuyente, RUC ≥ 80.000.000)

Envía solo `ruc`, `dv`, `nombreRazon` y los datos de contacto. `nombre`/`apellido` se guardan como `null`.

```json
{
  "nombreRazon": "CLIENTE SIMULADO S.A.",
  "ruc": "80000000",
  "dv": "0",
  "direccion": "Av. Principal 123",
  "numeroCasa": "123",
  "email": "cliente@empresa.com",
  "telefono": "+595211234567",
  "celular": "+595981123456",
  "codPais": "PRY",
  "departamento": "1",
  "distrito": "1",
  "ciudad": "1",
  "esEntidadPublica": false
}
```

#### b) Persona Física (contribuyente, RUC < 80.000.000)

Envía `nombreRazon` en formato `"APELLIDO, NOMBRE"`. El backend separa `nombre` y `apellido` internamente.

```json
{
  "nombreRazon": "PEREZ, JUAN",
  "ruc": "625205",
  "dv": "5",
  "direccion": "Av. Principal 456",
  "numeroCasa": "50",
  "email": "juan@empresa.com",
  "telefono": "+595211234567",
  "celular": "+595981123456",
  "codPais": "PRY",
  "departamento": "1",
  "distrito": "1",
  "ciudad": "1",
  "esEntidadPublica": false
}
```

#### c) No contribuyente (sin RUC)

Envía `nombre` + `apellido` + `numeroDocumentoIdentidad` + `tipoDocumento` (no `ruc`/`dv`). La razón social se forma internamente.

```json
{
  "nombre": "JUAN CARLOS",
  "apellido": "PEREZ",
  "numeroDocumentoIdentidad": "1234567",
  "tipoDocumento": 1,
  "direccion": "Calle 789",
  "numeroCasa": "12",
  "email": "juancarlos@mail.com",
  "telefono": "+595213331234",
  "celular": "+595981123456",
  "codPais": "PRY",
  "departamento": "1",
  "distrito": "1",
  "ciudad": "1",
  "esEntidadPublica": false
}
```

**Respuesta:**
```json
{
  "uuid": "uuid-del-cliente-creado"
}
```

**Campos (`POST /crm`):** tipo de dato y obligatoriedad según el tipo de persona. `●` = obligatorio, `○` = opcional, `–` = no aplica (no enviar).

| Campo | Tipo | Jurídica | Física contrib. | No contribuyente |
|---|---|---|---|---|
| `nombreRazon` | string | ● | ● (`"APELLIDO, NOMBRE"`) | – |
| `ruc` | string | ● (≥ 8 díg) | ● | – |
| `dv` | string (1 díg) | ● | ○ (se autocalcula) | – |
| `nombre` | string | – | – | ● |
| `apellido` | string | – | – | ● |
| `numeroDocumentoIdentidad` | string | – | – | ● |
| `tipoDocumento` | number | – | – | ● |
| `direccion` | string (5-255) | ○ | ○ | ○ |
| `numeroCasa` | string (1-6 díg) | ○ | ○ | ○ |
| `email` | string | ○ | ○ | ○ |
| `telefono` | string (`+595...`) | ○ | ○ | ○ |
| `celular` | string (`+595...`) | ○ | ○ | ○ |
| `codPais` | string (ISO) | ● | ● | ● |
| `departamento` | string (código SIFEN) | ● (si PRY + dirección) | ● (si PRY + dirección) | ● (si PRY + dirección) |
| `distrito` | string (código SIFEN) | ● (si PRY + dirección) | ● (si PRY + dirección) | ● (si PRY + dirección) |
| `ciudad` | string (código SIFEN) | ● (si PRY + dirección) | ● (si PRY + dirección) | ● (si PRY + dirección) |
| `esEntidadPublica` | boolean | ○ | ○ | ○ |

> **País y ubicación (`/crm`):**
> - `codPais` es **obligatorio** (400 si falta). No hay valor por defecto en el backend:
>   enviá siempre `"PRY"` (o el ISO del país).
> - Si `codPais = "PRY"` **y** se envía `direccion`, entonces `departamento`,
>   `distrito` y `ciudad` son **obligatorios** (400 si faltan). Sin dirección, no se exigen.
> - Si `codPais ≠ "PRY"` (extranjero), el backend **limpia** departamento/distrito/ciudad
>   (se guardan `null`): no los envíes.
> - Esta regla coincide con la librería SIFEN: el XML solo exige geografía cuando el
>   receptor tiene dirección.

> Campos `nombre`/`apellido`:
> - **Jurídica**: no se envían (internamente `null`).
> - **Física contribuyente**: se derivan de `nombreRazon` (`"APELLIDO, NOMBRE"`)
>   **o** se toman tal cual de los campos `nombre`/`apellido` (se envían explícitos).
> - **No contribuyente**: son obligatorios y se envían tal cual.
>
> `departamento`, `distrito` y `ciudad` se almacenan como códigos SIFEN (numéricos). Formatos validados: `telefono`/`celular` como `+código` (ej. `+595...`), `email` válido, `numeroCasa` numérico (máx 6 dígitos).
>
> `nombreRazon` se compara **sin distinción de mayúsculas/minúsculas**: si la base
> tiene `"jimenez, alejandro"` y enviás `"JIMENEZ, ALEJANDRO"` en los campos
> `nombre`/`apellido`, se acepta y normaliza a mayúsculas (no hay error por "no coincide").

### 2.2 Crear Producto

```
POST /productos
```

**Payload:**

```json
{
  "uuidEmpresa": "uuid-de-tu-empresa",
  "codigoInterno": "PROD-001",
  "descripcion": "PRODUCTO DE PRUEBA",
  "precioUnitario": 100000,
  "codUnidadMedida": "77",
  "tasaIva": 10,
  "tipoAfectacionIva": "1",
  "stockActual": "100"
}
```

**Respuesta:**
```json
{
  "uuid": "uuid-del-producto-creado"
}
```

**Campos (`POST /productos`):** `●` = obligatorio, `○` = opcional.

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `uuidEmpresa` | string (UUID) | ○ | UUID de la empresa (alternativa a `idEmpresa`) |
| `descripcion` | string (≤ 120) | ● | Descripción del producto (se guarda en mayúsculas) |
| `codUnidadMedida` | string | ● | Código SIFEN: `"77"`=Unidad, `"83"`=Kilogramos |
| `precioUnitario` | number | ● | Hasta 15 enteros + 8 decimales, positivo |
| `tasaIva` | number | ○ | Tasa de IVA: `0`, `5` o `10` |
| `tipoAfectacionIva` | string | ○ | `"1"`=Gravado, `"2"`=Exonerado, `"3"`=Exento. Si es `"1"` fuerza `proporcionGravada=100`; si `"2"`/`"3"` fuerza `0` |
| `proporcionGravada` | string | ○ | Solo obligatorio si `tipoAfectacionIva` es `"4"` (parcial): valor `0 < x < 100`. Con `"1"`/`"2"`/`"3"` no la envíes (se calcula sola) |
| `descuentoMonto` | string | ○ | **Debe ser string** (ej. `"0"`); un número crashea el backend. Menor al precio; hasta 15 enteros + 8 decimales |
| `stockActual` | string | ● | **Debe ser string** (ej. `"50"`); un número crashea el backend. **Obligatorio para facturar** si `controlaStock` queda `true` (default): sin stock la venta falla con "Stock insuficiente". Hasta 10 enteros + 4 decimales |
| `stockMinimo` | number | ○ | Stock mínimo de alerta |
| `controlaStock` | boolean | ○ | Default `true`. Si queda `true`, la venta valida stock (requiere `stockActual`). Pon `false` para vender sin control de stock |
| `codigoInterno` | string (≤ 20) | ○ | Código interno; debe ser único por empresa |
| `codigoDncpGeneral` / `codigoDncpEspecifico` | string | ○ | Clasificación DNCP. Límites: general ≤ 8, específico ≤ 4 caracteres |
| `gtinProducto` / `gtinPaquete` | string | ○ | Código de barras GTIN (≤ 14 caracteres) |


### 2.3 Crear Venta

```
POST /ventas
Authorization: Bearer <token>
```

**Payload:**

```json
{
  "uuidPersona": "uuid-del-cliente",
  "idEmpleado": "uuid-del-empleado-o-cajero",
  "receptor": {
    "naturaleza": "1",
    "nombreRazon": "CLIENTE SIMULADO S.A.",
    "ruc": "80000000",
    "dvRuc": "0",
    "direccion": "Av. Principal 123",
    "numeroCasa": "123",
    "telefono": "0981123456",
    "celular": "0981123456",
    "email": "cliente@empresa.com",
    "codPais": "PRY",
    "departamento": "1",
    "distrito": "1",
    "ciudad": "1",
    "esEntidadPublica": false
  },
  "condicion": {
    "tipo": 1,
    "entregas": [
      {
        "tipo": "1",
        "monto": 200000,
        "moneda": "PYG"
      }
    ]
  },
  "items": [
    {
      "uuidProducto": "uuid-del-producto",
      "descripcion": "Producto de Prueba",
      "cantidad": 2,
      "precioUnitario": 100000,
      "descuentoMonto": 0,
      "codUnidadMedida": "77",
      "iva": 10,
      "tipoAfectacionIva": 1,
      "proporcionGravada": 100
    }
  ],
  "tipoEmision": 1,
  "indicadoresPresencias": 2,
  "emitirConCi": false,
  "emitirSinNombre": false,
  "observacion": "Venta generada desde integración externa"
}
```

**Campos (`POST /ventas`):** `●` = obligatorio, `○` = opcional, `–` = no aplica (no enviar).

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `uuidPersona` | string (UUID) | ○ | UUID del cliente (alternativo a `receptor`) |
| `idEmpleado` | string (UUID) | ● | UUID del empleado que registra la venta |
| `receptor` | object | ○ | Obligatorio si no usás `uuidPersona` ni `emitirSinNombre` |
| `receptor.naturaleza` | string | ● | `"1"` = Contribuyente, `"2"` = No contribuyente |
| `receptor.nombreRazon` | string | ○ (física: `nombreRazon` **o** `nombre`+`apellido`) / ● (jurídica) / – (no contrib.) | Jurídica: razón social. Física: `"APELLIDO, NOMBRE"` o campos separados (`nombre`+`apellido`); si van ambos deben coincidir |
| `receptor.ruc` | string | ● (contrib.) / – | RUC sin DV; ≥ 80.000.000 = jurídica |
| `receptor.dvRuc` | string | ● (contrib.) / – | Dígito verificador del RUC |
| `receptor.nombre` | string | ● (no contrib.) / ○ (física) / – (jurídica) | Nombre del receptor |
| `receptor.apellido` | string | ● (no contrib.) / ○ (física) / – (jurídica) | Apellido del receptor |
| `receptor.numeroDocumento` | string | ● (no contrib.) / – | CI/Pasaporte |
| `receptor.tipoDocumento` | number | ● (no contrib.) / – | 1=CI, 2=Pasaporte, 3=CI Extranjera |
| `receptor.direccion` | string | ○ | Dirección del receptor. Si se envía, exige `numeroCasa` |
| `receptor.numeroCasa` | string | ● (si hay dirección) | N° casa, numérico (máx 6 díg) |
| `receptor.email` | string | ○ | Email válido |
| `receptor.telefono` / `celular` | string | ○ | Teléfono 6-15 dígitos; celular 10-20 dígitos |
| `receptor.codPais` | string | ○ | ISO (por defecto `PRY`) |
| `receptor.departamento` / `distrito` / `ciudad` | string | ● | **Códigos SIFEN numéricos** (NO nombres: "Central"/"Asunción" fallan). Obligatorios para el XML en factura normal |
| `receptor.esEntidadPublica` | boolean | ○ | Default `false` |
| `condicion.tipo` | number | ● | 1=Contado, 2=Crédito |
| `condicion.entregas[].tipo` | string | ● (contado con entregas) | `"1"`=Efectivo, `"2"`=Cheque, `"3"`=T. crédito, `"4"`=T. débito |
| `condicion.entregas[].monto` | number | ● (contado con entregas) | Monto de la entrega |
| `condicion.entregas[].moneda` | string | ○ | `"PYG"` por defecto |
| `items[].uuidProducto` | string (UUID) | ○ | UUID del producto (alternativo a `descripcion`) |
| `items[].descripcion` | string | ○ | Descripción libre (si no hay `uuidProducto`) |
| `items[].precioUnitario` | number | ● | Precio unitario (NO `precio`) |
| `items[].cantidad` | number | ● | Cantidad |
| `items[].codUnidadMedida` | string | ○ | Código SIFEN: `"77"`=Unidad, `"83"`=Kilogramos |
| `items[].iva` | number | ● | Tasa de IVA: 0, 5, 10 |
| `items[].tipoAfectacionIva` | number | ● | 1=Gravado, 2=Exonerado, 3=Exento, 4=Parcial |
| `items[].proporcionGravada` | number | ● | % gravado: 1→100, 2/3→0, 4→1-99 |
| `items[].descuentoMonto` | number | ○ | Descuento por ítem. A diferencia de `/productos`, **aquí se acepta `number`** (ej. `0`); también acepta `string` |
| `tipoEmision` | number | ○ | 1 Normal, 2 Contingencia |
| `indicadoresPresencias` | number | ○ | Indicador de presencia (2 = ambos presentes) |
| `emitirConCi` | boolean | ○ | Emitir sin RUC (default `false`) |
| `emitirSinNombre` | boolean | ○ | Receptor innominado (default `false`) |
| `observacion` | string | ○ | Observación libre |

> **Nota `/ventas`**: la venta **deriva** `nombre`/`apellido` del `nombreRazon` igual que `/crm`
> (comportamiento estandarizado en todo el backend).
> - **Contribuyente** (`naturaleza="1"`): Jurídica (`RUC ≥ 80.000.000`) → `nombreRazon`
>   (sin `nombre`/`apellido`). **Física** → podés enviar `nombreRazon` en formato
>   `"APELLIDO, NOMBRE"` **o** los campos `nombre` + `apellido` por separado (si van ambos
>   y no coinciden con `nombreRazon`, el backend rechaza con
>   "La razón social no coincide con los campos nombre y apellido" — la comparación es
>   **case-insensitive**, así que `"jimenez, alejandro"` vs `"JIMENEZ, ALEJANDRO"` pasa).
> - **No contribuyente** (`naturaleza="2"`): `nombre` + `apellido` son **obligatorios**
>   — si faltan, el backend rechaza la venta ("El nombre es obligatorio para no contribuyentes").
> - **Ubicación**: para que el XML se genere, si el receptor tiene `direccion` debe tener
>   `departamento`, `distrito` y `ciudad` (códigos SIFEN numéricos, no nombres) — misma regla
>   de la librería SIFEN. Sin dirección no se exigen. El rechazo ocurre en el **POST /de**
>   (pre-validación con la librería) y no en `/xml`.
> - ⚠️ **Catálogo de códigos**: los códigos de ubicación del simulador
>   (`frontend/public/js/constantes/geo.js`, ej. `1 = CAPITAL`, `12 = CENTRAL`)
>   **coinciden con el catálogo de la librería xmlgen** (`departamentos`
>   en `Constante.service.js`). No los cambies por códigos de otra fuente
>   (p.ej. tablas web): la librería valida contra su propio catálogo.
> - **Códigos de error**: los errores de validación del `/ventas` responden **HTTP 400**
>   con `{ message }`. Errores internos reales → `500`. Verificado por
>   `test_receptor_venta.mjs` (`npm run test:receptor`).

**Respuesta exitosa (201):**

```json
{
  "message": "Venta registrada.",
  "uuid": "06198e9b-44ca-4133-a759-859606045131"
}
```

---

## 3. Documentos Electrónicos

### 3.1 Factura Electrónica (tipo 1)

```
POST /de
Authorization: Bearer <token>
```

**Payload:**

```json
{
  "tipoDocumento": 1,
  "id_venta": "uuid-de-la-venta",
  "idEmpleado": "uuid-del-empleado-o-cajero",
  "idTimbrado": "uuid-del-timbrado",
  "idEstablecimiento": "uuid-del-establecimiento",
  "idPunto": "uuid-del-punto",
  "tipoEmision": 1,
  "tipoTransaccion": 1,
  "tipoImpuesto": 1,
  "presencia": 2,
  "emitirConCi": false,
  "emitirSinNombre": false
}
```

**Campos (`POST /de` Factura tipo 1):** `●` = obligatorio, `○` = opcional, `–` = no aplica (no enviar).

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `tipoDocumento` | number | ● | `1` = Factura |
| `id_venta` | string (UUID) | ● | Venta a facturar. 400 si falta. De aquí se heredan `receptor`, `items` y `condicion` |
| `idEmpleado` | string (UUID) | ● | UUID del empleado / cajero |
| `idTimbrado` | string (UUID) | ● | UUID del timbrado activo |
| `idEstablecimiento` | string (UUID) | ● | UUID del establecimiento |
| `idPunto` | string (UUID) | ● | UUID del punto de expedición |
| `tipoEmision` | number | ○ | `1` Normal, `2` Contingencia. **Puede omitirse**: si falta, el XML se genera con `1` (verificado con `/xml`) |
| `tipoTransaccion` | number | ○ | `1` Venta. **Puede omitirse**: si falta, el XML se genera con `1` |
| `tipoImpuesto` | number | ○ | `1` IVA. **Puede omitirse**: si falta, el XML se genera con `1` |
| `presencia` | number | ○ | Indicador de presencia (catálogo xmlgen `indicadoresPresencias`): `1` Operación presencial, `2` Operación electrónica, `3` Telemarketing, `4` Venta a domicilio, `5` Operación bancaria, `6` Operación cíclica, `9` Otro (si se omite, el backend usa `1`) |
| `emitirConCi` | boolean | ○ | Emitir con CI en lugar de RUC (default `false`) |
| `emitirSinNombre` | boolean | ○ | Receptor innominado (default `false`). **Prohibido** en Notas (5/6/7) |
| `documentosAsociados` | array | ○ | Documentos asociados (grupo H, opcional) |

> **Nota (Factura tipo 1):** el `receptor`, los `items` y la `condicion` se **heredan de la venta** (`id_venta`).
> `id_venta` es **obligatorio** (400 si falta). No se puede emitir una segunda factura para una venta que ya tiene una con CDC asignado.

**Respuesta:**
```json
{
  "uuid": "uuid-del-documento-electronico"
}
```

### 3.2 Nota de Crédito (tipo 5)

```
POST /de/nota-credito
Authorization: Bearer <token>
```

Requiere vincular el documento original mediante `documentosAsociados`.
Además del `cdc`, es necesario enviar `uuidDocumentoAfectado` (UUID del DE original):

```json
{
  "idEmpleado": "uuid-del-empleado",
  "idTimbrado": "uuid-del-timbrado",
  "idEstablecimiento": "uuid-del-establecimiento",
  "idPunto": "uuid-del-punto",
  "tipoEmision": 1,
  "tipoImpuesto": 1,
  "motivoEmision": 1,
  "receptor": {
    "naturaleza": "1",
    "ruc": "80000000",
    "dvRuc": "0",
    "nombreRazon": "CLIENTE S.A.",
    "direccion": "Av. Principal 123",
    "email": "cliente@empresa.com",
    "departamento": "1",
    "distrito": "1",
    "ciudad": "1"
  },
  "documentosAsociados": [
    {
      "tipoDocumentoAsociado": 1,
      "uuidDocumentoAfectado": "uuid-del-de-original",
      "cdc": "01234567890123456789012345678901234567890123",
      "numeroDocumentoFiscalAsociado": "001-001-0000001"
    }
  ],
  "items": [
    {
      "uuidProducto": "uuid-del-producto",
      "cantidad": 1,
      "precioUnitario": 100000,
      "codUnidadMedida": "77",
      "iva": 10,
      "tipoAfectacionIva": 1,
      "proporcionGravada": 100
    }
  ]
}
```

**Campos (`POST /de/nota-credito`):** `●` = obligatorio, `○` = opcional, `–` = no aplica (no enviar).

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `idEmpleado` | string (UUID) | ● | UUID del empleado |
| `idTimbrado` | string (UUID) | ● | UUID del timbrado activo |
| `idEstablecimiento` | string (UUID) | ● | UUID del establecimiento |
| `idPunto` | string (UUID) | ● | UUID del punto de expedición |
| `tipoEmision` | number | ○ | `1` Normal, `2` Contingencia. **Puede omitirse**: si falta, el XML se genera con `1` |
| `tipoImpuesto` | number | ○ | `1` IVA. **Puede omitirse**: si falta, el XML se genera con `1` |
| `motivoEmision` | number | ● | Código del motivo de la NC (catálogo SIFEN, ej. `1`) |
| `receptor` | object | ○ | Se usa para crear/actualizar la persona. Alternativa: `uuidPersona` |
| `receptor.naturaleza` | string | ● | `"1"` Contribuyente, `"2"` No contribuyente (mismos requisitos que en 2.3) |
| `items` | array | ● | **Obligatorio** (400 si falta). Ítems propios de la nota — no se heredan de ninguna venta (el backend ya no acepta `id_venta` en NC/ND) |
| `documentosAsociados` | array | ● | **Obligatorio** en NC/ND y Autofactura (400 si falta, verificado). Referencia al DE original (grupo H): el backend usa el primer elemento con `tipoDocumentoAsociado: 1` para setear `id_documento_afectado` y emitir `gCamDEAsoc` en el XML |

> **Nota (NC/ND):** el `tipoDocumento` **no se envía**: la ruta `/de/nota-credito` lo fija en `5` y `/de/nota-debito` en `6` (verificado).
>
> **Documento Asociado Impreso (`tipoDocumentoAsociado: 2`):** además del caso
> electrónico, la NC/ND puede referenciar un **documento impreso** (papel con timbrado):
>
> ```json
> "documentosAsociados": [
>   {
>     "tipoDocumentoAsociado": 2,
>     "tipoDocumentoImpreso": 1,
>     "timbradoImpreso": "12345678",
>     "establecimientoImpreso": "001",
>     "puntoImpreso": "001",
>     "numeroImpreso": "5",
>     "fechaEmisionImpreso": "2026-08-10"
>   }
> ]
> ```
>
> Reglas (validadas en el `POST /de/nota-credito`, HTTP 400 si fallan):
> - `timbradoImpreso`: **exactamente 8 números enteros** (`/^\d{8}$/`).
> - `establecimientoImpreso`, `puntoImpreso`, `numeroImpreso` y `fechaEmisionImpreso`
>   (formato `YYYY-MM-DD`) son **obligatorios**.
> - Con `tipoDocumentoAsociado: 1` (electrónico) se requiere `uuidDocumentoAfectado`
>   **o** `cdc` de **44 caracteres**.


### 3.3 Nota de Débito (tipo 6)

```
POST /de/nota-debito
```

Misma estructura que Nota de Crédito, enviada a `POST /de/nota-debito` (la ruta fija el `tipoDocumento` en `6`; no se envía como campo).

### 3.4 Autofactura (tipo 4)

```
POST /de
Authorization: Bearer <token>
```

Con `tipoDocumento: 4`. El receptor (`gDatRec` del XML) es la propia empresa
emisora. Los datos del vendedor (productor no contribuyente) se envían en `receptor`
y el sistema los mapea a la sección `autoFactura` del XML.

Requiere una `documentosAsociados` de tipo **Constancia**:

```json
{
  "idEmpleado": "uuid-del-empleado",
  "idTimbrado": "uuid-del-timbrado",
  "idEstablecimiento": "uuid-del-establecimiento",
  "idPunto": "uuid-del-punto",
  "tipoDocumento": 4,
  "tipoEmision": 1,
  "tipoTransaccion": 1,
  "tipoImpuesto": 1,
  "condicion": null,
  "presencia": 1,
  "receptor": {
    "nombre": "JUAN",
    "apellido": "PEREZ",
    "nombreRazon": "PEREZ, JUAN",
    "numeroDocumento": "1234567",
    "tipoDocumento": 1,
    "naturaleza": "2",
    "direccion": "Calle 123",
    "codPais": "PRY",
    "departamento": "1",
    "distrito": "1",
    "ciudad": "1"
  },
  "documentosAsociados": [
    {
      "tipoDocumentoAsociado": 3,
      "tipoConstancia": 1,
      "numeroConstancia": "00000000001",
      "controlConstancia": "ABC12345"
    }
  ],
  "items": [
    {
      "uuidProducto": "uuid-del-producto",
      "cantidad": 1,
      "precioUnitario": 30000,
      "codUnidadMedida": "77",
      "iva": 10,
      "tipoAfectacionIva": 1,
      "proporcionGravada": 100
    }
  ]
}
```

> **Importante**: `numeroConstancia` debe tener **11 dígitos** y `controlConstancia` **8 caracteres**.
> `tipoDocumentoAsociado: 3` indica que es una constancia (no un DE electrónico).

**Campos (`POST /de`, `tipoDocumento: 4`):** `●` = obligatorio, `○` = opcional, `–` = ignorado.

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `tipoDocumento` | number | ● | `4` (Autofactura) |
| `idEmpleado` | string (UUID) | ● | UUID del empleado |
| `idTimbrado` | string (UUID) | ● | UUID del timbrado activo |
| `idEstablecimiento` | string (UUID) | ● | UUID del establecimiento |
| `idPunto` | string (UUID) | ● | UUID del punto de expedición |
| `tipoEmision` | number | ○ | `1` Normal, `2` Contingencia (default `1`) |
| `tipoTransaccion` | number | ○ | Default `1` |
| `tipoImpuesto` | number | ○ | Default `1` |
| `condicion` | object \| null | ○ | Se guarda tal cual (ej. `null`, como en el payload de abajo). Si no hay pagos, el XML genera una condición al contado por defecto |
| `presencia` | number | – | Ignorada (no se guarda ni entra al XML) |
| `receptor` | object | ● | **Datos del vendedor (productor no contribuyente)** → se mapean a la sección `autoFactura` del XML. Mismos requisitos que 2.3 (`naturaleza: "2"` con `nombre`/`apellido`/`numeroDocumento`/`tipoDocumento`) |
| `emitirConCi` | boolean | ○ | |
| `emitirSinNombre` | boolean | ○ | Si es `true` permite omitir `receptor` |
| `documentosAsociados[]` | array | ● | **Obligatorio** (400 si falta): constancia de microproductores |
| `documentosAsociados[].tipoDocumentoAsociado` | number | ● | `3` = Constancia |
| `documentosAsociados[].tipoConstancia` | number | ○ | Default `1`. Catálogo xmlgen: `1` = Constancia de no ser contribuyente, `2` = Constancia de microproductores |
| `documentosAsociados[].numeroConstancia` | string | ● | Número de constancia. Debe tener **11 dígitos** (la librería SIFEN lo exige en el XML) |
| `documentosAsociados[].controlConstancia` | string | ● | Control de constancia. Debe tener **8 caracteres** (exigido por la librería en el XML) |
| `items[]` | array | ● | Al menos un ítem (400 si falta) |

### 3.5 Nota de Remisión (tipo 7)

```
POST /nota-remision
Authorization: Bearer <token>
```

> ⚠️ Ruta separada, no bajo `/de`.

**Payload:**

```json
{
  "idEmpleado": "uuid-del-empleado",
  "idTimbrado": "uuid-del-timbrado",
  "idEstablecimiento": "uuid-del-establecimiento",
  "idPunto": "uuid-del-punto",
  "tipoEmision": 1,
  "receptor": {
    "naturaleza": "1",
    "ruc": "80000000",
    "dvRuc": "0",
    "nombreRazon": "CLIENTE S.A.",
    "direccion": "Av. Principal 123",
    "numeroCasa": "123",
    "email": "cliente@empresa.com",
    "departamento": "1",
    "distrito": "1",
    "ciudad": "1"
  },
  "motivoEmision": 1,
  "responsableEmision": 1,
  "kmEstimado": 100,
  "transporte": {
    "tipoTransporte": 1,
    "modalidadTraslado": 1,
    "responsableFlete": 1,
    "fechaInicioTraslado": "2026-08-02",
    "fechaFinTraslado": "2026-08-02"
  },
  "localSalida": {
    "direccion": "Depósito Central",
    "numeroCasa": "0",
    "codDepartamento": "1",
    "desDepartamento": "CAPITAL",
    "codCiudad": "1",
    "desCiudad": "ASUNCION"
  },
  "localEntrega": {
    "direccion": "Local del Cliente",
    "numeroCasa": "0",
    "codDepartamento": "1",
    "desDepartamento": "CAPITAL",
    "codCiudad": "1",
    "desCiudad": "ASUNCION"
  },
  "vehiculos": [
    {
      "tipoVehiculo": "CAMION",
      "marca": "TOYOTA",
      "tipoIdentificacion": 1,
      "numeroIdentificacion": "ABC123"
    }
  ],
  "transportista": {
    "naturaleza": 1,
    "nombreRazon": "TRANSPORTE SA",
    "ruc": "70000000",
    "dvRuc": "1",
    "codPais": "PRY",
    "direccion": "Av. Transporte 456",
    "nombreChofer": "JUAN PEREZ",
    "documentoChofer": "1234567",
    "tipoDocumentoChofer": 1,
    "direccionChofer": "Calle del Chofer 789"
  },
  "items": [
    {
      "descripcion": "ARTICULO A REMITIR",
      "cantidad": 1,
      "precioUnitario": 10000,
      "codUnidadMedida": "77",
      "iva": 10,
      "tipoAfectacionIva": 1,
      "proporcionGravada": 100
    }
  ]
}
```

**Campos (`POST /nota-remision`):** `●` = obligatorio, `○` = opcional.

| Campo | Tipo | Oblig. | Descripción |
|-------|------|--------|-------------|
| `idEmpleado` | string (UUID) | ● | UUID del empleado |
| `idTimbrado` | string (UUID) | ● | UUID del timbrado activo |
| `idEstablecimiento` | string (UUID) | ● | UUID del establecimiento |
| `idPunto` | string (UUID) | ● | UUID del punto de expedición |
| `tipoEmision` | number | ○ | `1` Normal, `2` Contingencia (default `1`) |
| `receptor` / `uuidPersona` / `idPersona` | object / UUID | ● | Datos del receptor (mismos requisitos que 2.3). Al menos uno de los tres |
| `motivoEmision` | number | ● | Motivo de emisión (E501, catálogo 1-14, 99) |
| `responsableEmision` | number | ● | Responsable de emisión (E503, 1-5) |
| `kmEstimado` | number | ○ (para XML: > 0) | Kilómetros estimados (E505). La librería SIFEN rechaza `0` en el XML |
| `fechaEmisionFutura` | string | ○ | Fecha futura de emisión (E506) |
| `transporte.tipoTransporte` | number | ● | `1` Propio, `2` Tercero (E901) |
| `transporte.modalidadTraslado` | number | ● | `1` Terrestre, `2` Fluvial, `3` Aéreo, `4` Multimodal (E903) |
| `transporte.responsableFlete` | number | ● | `1` Emisor, `2` Receptor, `3` Tercero, `4` Agente, `5` Transporte propio (E905) |
| `transporte.fechaInicioTraslado` | string | ● | Fecha estimada inicio traslado `YYYY-MM-DD` (E909) |
| `transporte.fechaFinTraslado` | string | ○ | Fecha fin de traslado (E910) |
| `localSalida.direccion` / `numeroCasa` | string | ● | Dirección de salida (E921/E922) |
| `localSalida.codDepartamento` / `desDepartamento` / `codCiudad` / `desCiudad` | string | ● | Ubicación de salida: **código + descripción** (E925-E930) |
| `localEntrega.direccion` / `numeroCasa` | string | ● | Dirección de entrega (E941/E942) |
| `localEntrega.codDepartamento` / `desDepartamento` / `codCiudad` / `desCiudad` | string | ● | Ubicación de entrega (E945-E950) |
| `vehiculos[]` | array | ● | Al menos un vehículo (400 si falta) |
| `vehiculos[].tipoVehiculo` | string | ● | Tipo de vehículo según modalidad (E961) |
| `vehiculos[].marca` | string | ● | Marca (E962) |
| `vehiculos[].tipoIdentificacion` | number | ● | `1` Nro. identificación, `2` Nro. matrícula (E967) |
| `vehiculos[].numeroIdentificacion` | string | ● (si `tipoIdentificacion: 1`) | Nro. de identificación (E963) |
| `vehiculos[].numeroMatricula` | string | ● (si `tipoIdentificacion: 2`) | Nro. de matrícula (E965) |
| `transportista.naturaleza` | number | ● | `1` Contribuyente, `2` No contribuyente (E981) |
| `transportista.nombreRazon` | string | ● | Nombre/razón social (E982) |
| `transportista.ruc` | string | ● (si `naturaleza: 1`) | RUC del transportista (E983) |
| `transportista.tipoDocumentoIdentidad` | number | ● (si `naturaleza: 2`) | `1` Cédula, `2` Pasaporte, `3` CI extranjera, `4` Carnet (E985) |
| `transportista.direccion` | string | ● (para XML) | Dirección de la empresa transportista. La librería SIFEN la exige para generar el XML |
| `transportista.nombreChofer` | string | ● (para XML) | Nombre del chofer (4-60 caracteres). Requerido por la librería en `chofer` |
| `transportista.documentoChofer` | string | ● (para XML) | Número de documento del chofer (1-20, sin puntos) |
| `transportista.tipoDocumentoChofer` | number | ● (para XML) | Tipo de documento del chofer |
| `transportista.direccionChofer` | string | ● (para XML) | Dirección del chofer (4-60 caracteres) |
| `documentosAsociados` | array | ○ | Opcional (grupo H) |
| `items[]` | array | ● | Al menos un ítem (400 si falta). **No se hereda de ninguna venta** |

> Los códigos de departamento/distrito/ciudad deben enviarse junto con su descripción
> (`codDepartamento` + `desDepartamento`, etc.) porque el backend los guarda y la
> librería SIFEN los exige en el XML.
>
> ⚠️ **Tipos inconsistentes (reales, no los mezcles):** `receptor.naturaleza` (ventas/NC/autofactura)
> es **string** (`"1"`/`"2"`), pero `transportista.naturaleza` (NR) es **number** (`1`/`2`).
> Igual en ítems: `iva`, `tipoAfectacionIva` y `proporcionGravada` son **number**, mientras que
> `receptor.dvRuc` es string. Usa el tipo documentado en cada sección.

### 3.6 Resumen de Endpoints

| Documento | Método | Ruta Interna | Ruta Externa |
|-----------|--------|-------------|--------------|
| Factura | POST | `/de` | `/api/v1/de` |
| Autofactura | POST | `/de` (tipo=4) | `/api/v1/de` (tipo=4) |
| Nota de Crédito | POST | `/de/nota-credito` | `/api/v1/de/nota-credito` |
| Nota de Débito | POST | `/de/nota-debito` | `/api/v1/de/nota-debito` |
| Nota de Remisión | POST | `/nota-remision` | `/api/v1/nota-remision` |

### 3.7 Consultar Documentos

```
GET /de/documentos?page=1&limit=10&estado=APROBADO

GET /de/documentos/:uuid

GET /de/documentos/:uuid/kude?format=normal    # Descargar PDF A4
GET /de/documentos/:uuid/kude?format=ticket     # Descargar PDF ticket
GET /de/documentos/:uuid/xml                     # Descargar XML firmado
```

---

## 4. Procesamiento Fiscal (XML y SIFEN)

### 4.1 Generar y Firmar XML

```
POST /xml
{
  "documentoUuid": "uuid-del-documento-electronico"
}
```

Este endpoint:
1. Reutiliza la numeración fiscal ya asignada en el `POST /de` (la pre-validación
   asigna número + código de seguridad dentro de la transacción de creación; `/xml`
   **no consume un número nuevo**)
2. Genera el XML según schema SIFEN
3. Firma digitalmente con el certificado PKCS#12 de la empresa
4. Incorpora código QR
5. Guarda el XML firmado en storage

> ⚠️ **Pre-validación en `POST /de`**: desde la última versión, la creación del
> documento (`/de`, `/de/nota-credito`, `/de/nota-debito`, `/de` autofactura) ejecuta
> la **misma validación que la librería SIFEN** dentro de su transacción. Si el XML
> no puede generarse (ej. geografía faltante con dirección, timbrado impreso inválido,
> constancia mal formada, documento asociado sin CDC), el `POST /de` responde
> `400/500` y **no queda nada guardado** (ya no se crea el DE para fallar recién en `/xml`).

### 4.2 Enviar a SIFEN

```
POST /xml/enviar
{
  "documentoUuid": "uuid-del-documento-electronico"
}
```

### 4.3 Envío por Lote

```
POST /xml/lote/enviar
{
  "documentosUuids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### 4.4 Consultar Estado

```
GET /xml/consultar/:id
```

### 4.5 Estados SIFEN

| Estado | Descripción |
|--------|-------------|
| `PENDIENTE` | Creado, sin procesar |
| `FIRMADO` | XML generado y firmado |
| `ENVIADO_A_SIFEN` | Transmitido a SIFEN |
| `APROBADO` | Aceptado por SIFEN |
| `RECHAZADO` | Rechazado por SIFEN |
| `CANCELADO` | Anulado vía evento |
| `INUTILIZADO` | Rango inutilizado |

---

## 5. Webhooks (Notificaciones Asíncronas)

Cuando un documento es procesado por SIFEN (aprobado o rechazado),
te notificaremos vía webhook.

### 5.1 Configuración

```
POST /webhooks/outbound
{
  "url": "https://tu-sistema.com/webhooks/facturacion",
  "eventos": ["DE_APROBADO", "DE_RECHAZADO"]
}
```

**Respuesta:**
```json
{
  "uuid": "uuid-del-webhook",
  "secret_key": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}
```

> Guarda el `secret_key` — solo se muestra una vez.

### 5.2 Payload Recibido

```
POST https://tu-sistema.com/webhooks/facturacion
Content-Type: application/json
x-webhook-signature: <hmac-sha256>
```

```json
{
  "event": "DE_APROBADO",
  "uuid": "8f9a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "cdc": "01234567890123456789012345678901234567890123",
  "estado": "APROBADO",
  "pdfUrl": "http://localhost:3000/pdf/generate-from-id/123",
  "xmlUrl": "http://localhost:3000/storage/.../firmado.xml"
}
```

### 5.3 Validación de Firma

Tu endpoint debe verificar la firma HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verificarFirma(payload, signature, secretKey) {
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
```

### 5.4 Eventos Disponibles

| Evento | Significado |
|--------|-------------|
| `DE_APROBADO` | Documento aceptado por SIFEN |
| `DE_RECHAZADO` | Documento rechazado por SIFEN |
| `DE_APROBADO_CON_OBSERVACION` | Aprobado con observaciones |

Tu endpoint debe responder con `200 OK` para confirmar recepción.

---

## 6. Manejo de Errores

La API utiliza códigos HTTP estándar y siempre devuelve un mensaje descriptivo:

```json
{
  "message": "Descripción del error"
}
```

| Código | Significado |
|--------|-------------|
| `200` | OK |
| `201` | Creado exitosamente |
| `400` | Error de validación (payload inválido) |
| `401` | No autenticado (token faltante o inválido) |
| `403` | Permiso denegado (el rol no tiene acceso) |
| `404` | Recurso no encontrado |
| `500` | Error interno del servidor |

---

## 7. Simulador de Integración

El proyecto incluye un **simulador CLI** en [`src/index.js`](src/index.js) que
implementa los escenarios más comunes. Se puede usar como referencia o para testing.

### 7.1 Menú Interactivo

```bash
node src/index.js
```

```
  1. Diagnóstico de integración
  2. Ciclo completo de facturación
  3. Nota de Crédito (tipo 5)
  4. Nota de Débito (tipo 6)
  5. Autofactura (tipo 4)
  6. Nota de Remisión (tipo 7)
  7. Envío por lote
  8. Salir
```

### 7.2 Modo Automático

```bash
# Receptor por defecto (primer cliente disponible)
node src/index.js --auto

# Receptor existente por RUC
node src/index.js --auto --receptor 62520-5

# Receptor con datos manuales
node src/index.js --auto --receptor-data 66666666 6 "DOC, SA EMPRESA" "Calle 456" "sa@test.com" "+595222222" 1 1 1
```

> `--receptor-data` argumentos (orden):
> `RUC DV NOMBRE DIRECCION EMAIL TELEFONO [DPTO] [DISTRITO] [CIUDAD]`

### 7.3 Uso desde Código

```javascript
import ApiClient from './src/api-client.js'
import { simulacionCicloCompleto } from './src/simulacion.js'

const client = new ApiClient()

// Receptor manual (se crea en CRM automáticamente)
await simulacionCicloCompleto(client, {
  receptor: {
    ruc: '80000001',
    dvRuc: '0',
    nombreRazon: 'EMPRESA, CLIENTE SA',
    direccion: 'Av. Principal 123',
    email: 'cliente@ejemplo.com',
    telefono: '+595981000000',
    departamento: '1',
    distrito: '1',
    ciudad: '1',
  },
  generarXML: true,
  enviarSIFEN: false,
})
```

### 7.4 Simulador Web (navegador)

Además del simulador CLI, existe un **simulador web en el navegador** que permite
completar cada documento en un formulario y **ver/copiar el JSON exacto** que se
enviará a cada endpoint.

```
node frontend/server.js    # sirve frontend/public en 127.0.0.1:8090 y proxea /api → :3000/api/v1
```

> 🔒 El servidor solo escucha en `127.0.0.1` por defecto (seguridad: evita que el
> proxy sea un relay público hacia el backend). Para exponerlo a la red, setea
> `HOST=0.0.0.0` (y serví detrás de HTTPS), o usa `PORT` para cambiar el puerto.

Abre `http://localhost:8090`, inicia sesión con tu **API Key** y elige la pestaña
(Factura, Autofactura, NC, ND, NR). En cada una verás el card **"JSON que se
enviará"** con los botones `⧉ Copiar` y `⟳ Actualizar`: muestra el payload real
construido desde el formulario.

Estructura de `frontend/public/js/`:

```
js/main.js             → bootstrap (ESM, sin build)
js/app.js              → shell: router + dashboard + pestañas
js/core/payload.js     → ★ construye todos los JSON del integrador (fuente única)
js/core/               → state, session, api, fiscal, ui
js/widgets/            → cliente, cabecera, productos, condicion, asociado,
                          vehiculos, transportista, jsonPreview
js/formas/             → factura, autofactura, notaCredito, notaDebito, notaRemision
js/constantes/         → sifen.js (catálogos), geo.js (departamentos/distritos/ciudades)
```

Los payloads de cada documento se documentan en las secciones 2 y 3 de este README.

## 8. Ejemplo de Flujo Completo con curl

> Este flujo usa autenticación **JWT interna**: rutas sin `/api/v1` directamente en
> `http://localhost:3000`. Con **API Key** las rutas equivalentes son
> `/api/v1/ventas`, `/api/v1/de`, `/api/v1/xml`, etc. (ver secciones 1.1 y 3.6).

```bash
# 1. Autenticar
TOKEN=$(curl -s http://localhost:3000/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario","password":"pass"}' | jq -r '.accessToken')

# 2. Crear cliente
CLIENTE=$(curl -s http://localhost:3000/crm -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "uuidEmpresa": "uuid-empresa",
    "nombreRazon": "CLIENTE TEST S.A.",
    "ruc": "80000001",
    "dv": "0",
    "codPais": "PRY",
    "departamento": "1",
    "distrito": "1",
    "ciudad": "1"
  }' | jq -r '.uuid')

# 3. Crear venta
VENTA=$(curl -s http://localhost:3000/ventas -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
-d '{
    "uuidPersona": "'$CLIENTE'",
    "idEmpleado": "uuid-empleado",
    "condicion": { "tipo": 1, "entregas": [{"tipo": "1", "monto": 200000, "moneda": "PYG"}] },
    "items": [{
      "uuidProducto": "uuid-producto",
      "cantidad": 2,
      "precioUnitario": 100000,
      "codUnidadMedida": "77",
      "iva": 10,
      "tipoAfectacionIva": 1,
      "proporcionGravada": 100
    }]
  }' | jq -r '.uuid')

# 4. Crear DE
DE=$(curl -s http://localhost:3000/de -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tipoDocumento": 1,
    "id_venta": "'$VENTA'",
    "idTimbrado": "uuid-timbrado",
    "idEstablecimiento": "uuid-establecimiento",
    "idPunto": "uuid-punto",
    "tipoEmision": 1,
    "tipoTransaccion": 1,
    "presencia": 1
  }' | jq -r '.uuid')

# 5. Generar XML
curl -s http://localhost:3000/xml -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentoUuid": "'$DE'"}'

# 6. Enviar a SIFEN
curl -s http://localhost:3000/xml/enviar -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentoUuid": "'$DE'"}'

# 7. Descargar PDF
curl -s http://localhost:3000/de/documentos/$DE/kude?format=normal \
  -H "Authorization: Bearer $TOKEN" \
  -o factura.pdf
```

---

## 9. Catálogos de valores (resumen)

Códigos más usados al construir los payloads. La fuente completa de catálogos está
en `frontend/public/js/constantes/sifen.js`.

| Campo | Valores |
|---|---|
| `tipoDocumento` | 1 Factura, 4 Autofactura, 5 NC, 6 ND, 7 NR |
| `tipoEmision` | 1 Normal, 2 Contingencia |
| `tipoTransaccion` | 1 Venta de mercadería |
| `tipoImpuesto` | 1 IVA |
| `condicion` | 1 Contado, 2 Crédito |
| `presencia` | Indicador de presencia: `1` presencial, `2` electrónica, `3` telemarketing, `4` venta a domicilio, `5` bancaria, `6` cíclica, `9` otro (si se omite → `1`) |
| `naturaleza` | `"1"` Contribuyente, `"2"` No contribuyente |
| `tipoAfectacionIva` | 1 Gravado IVA, 2 Exonerado (Art. 83 - Ley 125/91), 3 Exento, 4 Gravado parcial |
| `codUnidadMedida` | 77 Unidad, 83 Kilogramos (código SIFEN) |
| `tipoDocumentoAsociado` | `1` Electrónico, `2` Impreso, `3` Constancia Electrónica (en `documentosAsociados`; ej. `1` para referenciar el DE original, `3` para la constancia de autofactura) |
| `motivoEmision` (NC) | Ver catálogo `motivoNC` en `sifen.js` |
| `motivoEmision` (ND) | Ver catálogo `motivoND` en `sifen.js` |

> **`tipoAfectacionIva`**: la proporción gravada (`proporcionGravada`) se normaliza
> automáticamente: 1→100, 2→0, 3→0. El valor 4 (parcial) requiere `proporcionGravada`
> entre 1 y 99.
