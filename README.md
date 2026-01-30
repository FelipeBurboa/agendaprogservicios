# AgendaPro Booking Exporter

Exports booking data from [AgendaPro](https://agendapro.com) into Excel files.

## Workflow

The process has two steps:

1. **`login.ts`** -- Opens a Chromium browser via Playwright, logs into AgendaPro, and saves the session token to `auth-state.json`.
2. **`export_excel.py`** -- Reads the token from `auth-state.json`, fetches bookings from the AgendaPro API for all locations, and writes two Excel files.

## Prerequisites

- **Node.js** (with npm)
- **Python 3** with the `openpyxl` package:
  ```
  pip install openpyxl
  ```

Install Node dependencies:

```
npm install
```

## Usage

```bash
# Step 1: Log in and capture the auth token
npx tsx login.ts

# Step 2: Export bookings to Excel
python export_excel.py
```

## Output

| File | Contents |
|---|---|
| `bookings-reserved.xlsx` | Reserved, confirmed, attended, and waitlisted bookings (one sheet per location) |
| `bookings-blocked.xlsx` | Blocked time slots and breaks (one sheet per location) |
