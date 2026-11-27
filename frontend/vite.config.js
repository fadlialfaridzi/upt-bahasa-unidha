import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Izinkan akses lewat port-forward/tunnel (khusus server dev), mis. VS Code Dev Tunnels, ngrok, Cloudflare
    allowedHosts: ['.devtunnels.ms', '.ngrok-free.app', '.ngrok.app', '.trycloudflare.com', '.loca.lt'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Berkas unggahan publik (mis. bukti TOEFL) ikut lewat proxy saat VITE_API_URL=/api
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
