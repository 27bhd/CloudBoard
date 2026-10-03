import { build } from './build';

/** One command, three watchers: Tailwind, the client bundle, and Wrangler (Pages Functions + local D1). */
await build({ minify: false });

const run = (cmd: string[]) => Bun.spawn(cmd, { stdout: 'inherit', stderr: 'inherit', stdin: 'ignore' });

const children = [
  // `=always` stops Tailwind from exiting when stdin is closed (CI, IDE terminals).
  run(['bun', 'x', 'tailwindcss', '-i', 'src/client/styles.css', '-o', 'dist/app.css', '--watch=always']),
  run(['bun', 'build', 'src/client/main.ts', '--outfile', 'dist/app.js', '--sourcemap=linked', '--watch', '--no-clear-screen']),
  run(['bun', 'x', 'wrangler', 'pages', 'dev', '--port', '8788']),
];

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await Promise.race(children.map((child) => child.exited));
stop();
