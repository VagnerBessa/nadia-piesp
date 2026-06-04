const MCP_SERVER_URL = '/mcp-api?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543';

let mcpSessionId: string | null = null;

async function initializeMcpSession() {
  if (mcpSessionId) return;

  const initRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nadia-empreendedorismo-mobile', version: '1.0.0' },
      },
      id: Date.now(),
    }),
  });

  if (!initRes.ok) {
    throw new Error(`MCP initialize HTTP ${initRes.status}`);
  }

  mcpSessionId = initRes.headers.get('mcp-session-id');
  if (!mcpSessionId) {
    throw new Error('MCP initialize sem session id');
  }

  if (initRes.body) await readSseBody(initRes.body);
  else await initRes.text();

  const notificationRes = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': mcpSessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    }),
  });

  if (!notificationRes.ok) {
    const body = await notificationRes.text().catch(() => '');
    throw new Error(`MCP initialized notification HTTP ${notificationRes.status}: ${body}`);
  }

  if (notificationRes.body) {
    const reader = notificationRes.body.getReader();
    await reader.cancel().catch(() => {});
  }
}

const COLUMN_MAP: Record<string, string> = {
  'cnpj': 'CNPJ',
  'data do inicio de atividade': 'Data do início de atividade',
  'data do fechamento': 'Data do fechamento',
  'nome do municipio': 'Nome do município',
  'municipio': 'Nome do município',
  'regiao administrativa': 'Região Administrativa',
  'regiao': 'Região Administrativa',
  'setor de atividade economica': 'Setor de atividade econômica',
  'setor': 'Setor de atividade econômica',
  'atividade economica': 'Atividade econômica',
  'porte da empresa': 'Porte da empresa',
  'porte': 'Porte da empresa',
  'opcao mei': 'Opção MEI',
  'sexo': 'Sexo',
  'natureza juridica': 'Natureza jurídica',
  'situacao cadastral': 'Situacao cadastral',
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .trim();
}

function normalizeColumn(column: string): string {
  if (!column || column === '*') return 'CNPJ';
  return COLUMN_MAP[normalizeKey(column)] || column;
}

function normalizeFilter(filter: any) {
  const coluna = normalizeColumn(filter.coluna);
  let valor = typeof filter.valor === 'string' ? filter.valor.trim() : filter.valor;

  if (coluna === 'Porte da empresa' && typeof valor === 'string' && normalizeKey(valor) === 'mei') {
    return { ...filter, coluna: 'Opção MEI', operador: '=', valor: 'Sim' };
  }

  if (coluna === 'Opção MEI' && typeof valor === 'string') {
    const normalized = normalizeKey(valor);
    if (['s', 'sim', 'mei', 'microempreendedor individual'].includes(normalized)) valor = 'Sim';
    if (['n', 'nao'].includes(normalized)) valor = 'Não';
    if (normalized.includes('nao se aplica')) valor = 'Não se aplica';
  }

  if (coluna === 'Sexo' && typeof valor === 'string') {
    const normalized = normalizeKey(valor);
    if (['m', 'masculino', 'homem', 'homens'].includes(normalized)) valor = 'Homem';
    if (['f', 'feminino', 'mulher', 'mulheres'].includes(normalized)) valor = 'Mulher';
  }

  return { ...filter, coluna, valor };
}

function normalizeSql(query: string): string {
  return query
    .replace(/"Opção MEI"\s*=\s*'S'/gi, `"Opção MEI" = 'Sim'`)
    .replace(/"Opção MEI"\s*=\s*"S"/gi, `"Opção MEI" = 'Sim'`)
    .replace(/"Opção MEI"\s*=\s*'N'/gi, `"Opção MEI" = 'Não'`)
    .replace(/"Opção MEI"\s*=\s*"N"/gi, `"Opção MEI" = 'Não'`)
    .replace(/"Porte da empresa"\s*=\s*'MEI'/gi, `"Opção MEI" = 'Sim'`)
    .replace(/"Porte da empresa"\s*=\s*"MEI"/gi, `"Opção MEI" = 'Sim'`)
    .replace(/"Sexo"\s*=\s*'M'/gi, `"Sexo" = 'Homem'`)
    .replace(/"Sexo"\s*=\s*"M"/gi, `"Sexo" = 'Homem'`)
    .replace(/"Sexo"\s*=\s*'F'/gi, `"Sexo" = 'Mulher'`)
    .replace(/"Sexo"\s*=\s*"F"/gi, `"Sexo" = 'Mulher'`);
}

function normalizeArgs(toolName: string, args: any) {
  const safeArgs = { ...args };

  if (toolName === 'agregar_dados' || toolName === 'buscar_dados') {
    if (Array.isArray(safeArgs.agregacoes)) {
      safeArgs.agregacoes = safeArgs.agregacoes.map((agg: any) => ({
        ...agg,
        coluna: normalizeColumn(agg.coluna),
      }));
    }
    if (Array.isArray(safeArgs.filtros)) {
      safeArgs.filtros = safeArgs.filtros.map(normalizeFilter);
    }
    if (Array.isArray(safeArgs.agrupar_por)) {
      safeArgs.agrupar_por = safeArgs.agrupar_por.map(normalizeColumn);
    }
  }

  if (toolName === 'executar_sql' && typeof safeArgs.query === 'string') {
    safeArgs.query = normalizeSql(safeArgs.query);
  }

  return safeArgs;
}

async function postToolCall(toolName: string, args: any) {
  return fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': mcpSessionId || '',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: normalizeArgs(toolName, args),
      },
      id: Date.now(),
    }),
  });
}

export async function callMcpTool(toolName: string, args: any): Promise<any> {
  try {
    await initializeMcpSession();

    let response = await postToolCall(toolName, args);
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      mcpSessionId = null;
      await initializeMcpSession();
      response = await postToolCall(toolName, args);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { success: false, error: `MCP HTTP ${response.status}: ${body}` };
    }

    const text = response.body
      ? await readSseBody(response.body)
      : await response.text();
    const result = parseSseResult(text);
    return result;
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro desconhecido no MCP' };
  }
}

async function readSseBody(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return buffer;
}

function parseSseResult(text: string): any {
  const line = text.split('\n').map(l => l.trim()).find(l => l.startsWith('data: '));
  if (!line) return { success: false, error: 'Resposta MCP sem evento data' };

  const json = JSON.parse(line.substring(6));
  if (json.error) return { success: false, error: json.error.message || JSON.stringify(json.error) };

  const content = json.result?.content?.[0]?.text;
  if (json.result?.isError) return { success: true, error: content || 'Erro na ferramenta MCP' };
  if (!content) return { success: true, ...json.result };

  try {
    const parsed = JSON.parse(content);
    return { success: true, data: parsed, ...parsed };
  } catch {
    return { success: true, text: content };
  }
}
