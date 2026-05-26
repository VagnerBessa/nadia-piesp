import { callMcpTool } from './services/mcpService';

async function test() {
  console.log("Testing agregar_dados...");
  const result = await callMcpTool('agregar_dados', {
    dataset_id: 'empresas-sp-mar26-20260522',
    agregacoes: [{ coluna: 'cnpj', funcao: 'CONTAGEM' }]
  });
  console.log("Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);
