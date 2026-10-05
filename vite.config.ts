import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // React + Supabase come to ~520 kB (~150 kB gzipped), which is fine for this app.
  build: { chunkSizeWarningLimit: 600 },
})
