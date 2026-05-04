// =================================================================================
//  CONFIGURAÇÃO DE CHAVES DE API — via variáveis de ambiente Vite
// =================================================================================
// As chaves são lidas de variáveis de ambiente prefixadas com VITE_
// (expostas ao browser pelo Vite em build time).
//
// Em desenvolvimento: crie um arquivo .env na raiz com as chaves (ver .env.example)
// Em produção (Vercel/Netlify): configure as variáveis no painel da plataforma
//
// NUNCA commite o arquivo .env nem este arquivo com chaves hardcoded.
// =================================================================================

export const GEMINI_API_KEY       = (import.meta.env.VITE_GEMINI_API_KEY      || process.env.GEMINI_API_KEY      || process.env.API_KEY             || '') as string;
export const GOOGLE_MAPS_API_KEY  = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '') as string;
export const OPENROUTER_API_KEY   = (import.meta.env.VITE_OPENROUTER_API_KEY  || process.env.OPENROUTER_API_KEY  || '') as string;
