async function run() {
  try {
    const res = await fetch('https://mcp.seade.gov.br/mcp?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543', {
        method: 'POST'
    });
    const sessionId = await res.text();
    console.log("SESSION ID:", sessionId);

    const callRes = await fetch('https://mcp.seade.gov.br/mcp/empreendedorismo/tools/call', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'mcp-session-id': sessionId
        },
        body: JSON.stringify({
            name: 'agregar_dados',
            args: {
                dataset_id: 'empresas-sp-mar26-20260522',
                agrupar_por: ['Setor de atividade econômica'],
                agregacoes: [{ coluna: 'CNPJ', funcao: 'CONTAGEM' }],
                filtros: [
                  { coluna: 'Nome do município', operador: '=', valor: 'JUNDIAÍ' },
                  { coluna: 'Situacao cadastral', operador: '=', valor: 'Inativa' },
                  { coluna: 'Data do fechamento', operador: 'LIKE', valor: '2025%' }
                ]
              }
        })
    });
    const data = await callRes.text();
    console.log("RESPONSE:", data);
  } catch (e) {
    console.error('ERRO:', e);
  }
}
run();
