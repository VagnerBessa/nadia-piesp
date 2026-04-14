// =================================================================================
//  CONFIGURAÇÃO DE CHAVES DE API
// =================================================================================
// As chaves são lidas de variáveis de ambiente Vite (.env).
//
// Para desenvolvimento local:
//   1. Copie .env.example para .env
//   2. Preencha com suas chaves
//   3. NUNCA faça commit do .env (já está no .gitignore)
//
// Para produção (Firebase / GitHub Actions):
//   Defina VITE_GEMINI_API_KEY e VITE_GOOGLE_MAPS_API_KEY
//   como secrets no ambiente de CI/CD — nunca no código.
//
// Este arquivo (config.ts) não precisa mais conter as chaves.
// Pode ser commitado com segurança.
// =================================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

if (!GEMINI_API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY não definida. Verifique seu arquivo .env');
}

export { GEMINI_API_KEY, GOOGLE_MAPS_API_KEY };
