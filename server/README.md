# Mac mini Server

This folder contains the first Mac mini server skeleton for the student AI console.

## Runtime Layout

- Project code: `/Users/bzx/Projects/student-ai-console`
- SQLite database: `/Users/bzx/Data/student-ai-console/production.sqlite`
- Backups: `/Users/bzx/Data/student-ai-console/backups`
- Logs: `/Users/bzx/Logs/student-ai-console`

Do not commit database files, backups, logs, or real student data.

## Start

```bash
scripts/start-server.sh
```

The server listens on:

```text
http://localhost:3000
```

On the local network, other devices should use the Mac mini address, for example:

```text
http://bzxdeMac-mini.local:3000
http://192.168.1.97:3000
```

Prefer the `.local` address first. If a Windows device cannot resolve it, use the IP address.

Useful service commands:

```bash
scripts/status-server.sh
scripts/stop-server.sh
scripts/start-server.sh
```

The managed start script writes logs to:

```text
/Users/bzx/Logs/student-ai-console/server.out.log
/Users/bzx/Logs/student-ai-console/server.err.log
```

If you run the server manually with `node server/server.js`, stop that manual process before using the managed start script.

## LaunchAgent

For a Mac mini server, prefer launchd once the server is ready to stay online:

```bash
scripts/install-launchd.sh
```

This installs a user LaunchAgent:

```text
~/Library/LaunchAgents/com.bzx.student-ai-console.plist
```

Uninstall it with:

```bash
scripts/uninstall-launchd.sh
```

The LaunchAgent uses `scripts/run-server.sh`, keeps the service alive, and starts it again after user login.

## Current API

The server keeps compatibility with the current frontend:

- `GET /data` returns the whole app data and is now mainly a compatibility fallback. The normal frontend boot path reads split module APIs first.
- `PUT /data` remains available as a compatibility fallback for whole-data writes.
- `GET /api/health` checks service health.
- `GET /api/meta` shows database and backup metadata.
- `POST /api/backups` creates SQLite and JSON backups.
- `GET /api/sqlite/status` checks whether SQLite reads are enabled and reconciled.
- `GET /api/data-sqlite` returns full data assembled from SQLite entity tables.
- `GET /api/data-sqlite-columns` returns full data assembled from SQLite entity columns.
- `GET /api/dashboard/summary` returns dashboard cards, class overview, and pending fee rows.
- `GET /api/reports/summary` returns report aggregates.
- `GET /api/data-health` returns the data health report.

Core module APIs read from SQLite entity columns where field columns exist:

- `GET /api/classes`
- `GET /api/students`
- `GET /api/prospects`
- `GET /api/fees`
- `GET /api/attendance`
- `GET /api/grades`
- `GET /api/communications`
- `GET /api/communicationTopics`
- `GET /api/prospectSources`
- `GET /api/classTypes`
- `GET /api/gradeOptions`

Module writes use `PUT /api/{collection}` for one collection and `PUT /api/batch` for multi-collection saves.

Single-record APIs are available for entity collections:

- `POST /api/{collection}` creates or upserts one record from `{ item }`.
- `GET /api/{collection}/{id}` reads one record.
- `PUT /api/{collection}/{id}` replaces one record.
- `PATCH /api/{collection}/{id}` partially updates one record.
- `DELETE /api/{collection}/{id}` deletes one record.

Single-record writes require `X-Base-Data-Updated-At`, the same conflict-protection header used by collection writes.

`app_state.data` is still retained as the rollback snapshot.

## SQLite Runtime Checks

Check the managed service and SQLite health:

```bash
scripts/status-server.sh
```

Run the full SQLite runtime check:

```bash
scripts/node.sh server/check-sqlite-runtime.js
```

Run the full backend runtime baseline before and after backend changes:

```bash
npm run backend:check
```

This runs the SQLite read path, field coverage, field/read parity, metrics, reports, dashboard, data-health, collection API, and single-record API checks together.

Attendance read-path parity can also be checked directly:

```bash
npm run sqlite:attendance-record-read-parity
```

This verifies that `attendance_sessions` plus `attendance_records` can reconstruct the same attendance JSON shape used by the frontend.

Reconcile the app-state snapshot against SQLite entity tables:

```bash
scripts/node.sh server/reconcile-sqlite-split.js
```

Enable or disable full `/data` reads from SQLite:

```bash
scripts/set-sqlite-data-read.sh on
scripts/set-sqlite-data-read.sh off
scripts/set-sqlite-data-read.sh status
```

If real usage shows an unexpected issue, run `scripts/set-sqlite-data-read.sh off` to immediately restore `/data` reads from `app_state.data`.

## Manual Backup

Create a backup from the command line:

```bash
scripts/node.sh server/create-backup.js manual
```

Each backup creates both a SQLite copy and a JSON snapshot under `/Users/bzx/Data/student-ai-console/backups`.

## Import Existing JSON

To import an old backup or raw data JSON into the Mac mini database:

```bash
scripts/node.sh server/import-json.js /path/to/backup-or-data.json
```

The importer accepts both formats:

- Raw data object: `{ "classes": [], "students": [], ... }`
- Backup wrapper: `{ "version": "...", "data": { ... } }`

Before importing, it creates a SQLite and JSON backup in the backup directory.

## Test Data

Generate broad fake data for multi-device testing:

```bash
scripts/node.sh server/generate-test-data.js
```

Import the generated file:

```bash
scripts/node.sh server/import-json.js /Users/bzx/Data/student-ai-console/backups/test-data-具体文件名.json
```

Reset to empty default data after testing:

```bash
scripts/node.sh server/reset-empty-data.js
```

See `TEST_PLAN.md` for the full validation checklist.

## Sample Data

The production server does not auto-seed sample students or classes. Sample data can still be restored manually from the frontend data-management tools if needed for testing.
