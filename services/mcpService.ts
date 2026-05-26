/**
 * Serviço de integração com MCP (Model Context Protocol) Server
 *
 * Este serviço permite fazer requisições HTTP ao servidor MCP
 * para buscar informações sobre tópicos específicos.
 */

const MCP_SERVER_URL = '/mcp-api?key=sk_1070bd250a3c5a13b986d112454fa59ac0f6781185a7d543';

// Variável de memória para manter a sessão
let mcpSessionId: string | null = null;

/**
 * Inicializa a sessão com o MCP se ainda não existir.
 */
async function initializeMcpSession() {
  if (mcpSessionId) return;

  try {
    const initRes = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: { 
          protocolVersion: "2024-11-05", 
          capabilities: {}, 
          clientInfo: { name: "nadia-client", version: "1.0.0" } 
        },
        id: Date.now()
      })
    });
    
    mcpSessionId = initRes.headers.get('mcp-session-id');
    console.log('[MCP] Sessão inicializada:', mcpSessionId);
    
    // Cancela o stream de inicialização para não prender conexões no navegador
    if (initRes.body) {
      const reader = initRes.body.getReader();
      await reader.cancel();
    }
  } catch (err) {
    console.error('[MCP] Erro ao inicializar sessão:', err);
    throw err;
  }
}

/**
 * Chama uma ferramenta específica no servidor MCP de Empreendedorismo.
 */
export async function callMcpTool(toolName: string, args: any): Promise<any> {
  try {
    await initializeMcpSession();

    // ─── INTERCEPTOR E CORRETOR DE ARGUMENTOS DA IA ───
    let safeArgs = { ...args };
    
    // Mapa de correção de colunas comuns que a IA erra (sem acentos e sem underscores para facilitar o match)
    const COLUNAS_MAP: Record<string, string> = {
      'data do inicio de atividade': 'Data do início de atividade',
      'data do fechamento': 'Data do fechamento',
      'nome do municipio': 'Nome do município',
      'municipio': 'Nome do município',
      'setor de atividade economica': 'Setor de atividade econômica',
      'setor': 'Setor de atividade econômica',
      'setores': 'Setor de atividade econômica',
      'porte da empresa': 'Porte da empresa',
      'porte': 'Porte da empresa',
      'situacao cadastral': 'Situacao cadastral',
      'opcao mei': 'Opção MEI',
      'data da opcao mei': 'Data da opcao MEI',
      'regiao administrativa': 'Região Administrativa',
      'regiao': 'Região Administrativa',
      'atividade economica': 'Atividade econômica',
      'natureza juridica': 'Natureza jurídica',
      'sexo': 'Sexo',
      'cnpj': 'CNPJ'
    };

    const normalizeCol = (col: string) => {
      if (!col || col === '*') return 'CNPJ'; // Proteção contra o * do Count
      let clean = col.toLowerCase().trim();
      // Remove acentos
      clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Troca underscores por espaços
      clean = clean.replace(/_/g, ' ');
      return COLUNAS_MAP[clean] || col;
    };

    if (toolName === 'agregar_dados' || toolName === 'buscar_dados') {
      if (Array.isArray(safeArgs.agregacoes)) {
        safeArgs.agregacoes = safeArgs.agregacoes.map((agg: any) => ({
          ...agg,
          coluna: normalizeCol(agg.coluna)
        }));
      }
      if (Array.isArray(safeArgs.filtros)) {
        safeArgs.filtros = safeArgs.filtros.map((f: any) => ({
          ...f,
          coluna: normalizeCol(f.coluna)
        }));
      }
      if (Array.isArray(safeArgs.agrupamento)) {
        safeArgs.agrupamento = safeArgs.agrupamento.map(normalizeCol);
      }
    }

    let callRes = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': mcpSessionId || ''
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          arguments: safeArgs
        },
        id: Date.now()
      })
    });

    // Se a sessão expirou ou o servidor reiniciou (400/401), tentamos renovar a sessão 1 vez.
    if (!callRes.ok && (callRes.status === 400 || callRes.status === 401)) {
      console.warn(`[MCP] Erro ${callRes.status} detectado. Possível sessão expirada. Reinicializando...`);
      mcpSessionId = null;
      await initializeMcpSession();
      
      callRes = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': mcpSessionId || ''
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: toolName,
            arguments: safeArgs
          },
          id: Date.now()
        })
      });
    }

    if (!callRes.ok) {
      const errText = await callRes.text().catch(() => '');
      return { success: false, error: `Falha de comunicação com o servidor MCP (HTTP ${callRes.status}). Detalhes: ${errText}` };
    }
    
    if (callRes.body) {
      const reader = callRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              if (line.startsWith('data: ')) {
                const json = JSON.parse(line.substring(6));
                
                // Tratar erro retornado na raiz do JSON-RPC (argumentos inválidos, tool inexistente, etc)
                if (json.error) {
                  return { 
                    success: true, 
                    error: json.error.message || JSON.stringify(json.error),
                    aviso_para_ia: "MANDATÓRIO: Você passou parâmetros incorretos para a ferramenta e ocorreu um erro. Não peça desculpas ainda! Verifique os argumentos (nomes de colunas, dataset_id, tipos de dados) e TENTE CHAMAR A FERRAMENTA NOVAMENTE com os parâmetros corrigidos."
                  };
                }

                if (json.result && json.result.content && Array.isArray(json.result.content)) {
                  const contentText = json.result.content[0]?.text;
                  
                  // Tratar erro retornado dentro do result (ex: Binder Error do DuckDB)
                  if (json.result.isError) {
                     return { 
                       success: true, 
                       error: contentText,
                       aviso_para_ia: "MANDATÓRIO: Erro na consulta SQL interna. Não peça desculpas ainda! Verifique o nome da coluna ou sintaxe. NUNCA use '*' para contagens (use 'cnpj'). CHAME A FERRAMENTA NOVAMENTE com a correção."
                     };
                  }

                  if (contentText) {
                    try {
                      const parsed = JSON.parse(contentText);
                      return { success: true, data: parsed, ...parsed };
                    } catch (e) {
                      return { success: true, text: contentText };
                    }
                  }
                }
                return { success: true, ...json.result };
              }
            }
            buffer = lines[lines.length - 1];
          }
          if (done) break;
        }
      } finally {
        await reader.cancel();
      }
    } else {
      const text = await callRes.text();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const json = JSON.parse(line.trim().substring(6));
          return { success: true, ...json.result };
        }
      }
    }
    
    return { success: false, error: "Falha ao extrair dados da resposta SSE" };
  } catch (error) {
    console.error(`[MCP] Erro ao chamar tool ${toolName}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}
