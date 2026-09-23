# Server backup and recovery

Server snapshots contain private accounts, session hashes, workspaces, original workbook bytes, calls, events and audit records. Keep them private and encrypted off-host. Browser JSON exports are not a complete server backup.

## Native installation

Take a consistent snapshot while the API is running:

```sh
node --env-file=.env --import tsx scripts/backup-server.ts /private/backup/location
```

The source is opened read-only; a missing source fails instead of creating an empty database. The command checks integrity and foreign keys, uses SQLite to include committed WAL writes, validates the staged copy, and publishes a mode-0600 file without overwriting an existing destination.

To rehearse recovery, choose a **new** destination path:

```sh
node --import tsx scripts/restore-server.ts /private/backup/location/nivo-TIMESTAMP.sqlite /private/recovery/nivo-restored.sqlite
```

Existing databases, symlinks and SQLite sidecars are refused. The original database and backup remain intact. Stop the API before switching it to the restored database, update `DATABASE_PATH`, then restart. Keep the previous database for rollback. Verify login, project counts, workbook downloads and hashes, saved quotes and call history before resuming work. Do not run audit fixtures against the recovered studio.

## Linux Compose installation

The production app image includes both commands:

```sh
docker compose -f compose.linux.yaml exec app node --import tsx scripts/backup-server.ts /app/data/backups
docker compose -f compose.linux.yaml cp app:/app/data/backups ./private-server-backups
```

The first copy stays on the app volume; the second must be moved to private encrypted off-host storage. Restrict the local copy's permissions and define a retention schedule. A backup on the same disk alone is insufficient for disk failure recovery.

For a container recovery rehearsal, restore into a fresh Docker volume with the tested app image:

```sh
docker volume create nivo-recovery
docker run --rm --network none \
  --mount type=volume,source=nivo-recovery,destination=/app/data \
  --mount type=bind,source=/absolute/path/to/backup.sqlite,destination=/restore/backup.sqlite,readonly \
  nivo-app:release-check node --import tsx scripts/restore-server.ts /restore/backup.sqlite /app/data/nivo.sqlite
```

The backup must be readable by the image's `node` user without being made public. On a production host, use the exact deployed image tag. The command refuses a nonempty target. Inspect the restored database before use. To switch Compose to the recovered volume, supply a Compose override for `studio-data` using `external: true` and `name: nivo-recovery`; review the resolved volume mapping, stop the API, then recreate it with that override. Preserve the original volume and do not use `down -v` during recovery.

## Reproducible checks

```sh
npm run test:server
docker build -t nivo-app:release-check .
node scripts/smoke-container.mjs
docker build -f agent/Dockerfile -t nivo-agent:release-check .
node scripts/smoke-worker-container.mjs
```

The app smoke creates a disposable anonymous volume with networking disabled and checks non-root execution, production login/CSP, saves, file bytes and equality of all seven tables after backup/restore. Backend tests also cover live WAL writes, missing/corrupt/incomplete sources, broken foreign keys and overwrite refusal. The worker smoke checks fresh cache/spool volume ownership and runs its Python tests without credentials or network. These checks do not substitute for external HTTPS/media tests or recovery on the chosen production host.
