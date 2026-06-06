import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // In Docker Compose the server container is reachable at http://server:3001
  // On the host machine (no Docker) it's http://localhost:3001
  const proxyTarget = env.VITE_API_PROXY || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['all'],
    },
  };
});