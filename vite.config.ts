import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          // Necessário para DuckDB WASM usar SharedArrayBuffer
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Força o Rollup a usar a versão ESM do DuckDB WASM,
          // evitando que a versão CJS (com require("apache-arrow")) seja bundlada.
          '@duckdb/duckdb-wasm': path.resolve(__dirname, 'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser.mjs'),
        }
      },
      optimizeDeps: {
        exclude: ['@duckdb/duckdb-wasm'],
      },
    };
});
