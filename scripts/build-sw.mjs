#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const entry = join(rootDir, 'workers/sw.js');
const outfile = join(rootDir, 'public/sw.js');

const manifestBanner = `self.__WB_MANIFEST = self.__WB_MANIFEST || [];`;

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: 'iife',
  platform: 'browser',
  target: ['chrome90', 'firefox90', 'safari14'],
  minify: process.env.NODE_ENV === 'production',
  banner: {
    js: manifestBanner,
  },
  logLevel: 'info',
});

console.log(`Service worker built -> ${outfile}`);
