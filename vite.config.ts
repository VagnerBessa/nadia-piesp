import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3010,
        host: '0.0.0.0',
        proxy: {
          '/mcp-api': {
            target: 'https://mcp.seade.gov.br',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/mcp-api/, '/mcp'),
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log(`[PROXY ERROR] ${err.message}`);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                // Remover headers que podem causar 403 Forbidden no WAF do Seade
                proxyReq.removeHeader('origin');
                proxyReq.removeHeader('referer');
                
                const headers = proxyReq.getHeaders();
                console.log(`\n[--> REQ] ${req.method} ${req.url}\nHeaders: ${JSON.stringify(headers)}`);
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log(`[<-- RES] ${proxyRes.statusCode} ${req.url}`);
              });
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['three'],
      },
      optimizeDeps: {
        include: ['three', 'three-spritetext'],
      }
    };
});
