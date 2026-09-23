import { execFileSync } from 'node:child_process';

const image = process.argv[2] || 'nivo-agent:release-check';
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '--network',
    'none',
    '--mount',
    'type=volume,destination=/home/worker/.cache',
    '--mount',
    'type=volume,destination=/app/data',
    '--entrypoint',
    'python',
    image,
    '-c',
    `import os, subprocess, sys
from pathlib import Path
assert os.getuid() != 0
assert not Path('/app/.env').exists()
for root in ['/home/worker/.cache', '/app/data']:
    Path(root, 'nivo-write-check').write_text('ok')
subprocess.run([sys.executable, '-m', 'pytest', 'agent/tests', '-q'], check=True)
print('PASS: non-root worker, fresh writable model-cache/spool volumes and Python tests; no network or credentials.')`,
  ],
  { stdio: 'inherit' },
);
