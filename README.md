# AgendaPro Booking Exporter

Exporta datos de reservas desde [AgendaPro](https://agendapro.com) a archivos Excel o JSON mediante CLI o API REST.

## Requisitos

- **Node.js** (con npm)

Instalar dependencias:

```
npm install
```

## Estructura del proyecto

```
src/
  types.ts      — Interfaces y constantes
  dates.ts      — Helpers de fechas (addMonths, fmtDate, dailyChunks)
  auth.ts       — Login con Playwright y validacion de token JWT
  api.ts        — Llamadas a la API de AgendaPro
  scraper.ts    — Orquestacion del scraping completo
  excel.ts      — Generacion de archivos Excel
main.ts         — Punto de entrada CLI
server.ts       — Punto de entrada API REST (Express)
requests.http   — Ejemplos para VS Code REST Client
```

## Uso por CLI

```bash
npx tsx main.ts <email> <password> <meses>
```

- `email` — Email de la cuenta AgendaPro
- `password` — Contrasena de la cuenta
- `meses` — Cantidad de meses a exportar desde hoy

Ejemplo:

```bash
npx tsx main.ts gerencia@clubdelabarba.cl CLUB6488 3
```

El script:

1. Abre un navegador headless para iniciar sesion y capturar el token.
2. Obtiene todas las locaciones de la cuenta.
3. Descarga las reservas dia a dia por cada locacion en el rango de fechas.
4. Genera dos archivos Excel.

### Archivos generados

| Archivo | Contenido |
|---|---|
| `bookings-reserved.xlsx` | Reservas confirmadas, atendidas y en lista de espera (una hoja por locacion) |
| `bookings-blocked.xlsx` | Bloques de tiempo y descansos (una hoja por locacion) |

## Uso por API REST

Iniciar el servidor:

```bash
npm run server
# o
npx tsx server.ts
```

El servidor escucha en el puerto 3000 por defecto (se puede cambiar con la variable de entorno `PORT`).

### Endpoints

Todos los endpoints usan **POST** con las credenciales en el body JSON.

#### `POST /api/locations`

Retorna la lista de locaciones de la cuenta.

```bash
curl -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488"}'
```

Respuesta: arreglo JSON de objetos `{ label, value }`.

#### `POST /api/bookings`

Obtiene todas las reservas y bloques. Con `format=xlsx` genera los dos archivos Excel en disco.

```bash
# Respuesta JSON (por defecto)
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'

# Generar archivos Excel
curl -X POST "http://localhost:3000/api/bookings?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'
```

Con `format=xlsx` la respuesta es:

```json
{
  "files": ["bookings-reserved.xlsx", "bookings-blocked.xlsx"],
  "reserved": 42,
  "blocked": 7
}
```

Con `format=json` (o sin parametro) la respuesta es:

```json
{
  "reserved": [ ... ],
  "blocked": [ ... ]
}
```

#### `POST /api/bookings/reserved`

Solo reservas (confirmadas, atendidas, en espera).

```bash
# JSON
curl -X POST http://localhost:3000/api/bookings/reserved \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'

# Excel (genera bookings-reserved.xlsx)
curl -X POST "http://localhost:3000/api/bookings/reserved?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'
```

#### `POST /api/bookings/blocked`

Solo bloques de tiempo y descansos.

```bash
# JSON
curl -X POST http://localhost:3000/api/bookings/blocked \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'

# Excel (genera bookings-blocked.xlsx)
curl -X POST "http://localhost:3000/api/bookings/blocked?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"gerencia@clubdelabarba.cl","password":"CLUB6488","months":1}'
```

### Parametros de query

| Parametro | Valores | Default | Descripcion |
|---|---|---|---|
| `format` | `json`, `xlsx` | `json` | Formato de respuesta. `xlsx` genera archivos Excel en disco. |

### Body de los requests

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `email` | string | Si | Email de la cuenta AgendaPro |
| `password` | string | Si | Contrasena de la cuenta |
| `months` | number | Si (bookings) | Meses a exportar desde hoy |

### VS Code REST Client

Abrir `requests.http` en VS Code con la extension [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) para probar todos los endpoints. Las variables `email`, `password` y `months` se configuran al inicio del archivo.
