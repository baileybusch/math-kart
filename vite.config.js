import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

// Primary target is an iPad mini 2 stuck on iOS 12 Safari. Safari 12 supports
// <script type="module">, so a "modern" chunk would be picked over a nomodule
// fallback, and Vite's default esbuild target (safari14) happily emits `??`
// and `?.` while minifying. We therefore ship ONLY the Babel-transpiled legacy
// bundle (SystemJS + core-js polyfills) to every browser.
// `npm run check:legacy` enforces this after every build.
export const LEGACY_TARGETS = ['defaults', 'safari >= 11', 'ios_saf >= 11']

export default defineConfig({
  base: '/math-kart/',
  plugins: [
    legacy({
      targets: LEGACY_TARGETS,
      renderModernChunks: false
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2500
  }
})
