import { rm } from 'node:fs/promises';

/** Wipes local D1 state and re-applies migrations. Local only — never touches production. */
await rm('.wrangler/state', { recursive: true, force: true });
const proc = Bun.spawn(['bun', 'x', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});
process.exit(await proc.exited);
