import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true },
  '/uploads': { target: 'http://127.0.0.1:5001', changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: { host: 'localhost', port: 5173, strictPort: true, proxy },
  preview: { proxy },
})
