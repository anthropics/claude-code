import * as esbuild from 'esbuild'
import { resolve, dirname } from 'path'
import { chmodSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

const __dir = (import.meta as any).dirname ?? dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')

const watch = process.argv.includes('--watch')
const minify = process.argv.includes('--minify')
const noSourcemap = process.argv.includes('--no-sourcemap')

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))
const version = pkg.version || '0.0.0-dev'

const srcResolverPlugin: esbuild.Plugin = {
  name: 'src-resolver',
  setup(build) {
    build.onResolve({ filter: /^src\// }, (args) => {
      const basePath = resolve(ROOT, args.path)
      if (existsSync(basePath)) return { path: basePath }
      
      const withoutExt = basePath.replace(/\.(js|jsx)$/, '')
      for (const ext of ['.ts', '.tsx', '.js']) {
        const candidate = withoutExt + ext
        if (existsSync(candidate)) return { path: candidate }
      }
      
      return { path: args.path, namespace: 'stub' }
    })
  },
}

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [resolve(ROOT, 'src/entrypoints/cli.tsx')],
  bundle: true,
  platform: 'node',
  target: ['node20', 'es2022'],
  format: 'esm',
  outdir: resolve(ROOT, 'dist'),
  outExtension: { '.js': '.mjs' },
  splitting: false,
  plugins: [srcResolverPlugin],
  tsconfig: resolve(ROOT, 'tsconfig.json'),
  
  external: [
    'fs', 'path', 'os', 'crypto', 'child_process', 'http', 'https',
    'net', 'tls', 'url', 'util', 'stream', 'events', 'buffer',
    'node:*',
    'node-pty',
    'better-sqlite3',
  ],
  
  jsx: 'automatic',
  sourcemap: noSourcemap ? false : 'external',
  minify,
  treeShaking: true,
  
  define: {
    'MACRO.VERSION': JSON.stringify(version),
    'process.env.NODE_ENV': minify ? '"production"' : '"development"',
  },
  
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  logLevel: 'info',
  metafile: true,
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('Watching for changes...')
  } else {
    const startTime = Date.now()
    const result = await esbuild.build(buildOptions)
    
    if (result.errors.length > 0) {
      console.error('Build failed')
      process.exit(1)
    }
    
    const outPath = resolve(ROOT, 'dist/cli.mjs')
    try { chmodSync(outPath, 0o755) } catch {}
    
    const elapsed = Date.now() - startTime
    
    if (result.metafile) {
      const outFiles = Object.entries(result.metafile.outputs)
      for (const [file, info] of outFiles) {
        if (file.endsWith('.mjs')) {
          const sizeMB = ((info as { bytes: number }).bytes / 1024 / 1024).toFixed(2)
          console.log(`\n  ${file}: ${sizeMB} MB`)
        }
      }
      console.log(`\nBuild complete in ${elapsed}ms → dist/`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
