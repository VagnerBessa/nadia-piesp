/**
 * Serviço de integração com MCP (Model Context Protocol) Server
 *
 * Este serviço permite fazer requisições HTTP ao servidor MCP
 * para buscar informações sobre tópicos específicos.
 */

const MCP_SERVER_URL = 'http://localhost:5678/mcp-server/http';

export interface McpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface McpResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Faz uma requisição HTTP através do servidor MCP
 */
export async function mcpHttpRequest(request: McpRequest): Promise<McpResponse> {
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('MCP request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Detecta se o texto contém gatilhos relacionados a papel e celulose
 */
export function detectPapelCeluloseTopics(text: string): boolean {
  const keywords = [
    'papel',
    'celulose',
    'papelão',
    'papel e celulose',
    'indústria papeleira',
    'produção de papel',
    'fabricação de papel',
    'setor de papel',
    'papel kraft',
    'papel reciclado',
  ];

  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Busca informações sobre papel e celulose através do MCP
 * (Você pode personalizar esta função para fazer a requisição específica que seu MCP espera)
 */
export async function fetchPapelCeluloseData(query: string): Promise<McpResponse> {
  // Exemplo de requisição - ajuste conforme a API do seu MCP
  return mcpHttpRequest({
    method: 'GET',
    url: `/search?q=${encodeURIComponent(query)}&topic=papel-celulose`,
    headers: {
      'Accept': 'application/json',
    },
  });
}
