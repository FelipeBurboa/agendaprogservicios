# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |

---

# Project: ventaplay-scraper

## Purpose

Extracts data out of **AgendaPro** (Chilean salon/clinic SaaS) and writes Excel files
in the shape **VentaPlay** expects for import. Migration tooling, not a general scraper.

- Destination app lives in a sibling repo: `D:\Projectos\ventaplaymrm`.
- `.claude/skills/ventaplay-schema/` documents VentaPlay's Supabase schema (170 tables).
  Load it when touching export column formats.
- `README.md` is Spanish end-user docs and lags the code (documents 4 of 7 endpoints,
  claims Playwright drives scraping — it doesn't). Trust the source over the README.

## Architecture: one core, three frontends

```
src/                     shared scraping core — the only place business logic lives
  auth.ts                sign_in + MFA verify, JWT extraction, expiry check
  token-store.ts         JWT cache: in-memory Map + ~/.agendapro-scraper/tokens.json
  api.ts                 AgendaPro HTTP calls (retry, throttle, pagination)
  scraper.ts             orchestration — scrapeLocations/Services/Professionals/Products/Bookings
  excel.ts               ExcelJS workbook generation
  bookings-runtime.ts    timeout math for the bookings workload
  types.ts  dates.ts

main.ts                  CLI       — npx tsx main.ts <email> <pass> <months|products>
server.ts                Express   — REST API, port 3000
electron/ + renderer/    Desktop   — Electron main + React/Vite renderer
```

**The three frontends are parallel, not layered.** Electron imports `src/` and runs the
scrape **inside its own main process** — it never calls `server.ts`. Fixing a bug in `src/`
fixes all three; fixing it in one frontend fixes only that one.

## Scraping is plain `fetch` — there is no browser

No Playwright, no Puppeteer, no DOM. The core hits AgendaPro's undocumented JSON APIs
directly with spoofed browser headers (`origin`/`referer` = `app.agendapro.com`, plus a
base64'd `from` header).

Three hosts:
- `https://agendapro.com/authentication` — sign_in, sign_in_with_mfa_code ([src/auth.ts:3](src/auth.ts:3))
- `https://ap-api.agendapro.com/agenda-core-bff` — `API_BASE`, calendar locations ([src/api.ts:12](src/api.ts:12))
- `https://agendapro.com/api/views/admin` — `API_BASE_LEGACY`, most data ([src/api.ts:13](src/api.ts:13))

`apiGet` ([src/api.ts:69](src/api.ts:69)) retries 3× with exponential backoff on 429/5xx and
throttles 300 ms between pages. Non-JSON responses are reported as suspected Cloudflare
challenges — don't chase those as parse bugs.

**`data.txt` / `data2.txt` / `data3.txt` are not output.** They're pasted Chrome DevTools
Network captures (Spanish headers, then Request URL / Method / Status / payload) used to
reverse-engineer new endpoints. Read them when adding a scrape target; never regenerate them.

## REST API — [server.ts](server.ts)

Express 5, `express.json()` only. All routes are **POST** with `{email, password}` in the body.
All support `?format=xlsx` except `/api/locations`.

| Route | Line | Returns |
|---|---|---|
| `/api/locations` | [358](server.ts:358) | `[{label, value}]` — JSON only |
| `/api/services` | [375](server.ts:375) | rows; xlsx → `services.xlsx` |
| `/api/products` | [404](server.ts:404) | rows; xlsx → `productos.xlsx` (VentaPlay "externo" format) |
| `/api/professionals` | [433](server.ts:433) | `{professionals, sucursales}`; xlsx → 2 files |
| `/api/bookings` | [469](server.ts:469) | `{reserved, blocked}`; xlsx → 2 files |
| `/api/bookings/reserved` | [473](server.ts:473) | reserved only |
| `/api/bookings/blocked` | [477](server.ts:477) | blocked only |

Bookings body also takes `months` (required, positive) and `past_months` (optional, 1–12).

`handleBookingsRequest` ([server.ts:190](server.ts:190)) is the non-obvious one: it wires an
`AbortController` to `req.on("aborted")` + `res.on("close")` so a disconnecting client kills
the in-flight scrape, and uses a **two-stage timeout** — 5 min for login/prep, then recomputed
from `locations × days` once the workload is known. 408 on timeout.

## MFA contract

AgendaPro emails a 6-digit code (~14 min validity) on each new login.

Stateless handshake ([server.ts:68-113](server.ts:68)):
1. POST without MFA fields → **401** `{error, mfa_required: true, mfa_session}`, code emailed.
2. Re-POST the *same* request plus `mfa_code` + `mfa_session` → 200.

**Phase 2 must call `authenticateWithMfaCode` ([src/scraper.ts:347](src/scraper.ts:347)), never
`sign_in`** — `sign_in` rotates the session and emails a *new* code, invalidating the one the
user just typed. This is the single easiest way to break MFA here.

The JWT lands in `~/.agendapro-scraper/tokens.json`, keyed by lowercased email, shared by all
three frontends. That cache is why one code covers many exports across restarts. Evicted when
`checkTokenExpiry` sees <5 min left.

## Electron

- Main: [electron/main.ts](electron/main.ts) — 560×880 fixed window, `contextIsolation: true`,
  `nodeIntegration: false`, native menu removed. Dev loads `VITE_DEV_SERVER_URL` or
  `localhost:5173`; packaged loads `../../dist-renderer/index.html`.
- Bridge: `window.electronAPI` ([electron/preload.ts:40](electron/preload.ts:40)); renderer-side
  types in [renderer/src/types.ts:38](renderer/src/types.ts:38). Keep the three in sync.
- IPC, all registered in `registerIpcHandlers()` ([electron/ipc-handlers.ts:277](electron/ipc-handlers.ts:277)):

  | invoke (renderer → main) | Line |
  |---|---|
  | `scraper:select-folder` | [278](electron/ipc-handlers.ts:278) |
  | `scraper:mfa-submit` | [287](electron/ipc-handlers.ts:287) |
  | `scraper:mfa-resend` | [294](electron/ipc-handlers.ts:294) |
  | `scraper:mfa-cancel` | [309](electron/ipc-handlers.ts:309) |
  | `scraper:run` | [316](electron/ipc-handlers.ts:316) |

  Main → renderer sends: `scraper:progress`, `scraper:mfa-required`, `scraper:mfa-resent`,
  `scraper:mfa-timeout`.

- Renderer: React 19 + Vite 6 + Tailwind 4, its own `node_modules` and tsconfig.
  [App.tsx:15](renderer/src/App.tsx:15) is a `form | progress | mfa | results | error`
  state machine in one component. Error strings `MFA_CANCELLED` / `MFA_TIMEOUT` are matched
  by substring — don't reword them.
- **One scrape at a time.** A module-level `pendingMfa` promise + 14-min timer holds the MFA
  state, so concurrent scrapes would collide.
- Packaging: `build` key in `package.json`. Unsigned on both platforms (`signAndEditExecutable:
  false`, mac `identity: null`). No auto-update, no `electron-updater`.

## Commands

```bash
npm install && cd renderer && npm install   # renderer has its own deps
npm run server                              # Express on :3000
npm start                                   # CLI
npm run electron:dev                        # tsc + vite + electron, hot-reload
npm run electron:build                      # tsc → dist-electron/
npm run renderer:build                      # vite → dist-renderer/
npm run electron:pack                       # Windows .exe → release/
npm run electron:pack:mac                   # macOS .dmg → release/
```

`npx playwright install chromium` is required before either `pack` — packaging copies Chromium
into the bundle (see Gotchas #2).

CI (`.github/workflows/build.yml`) builds win+mac installers on `v*` tags or manual dispatch.
**It never builds or exercises the server.**

## Conventions

- **Commits:** Conventional Commits, English subject and body — `feat(scraper):`, `fix(ci):`,
  `docs(ventaplay):`. Keep a blank line between subject and body (several existing commits
  don't — don't copy that).
- **Branches:** `fb-branch-N`, merged via numbered PR. HEAD is currently `gitbutler/workspace`.
- **Language split:** code identifiers and comments in **English**; all user-facing strings and
  docs in **Spanish without accents** ("Exportador", "Contrasena"). Spanish domain vocabulary
  appears inside English code — `sucursal`, `insumo`, `externo`, `Stock {sucursal}`. Preserve it.
- **No tests, no ESLint, no Prettier.** Don't claim a change is verified by tests, and don't
  invent a `npm test`. Verify by running the server, CLI, or app.

## Gotchas

1. **`server.ts` and root `main.ts` are excluded from typecheck.** `tsconfig.json:16` includes
   only `src/**/*` and `electron/**/*`, so `npx tsc --noEmit` silently skips both entry points.
   They only ever run through `tsx`. Typecheck them explicitly if you edit them.
2. **Playwright is a ~120 MB dead payload.** `playwright` is a runtime dependency and
   `scripts/copy-browsers.js` + the `extraResources` config ship a full Chromium in the
   installer, but **no `.ts`/`.tsx` file imports it** and nothing sets `PLAYWRIGHT_BROWSERS_PATH`.
   Vestigial from a pre-`fetch` era. Don't add browser-based code assuming it's wired up.
3. **JWTs stored unencrypted** in `~/.agendapro-scraper/tokens.json`. Electron's `safeStorage`
   would be the fix if this ever matters.
4. **The server has no CORS, auth, rate limiting, or request logging**, and credentials travel in
   POST bodies over plain HTTP. It's a localhost tool; treat exposing it as a change in kind.
5. **Server xlsx files go to the process CWD with bare filenames, and there's no `GET` route to
   download them.** `generateServicesWorkbookBuffer` / `generateProductsWorkbookBuffer` in
   `src/excel.ts` already return buffers and have **no callers** — that's the wiring for
   streaming xlsx over HTTP, already written.
6. **`requests.http` contains real plaintext credentials.** Gitignored, but the README tells
   users to open it. Don't paste its contents anywhere.
7. **`data3.txt` is untracked and *not* gitignored**, unlike `data.txt` and `data2.txt`. It holds
   real tenant ids (`location_ids=338706`). Check before committing.
8. **Bookings progress is scraped from `console.log`.** `ipc-handlers.ts:322-337` monkey-patches
   `console.log` and regex-matches `/\[(\d+)\/(\d+)\]\s+(.+)/`. The scraper's `[n/total] msg`
   log format is a load-bearing contract — changing it silently breaks the desktop progress bar.
