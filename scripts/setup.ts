import { existsSync } from 'node:fs';

/** `bun run setup` - the only command a new contributor needs before `bun run dev`. */
const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' });
  if ((await proc.exited) !== 0) throw new Error(`Command failed: ${cmd.join(' ')}`);
};

console.log('-> Installing dependencies');
await run(['bun', 'install']);

if (existsSync('.dev.vars')) {
  console.log('-> .dev.vars already exists, leaving it alone');
} else {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  await Bun.write(
    '.dev.vars',
    [
      `SESSION_SECRET=${secret}`,
      '# Offline sign-in at http://localhost:8788 (ignored on any non-localhost host).',
      'DEV_AUTH=1',
      '# Optional: real GitHub sign-in locally. Callback URL: http://localhost:8788/api/auth/callback',
      'GITHUB_CLIENT_ID=',
      'GITHUB_CLIENT_SECRET=',
      '',
    ].join('\n'),
  );
  console.log('-> Wrote .dev.vars with a fresh session secret and offline sign-in enabled');
}

console.log('-> Creating the local D1 database');
await run(['bun', 'x', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local']);

console.log('\nReady. Run `bun run dev` and open http://localhost:8788');
