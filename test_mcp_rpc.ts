async function run() {
  try {
    const URL = 'https://mcp.seade.gov.br/mcp?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543';
    // Initialize
    const initRes = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
        id: 1
      })
    });
    const sessionId = initRes.headers.get('mcp-session-id');
    console.log("SESSION ID:", sessionId);
    if (initRes.body) await initRes.body.cancel();

    // Call Tool
    const callRes = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'mcp-session-id': sessionId || '' },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "tools/call",
          params: {
            name: 'agregar_dados',
            arguments: {
                dataset_id: 'empresas-sp-mar26-20260522',
                agrupar_por: ['Setor de atividade econômica'],
                agregacoes: [{ coluna: 'CNPJ', funcao: 'CONTAGEM' }],
                filtros: [
                  { coluna: 'Nome do município', operador: '=', valor: 'JUNDIAÍ' },
                  { coluna: 'Situacao cadastral', operador: '=', valor: 'Baixada' },
                  { coluna: 'Data do fechamento', operador: 'LIKE', valor: '2025%' }
                ]
            }
          },
          id: 2
        })
    });
    
    if (callRes.body) {
        const reader = callRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (value) {
                buffer += decoder.decode(value, { stream: true });
                console.log("STREAM:", buffer);
            }
            if (done) break;
        }
    }
  } catch (e) {
    console.error('ERRO:', e);
  }
}
run();
