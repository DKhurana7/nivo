import { snapshotDatabase } from '../server/backup';

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error(
    'Pass the backup file and a NEW destination database path. Existing databases are never overwritten.',
  );
snapshotDatabase(source, destination);
console.log(
  'Validated server database restored to the new path. Configure DATABASE_PATH before starting the API.',
);
