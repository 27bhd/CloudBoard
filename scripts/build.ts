import { cp, mkdir, rm } from 'node:fs/promises';

/** Production build: static assets + bundled client + compiled Tailwind → dist/ (served by Pages). */
export async function build({ minify }: { minify: boolean }): Promise<void> {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await cp('static', 'dist', { recursive: true });

  const result = await Bun.build({
    entrypoints: ['src/client/main.ts'],
    outdir: 'dist',
    naming: 'app.js',
    target: 'browser',
    minify,
    sourcemap: minify ? 'none' : 'linked',
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error('Client bundle failed');
  }

  const css = Bun.spawn(['bun', 'x', 'tailwindcss', '-i', 'src/client/styles.css', '-o', 'dist/app.css', ...(minify ? ['--minify'] : [])], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await css.exited) !== 0) throw new Error('Tailwind build failed');
}

if (import.meta.main) {
  await build({ minify: true });
  console.log('Build complete: output in dist/');
}
