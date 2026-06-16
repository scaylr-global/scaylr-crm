import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/scaylr-crm/',
  server: {
    port: 5173,
  },
});
