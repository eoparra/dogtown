/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Without this, Vite bundles React's production build during tests (process.env.NODE_ENV is
  // undefined at compile time → React treats it as production). React Testing Library's act()
  // requires the development build, so this compile-time define is necessary.
  ...(mode === 'test' ? { define: { 'process.env.NODE_ENV': '"test"' } } : {}),
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ['dogtown.up.railway.app'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-helpers/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
