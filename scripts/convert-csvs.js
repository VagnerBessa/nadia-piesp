/**
 * Converte os CSVs da PIESP de Latin-1 para UTF-8.
 * Executado automaticamente antes de `npm run dev` e `npm run build`.
 *
 * Os arquivos originais (.csv) são Latin-1 e ficam fora do git.
 * Os arquivos convertidos (.utf8.csv) também ficam fora do git.
 * Ambos devem existir localmente para o app funcionar.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB = join(__dirname, '..', 'knowledge_base');

const arquivos = [
  'piesp_confirmados_com_valor.csv',
  'piesp_confirmados_sem_valor.csv',
];

let convertidos = 0;

for (const arquivo of arquivos) {
  const origem = join(KB, arquivo);
  const destino = join(KB, arquivo.replace('.csv', '.utf8.csv'));

  if (!existsSync(origem)) {
    console.warn(`⚠️  Não encontrado: ${arquivo} — pulando`);
    continue;
  }

  const buf = readFileSync(origem);
  const texto = new TextDecoder('latin-1').decode(buf);
  writeFileSync(destino, texto, 'utf-8');
  console.log(`✓ Convertido: ${arquivo} → ${arquivo.replace('.csv', '.utf8.csv')}`);
  convertidos++;
}

if (convertidos === 0) {
  console.error('❌ Nenhum CSV convertido. Copie os arquivos para knowledge_base/ e tente novamente.');
  process.exit(1);
}

console.log(`\n✅ ${convertidos} arquivo(s) convertido(s) para UTF-8.`);
