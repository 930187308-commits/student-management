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

This first server version keeps compatibility with the current frontend:

- `GET /data` returns the whole app data snapshot.
- `PUT /data` saves the whole app data snapshot.
- `GET /api/health` checks service health.
- `GET /api/meta` shows database and backup metadata.
- `POST /api/backups` creates SQLite and JSON backups.

The SQLite schema already reserves normalized tables for later migration, but the frontend still uses the app-state snapshot in this stage.

## Manual Backup

Create a backup from the command line:

```bash
node server/create-backup.js manual
```

Each backup creates both a SQLite copy and a JSON snapshot under `/Users/bzx/Data/student-ai-console/backups`.

## Import Existing JSON

To import an old backup or raw data JSON into the Mac mini database:

```bash
node server/import-json.js /path/to/backup-or-data.json
```

The importer accepts both formats:

- Raw data object: `{ "classes": [], "students": [], ... }`
- Backup wrapper: `{ "version": "...", "data": { ... } }`

Before importing, it creates a SQLite and JSON backup in the backup directory.

## Sample Data

The production server does not auto-seed sample students or classes. Sample data can still be restored manually from the frontend data-management tools if needed for testing.
