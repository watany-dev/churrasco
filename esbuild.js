// @ts-check
const { build, context } = require('esbuild');
const { existsSync } = require('node:fs');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  logLevel: 'info',
};

async function main() {
  if (!existsSync('src/extension.ts')) {
    console.warn('[esbuild] src/extension.ts not found yet — skipping bundle.');
    return;
  }

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    console.log('[esbuild] watching for changes...');
    return;
  }

  await build(options);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
