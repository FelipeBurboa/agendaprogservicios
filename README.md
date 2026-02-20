# AgendaPro Booking Exporter

Exporta datos de reservas desde [AgendaPro](https://agendapro.com) a archivos Excel o JSON. Disponible como CLI, API REST y aplicacion de escritorio (Electron).

## Requisitos

- **Node.js 20+** (con npm)

Instalar dependencias:

```bash
npm install
cd renderer && npm install
```

## Estructura del proyecto

```
src/
  types.ts          — Interfaces y constantes
  dates.ts          — Helpers de fechas (addMonths, fmtDate, dailyChunks)
  auth.ts           — Login con Playwright y validacion de token JWT
  api.ts            — Llamadas a la API de AgendaPro
  scraper.ts        — Orquestacion del scraping completo
  excel.ts          — Generacion de archivos Excel
electron/
  main.ts           — Proceso principal de Electron
  preload.ts        — Bridge seguro entre renderer y main (contextBridge)
  ipc-handlers.ts   — Handlers IPC para scraper y dialogo de carpeta
renderer/
  src/main.tsx      — Punto de entrada React
  src/components/   — ProgressView, ResultsView, ErrorView
scripts/
  copy-browsers.js  — Copia Chromium de Playwright al bundle
  wait-and-launch.js — Helper para modo desarrollo
main.ts             — Punto de entrada CLI
server.ts           — Punto de entrada API REST (Express)
requests.http       — Ejemplos para VS Code REST Client
```

## Aplicacion de escritorio (Electron)

Aplicacion nativa para Windows y macOS con interfaz grafica. Permite exportar reservas sin usar la terminal.

### Desarrollo

```bash
npm run electron:dev
```

Esto compila TypeScript, levanta el servidor Vite del renderer y abre la ventana de Electron con hot-reload.

### Empaquetar instaladores

**Windows** (genera `.exe` en `release/`):

```bash
npx playwright install chromium
npm run electron:pack
```

**macOS** (genera `.dmg` en `release/`):

```bash
npx playwright install chromium
npm run electron:pack:mac
```

> **Nota:** El `.dmg` generado no esta firmado. Los usuarios de Mac veran la advertencia "desarrollador no identificado" y deben hacer clic derecho → Abrir.

### CI/CD con GitHub Actions

El proyecto incluye un workflow (`.github/workflows/build.yml`) que compila instaladores para ambas plataformas en paralelo usando runners de GitHub.

**Se ejecuta automaticamente al:**
- Hacer push de un tag de version (`v*`, ej: `v1.0.0`)
- Ejecutar manualmente desde la pestana **Actions** → **Build Electron App** → **Run workflow**

**Descargar los instaladores:**
1. Ir a la pestana **Actions** del repositorio
2. Click en la ejecucion del workflow
3. Bajar los artefactos `windows-installer` (`.exe`) o `mac-installer` (`.dmg`)

## Uso por CLI

```bash
npx tsx main.ts <email> <password> <meses>
```

- `email` — Email de la cuenta AgendaPro
- `password` — Contrasena de la cuenta
- `meses` — Cantidad de meses a exportar desde hoy

Ejemplo:

```bash
npx tsx main.ts usuario@ejemplo.com miPassword 3
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
  -d '{"email":"usuario@ejemplo.com","password":"miPassword"}'
```

Respuesta: arreglo JSON de objetos `{ label, value }`.

#### `POST /api/bookings`

Obtiene todas las reservas y bloques. Con `format=xlsx` genera los dos archivos Excel en disco.

```bash
# Respuesta JSON (por defecto)
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'

# Generar archivos Excel
curl -X POST "http://localhost:3000/api/bookings?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'
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
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'

# Excel (genera bookings-reserved.xlsx)
curl -X POST "http://localhost:3000/api/bookings/reserved?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'
```

#### `POST /api/bookings/blocked`

Solo bloques de tiempo y descansos.

```bash
# JSON
curl -X POST http://localhost:3000/api/bookings/blocked \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'

# Excel (genera bookings-blocked.xlsx)
curl -X POST "http://localhost:3000/api/bookings/blocked?format=xlsx" \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"miPassword","months":1}'
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

## Scripts disponibles

| Script | Descripcion |
|---|---|
| `npm start` | Ejecuta el scraper por CLI |
| `npm run server` | Inicia el servidor API REST |
| `npm run electron:dev` | Desarrollo con Electron + Vite (hot-reload) |
| `npm run electron:build` | Compila TypeScript del proceso principal |
| `npm run renderer:build` | Compila el renderer (React + Vite) |
| `npm run electron:pack` | Empaqueta instalador Windows (`.exe`) |
| `npm run electron:pack:mac` | Empaqueta instalador macOS (`.dmg`) |

## Tecnologias

- **Playwright** — Automatizacion de navegador para login y scraping
- **Express** — Servidor API REST
- **ExcelJS** — Generacion de archivos Excel
- **Electron** — Aplicacion de escritorio multiplataforma
- **React + Vite + Tailwind CSS** — Interfaz del renderer
- **GitHub Actions** — CI/CD para compilar instaladores
