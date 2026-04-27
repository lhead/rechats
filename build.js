const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/renderer.tsx'],
  bundle: true,
  outfile: 'dist/src/renderer.js',
  platform: 'browser',
  format: 'iife',
  sourcemap: true,
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
}).catch(() => process.exit(1));
