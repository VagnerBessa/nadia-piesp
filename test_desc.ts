async function run() {
  try {
    const res = await fetch('https://mcp.seade.gov.br/mcp?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543', { method: 'POST' });
    const sessionId = await res.text();

    const callRes = await fetch('https://mcp.seade.gov.br/mcp/empreendedorismo/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'mcp-session-id': sessionId },
        body: JSON.stringify({
            name: 'descrever_dataset',
            args: { dataset_id: 'empresas-sp-mar26-20260522' }
        })
    });
    const data = await callRes.text();
    console.log("RESPONSE:", data);
  } catch (e) {
    console.error('ERRO:', e);
  }
}
run();
