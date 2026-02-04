/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Custom plugin to log Supabase environment on dev server start
function supabaseEnvLogger() {
  return {
    name: 'supabase-env-logger',
    configureServer() {
      const env = loadEnv('development', process.cwd(), 'VITE_')
      const supabaseUrl = env.VITE_SUPABASE_URL || ''
      const projectRef = supabaseUrl.split('.supabase.co')[0]?.split('//')[1] || 'unknown'
      const isDevDb = projectRef === 'kphvkkoyungqebftytkt'

      const color = isDevDb ? '\x1b[32m' : '\x1b[31m' // green or red
      const reset = '\x1b[0m'
      const bold = '\x1b[1m'

      console.log(`\n  ${color}${bold}➜  Supabase: ${isDevDb ? 'DEV' : 'PROD'} Database (${projectRef})${reset}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), supabaseEnvLogger()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
