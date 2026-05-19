import fs from 'fs';

// Mock PIESP_DATA because we can't import the .ts file directly easily due to vite/TS restrictions
const data = fs.readFileSync('knowledge_base/piesp_confirmados_com_valor.csv', 'utf-8');
const linhas = data.split('\n');

function limparValor(v) {
  if (!v) return 0;
  return parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0;
}

let resultados = [];
for (let i = 1; i < linhas.length; i++) {
  const colunas = linhas[i].split(';');
  if (colunas.length < 16) continue;
  
  const periodoLinha = colunas[15]?.trim() || '';
  let invInicio = 0, invFim = 0;
  if (periodoLinha) {
    const parts = periodoLinha.split('-');
    invInicio = parseInt(parts[0], 10) || 0;
    invFim = parseInt(parts[1], 10) || invInicio;
  }
  
  const reqInicio = 2026;
  const reqFim = 9999;
  
  if (invInicio === 0) continue;
  if (invInicio < reqInicio || invFim > reqFim) continue;
  
  resultados.push({
    val: parseFloat(colunas[5]) || 0
  });
}
console.log('Total projetos:', resultados.length);
console.log('Total R$:', resultados.reduce((acc, curr) => acc + curr.val, 0));
