#!/usr/bin/env node
/**
 * Nadia-PIESP MCP Server
 *
 * Expõe os dados da PIESP (Pesquisa de Investimentos no Estado de São Paulo)
 * via Model Context Protocol para qualquer cliente compatível:
 * - Modo stdio (padrão): Claude Desktop, Cursor, Windsurf
 * - Modo HTTP (PORT=XXXX): Hermes Agent, clientes de rede
 *
 * Uso:
 *   node dist/index.js                  # stdio
 *   PORT=3456 node dist/index.js        # HTTP + SSE em :3456
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';

import {
  consultarProjetos,
  consultarAnunciosSemValor,
  filtrarParaRelatorio,
  getMetadados,
  buscarEmpresa,
} from './piespService.js';

// ─── Definição das tools ───────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'consultar_projetos_piesp',
    description:
      'Consulta projetos de investimento confirmados na PIESP com valor declarado. ' +
      'Retorna os 10 maiores por valor. Use para perguntas sobre empresas, municípios ou termos específicos.',
    inputSchema: {
      type: 'object',
      properties: {
        ano: {
          type: 'string',
          description: 'Ano de anúncio do investimento (ex: "2024"). Omita para todos os anos.',
        },
        municipio: {
          type: 'string',
          description: 'Nome ou parte do nome do município (ex: "Campinas", "São José"). Busca por substring.',
        },
        termo_busca: {
          type: 'string',
          description: 'Termo livre para busca em empresa, setor e descrição (ex: "automóveis", "energia solar").',
        },
      },
    },
  },
  {
    name: 'consultar_anuncios_sem_valor',
    description:
      'Consulta anúncios de investimento confirmados na PIESP sem valor declarado. ' +
      'Útil para complementar análises quando o valor não foi divulgado pela empresa.',
    inputSchema: {
      type: 'object',
      properties: {
        ano: {
          type: 'string',
          description: 'Ano de anúncio (ex: "2024").',
        },
        municipio: {
          type: 'string',
          description: 'Nome ou parte do nome do município.',
        },
        termo_busca: {
          type: 'string',
          description: 'Termo livre para busca em empresa, setor e descrição.',
        },
      },
    },
  },
  {
    name: 'filtrar_para_relatorio',
    description:
      'Filtra investimentos e retorna agregações completas: total de projetos, valor somado, ' +
      'e rankings por setor, município, região e ano. Use para análises e relatórios temáticos.',
    inputSchema: {
      type: 'object',
      properties: {
        setor: {
          type: 'string',
          enum: ['Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços'],
          description: 'Setor econômico. Use get_metadados para ver todos os valores disponíveis.',
        },
        regiao: {
          type: 'string',
          description: 'Região Administrativa do Estado de SP (ex: "Campinas", "Ribeirão Preto").',
        },
        ano: {
          type: 'string',
          description: 'Ano de anúncio (ex: "2024").',
        },
        tipo: {
          type: 'string',
          enum: ['Implantação', 'Ampliação', 'Modernização', 'Ampliação/Modernização'],
          description: 'Tipo de investimento.',
        },
        municipio: {
          type: 'string',
          description: 'Nome ou parte do nome do município.',
        },
        termo_busca: {
          type: 'string',
          description: 'Termo livre para busca em empresa, setor e descrição.',
        },
      },
    },
  },
  {
    name: 'get_metadados',
    description:
      'Retorna os valores únicos disponíveis na base PIESP: setores, regiões administrativas, ' +
      'anos e tipos de investimento. Use antes de filtrar para conhecer as opções válidas.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'buscar_empresa',
    description:
      'Busca todos os investimentos de uma empresa específica na PIESP. ' +
      'Retorna projetos, valor total e agregações por setor, município, região e ano.',
    inputSchema: {
      type: 'object',
      properties: {
        nome_empresa: {
          type: 'string',
          description: 'Nome ou parte do nome da empresa investidora (ex: "Volkswagen", "Petrobras").',
        },
      },
      required: ['nome_empresa'],
    },
  },
];

// ─── Criação do servidor MCP ───────────────────────────────────────────────────

const server = new Server(
  { name: 'nadia-piesp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'consultar_projetos_piesp':
        result = consultarProjetos(args as { ano?: string; municipio?: string; termo_busca?: string });
        break;

      case 'consultar_anuncios_sem_valor':
        result = consultarAnunciosSemValor(args as { ano?: string; municipio?: string; termo_busca?: string });
        break;

      case 'filtrar_para_relatorio':
        result = filtrarParaRelatorio(args as {
          setor?: string; regiao?: string; ano?: string;
          tipo?: string; municipio?: string; termo_busca?: string;
        });
        break;

      case 'get_metadados':
        result = getMetadados();
        break;

      case 'buscar_empresa': {
        const { nome_empresa } = args as { nome_empresa: string };
        if (!nome_empresa) throw new Error('Parâmetro obrigatório: nome_empresa');
        result = buscarEmpresa(nome_empresa);
        break;
      }

      default:
        throw new Error(`Tool desconhecida: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Erro: ${message}` }],
      isError: true,
    };
  }
});

// ─── Transporte: stdio ou HTTP/SSE ────────────────────────────────────────────

const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

if (HTTP_PORT) {
  // ── Modo HTTP + SSE (Hermes Agent, clientes de rede) ──────────────────────
  const app = express();
  app.use(express.json());

  // Mapa de transports ativos por sessionId
  const transports = new Map<string, SSEServerTransport>();

  // Endpoint SSE: o cliente se conecta aqui e mantém a stream aberta
  app.get('/sse', async (_req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);

    transport.onclose = () => {
      transports.delete(transport.sessionId);
    };

    await server.connect(transport);
  });

  // Endpoint POST: o cliente envia mensagens MCP aqui
  app.post('/messages', async (req, res) => {
    const sessionId = req.query['sessionId'] as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: 'Sessão não encontrada. Conecte-se em /sse primeiro.' });
      return;
    }

    await transport.handlePostMessage(req, res, req.body);
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'nadia-piesp-mcp',
      version: '1.0.0',
      activeSessions: transports.size,
    });
  });

  app.listen(HTTP_PORT, () => {
    process.stderr.write(`[piesp-mcp] ✅ HTTP server rodando na porta ${HTTP_PORT}\n`);
    process.stderr.write(`[piesp-mcp] SSE endpoint : http://localhost:${HTTP_PORT}/sse\n`);
    process.stderr.write(`[piesp-mcp] Health check : http://localhost:${HTTP_PORT}/health\n`);
  });
} else {
  // ── Modo stdio (Claude Desktop, Cursor, IDEs) ─────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[piesp-mcp] ✅ Rodando em modo stdio\n');
}
