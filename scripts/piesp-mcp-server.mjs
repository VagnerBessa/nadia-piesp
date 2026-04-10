import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const KNOWLEDGE_BASE_DIR = join(PROJECT_ROOT, 'knowledge_base');
const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '127.0.0.1';

const PIESP_COM_VALOR = readFileSync(
  join(KNOWLEDGE_BASE_DIR, 'piesp_confirmados_com_valor.csv'),
  'utf8',
);

const PIESP_SEM_VALOR = readFileSync(
  join(KNOWLEDGE_BASE_DIR, 'piesp_confirmados_sem_valor.csv'),
  'utf8',
);

const SETORES_VALIDOS = new Set([
  'Agropecuária',
  'Comércio',
  'Indústria',
  'Infraestrutura',
  'Serviços',
]);

const TIPOS_VALIDOS = new Set([
  'Implantação',
  'Ampliação',
  'Modernização',
  'Ampliação/Modernização',
]);

function normalizarRegiao(texto = '') {
  return texto
    .toLowerCase()
    .replace(/regi[aã]o administrativa d[eoa]?\s*/i, 'ra ')
    .replace(/\bra de\b/gi, 'ra')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValorMilhoes(valor = '0') {
  return parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
}

function linhaValida(cols) {
  if (cols.length < 15) return false;
  const setor = (cols[10] || '').trim();
  return SETORES_VALIDOS.has(setor);
}

function getLinhas(csvRaw) {
  return csvRaw.split('\n').filter((linha) => linha.trim().length > 0);
}

function consultarProjetosPiesp({ ano, municipio, regiao, setor, termo_busca }) {
  const linhas = getLinhas(PIESP_COM_VALOR);
  const resultados = [];

  for (let i = 1; i < linhas.length; i += 1) {
    const colunas = linhas[i].split(';');
    if (!linhaValida(colunas)) continue;

    const anoLinha = (colunas[1] || '').trim();
    const empresaLinha = (colunas[3] || 'Desconhecida').trim();
    const municipioLinha = (colunas[7] || '').trim();
    const regiaoLinha = (colunas[8] || '').trim();
    const descricaoLinha = (colunas[9] || '').trim();
    const setorLinha = (colunas[10] || 'Geral').trim();
    const tipoLinha = (colunas[14] || '').trim();
    const valorLinha = (colunas[5] || '0,00').trim();

    let match = true;

    if (ano && anoLinha !== ano) match = false;
    if (municipio && !municipioLinha.toLowerCase().includes(municipio.toLowerCase())) match = false;
    if (setor && setorLinha.toLowerCase() !== setor.toLowerCase()) match = false;

    if (regiao) {
      const regiaoFiltro = normalizarRegiao(regiao);
      const regiaoNorm = normalizarRegiao(regiaoLinha);
      if (!regiaoNorm.includes(regiaoFiltro) && !regiaoFiltro.includes(regiaoNorm)) {
        match = false;
      }
    }

    if (termo_busca) {
      const termo = termo_busca.toLowerCase();
      const textToSearch = `${empresaLinha} ${setorLinha} ${descricaoLinha}`.toLowerCase();
      if (!textToSearch.includes(termo)) match = false;
    }

    if (!match) continue;

    resultados.push({
      empresa: empresaLinha,
      municipio: municipioLinha || 'Não informado',
      regiao: regiaoLinha || 'Não informada',
      ano: anoLinha,
      setor: setorLinha,
      tipo: tipoLinha,
      descricao: descricaoLinha.substring(0, 200),
      valor_milhoes_reais: valorLinha,
    });
  }

  resultados.sort((a, b) => parseValorMilhoes(b.valor_milhoes_reais) - parseValorMilhoes(a.valor_milhoes_reais));

  return {
    total: resultados.length,
    projetos: resultados.slice(0, 10),
  };
}

function consultarAnunciosSemValor({ ano, municipio, termo_busca }) {
  const linhas = getLinhas(PIESP_SEM_VALOR);
  const resultados = [];

  for (let i = 1; i < linhas.length; i += 1) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 9) continue;

    const anoLinha = (colunas[1] || '').trim();
    const empresaLinha = (colunas[3] || 'Desconhecida').trim();
    const municipioLinha = (colunas[5] || '').trim();
    const descricaoLinha = (colunas[7] || '').trim();
    const setorLinha = (colunas[8] || 'Geral').trim();

    let match = true;

    if (ano && anoLinha !== ano) match = false;
    if (municipio && !municipioLinha.toLowerCase().includes(municipio.toLowerCase())) match = false;

    if (termo_busca) {
      const termo = termo_busca.toLowerCase();
      const textToSearch = `${empresaLinha} ${setorLinha} ${descricaoLinha}`.toLowerCase();
      if (!textToSearch.includes(termo)) match = false;
    }

    if (!match) continue;

    resultados.push({
      empresa: empresaLinha,
      municipio: municipioLinha || 'Não informado',
      ano: anoLinha,
      setor: setorLinha,
      descricao: descricaoLinha.substring(0, 200),
    });
  }

  return {
    total: resultados.length,
    projetos: resultados.slice(0, 10),
  };
}

function filtrarParaRelatorio({ setor, regiao, ano, tipo, municipio, termo_busca }) {
  const linhas = getLinhas(PIESP_COM_VALOR);
  const resultados = [];

  const checkMatch = (valor, filtroVal, exact = true) => {
    if (!filtroVal) return true;
    const arr = Array.isArray(filtroVal) ? filtroVal : [filtroVal];
    if (arr.length === 0) return true;

    const valorLower = String(valor || '').toLowerCase();

    return arr.some((item) => {
      const filtro = String(item || '').toLowerCase();
      if (!exact) {
        return valorLower.includes(filtro) || filtro.includes(valorLower);
      }
      return valorLower === filtro;
    });
  };

  for (let i = 1; i < linhas.length; i += 1) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const item = {
      empresa: (cols[3] || 'Desconhecida').trim(),
      municipio: (cols[7] || 'Não informado').trim(),
      regiao: (cols[8] || 'Não informada').trim(),
      ano: (cols[1] || '').trim(),
      setor: (cols[10] || 'Outros').trim(),
      tipo: (cols[14] || '').trim(),
      descricao: (cols[9] || '').trim().substring(0, 300),
      valor_milhoes_reais: (cols[5] || '0').trim(),
    };

    if (!checkMatch(item.ano, ano)) continue;
    if (!checkMatch(item.setor, setor)) continue;
    if (!checkMatch(item.regiao, regiao, false)) continue;
    if (!checkMatch(item.tipo, tipo)) continue;
    if (!checkMatch(item.municipio, municipio, false)) continue;

    if (termo_busca) {
      const termo = termo_busca.toLowerCase();
      const textToSearch = `${item.empresa} ${item.setor} ${item.descricao}`.toLowerCase();
      if (!textToSearch.includes(termo)) continue;
    }

    resultados.push(item);
  }

  resultados.sort((a, b) => parseValorMilhoes(b.valor_milhoes_reais) - parseValorMilhoes(a.valor_milhoes_reais));

  const totalMilhoes = resultados.reduce((acc, item) => acc + parseValorMilhoes(item.valor_milhoes_reais), 0);

  function agrupar(campo) {
    const mapa = new Map();

    for (const item of resultados) {
      const chave = item[campo];
      const atual = mapa.get(chave) || { valor: 0, count: 0 };
      atual.valor += parseValorMilhoes(item.valor_milhoes_reais);
      atual.count += 1;
      mapa.set(chave, atual);
    }

    return Array.from(mapa.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 8)
      .map(([nome, { valor, count }]) => ({
        nome,
        valor: Math.round(valor * 10) / 10,
        count,
      }));
  }

  const porAno = Array.from(
    resultados.reduce((mapa, item) => {
      const atual = mapa.get(item.ano) || { valor: 0, count: 0 };
      atual.valor += parseValorMilhoes(item.valor_milhoes_reais);
      atual.count += 1;
      mapa.set(item.ano, atual);
      return mapa;
    }, new Map()).entries(),
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nome, { valor, count }]) => ({
      nome,
      valor: Math.round(valor * 10) / 10,
      count,
    }));

  return {
    total: resultados.length,
    totalMilhoes: Math.round(totalMilhoes * 10) / 10,
    projetos: resultados.slice(0, 20),
    porSetor: agrupar('setor'),
    porMunicipio: agrupar('municipio'),
    porRegiao: agrupar('regiao'),
    porAno,
  };
}

function getMetadados() {
  const linhas = getLinhas(PIESP_COM_VALOR);
  const setores = new Set();
  const regioes = new Set();
  const anos = new Set();
  const tipos = new Set();

  for (let i = 1; i < linhas.length; i += 1) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const setor = (cols[10] || '').trim();
    const regiao = (cols[8] || '').trim();
    const ano = (cols[1] || '').trim();
    const tipo = (cols[14] || '').trim();

    if (setor && SETORES_VALIDOS.has(setor)) setores.add(setor);
    if (regiao) regioes.add(regiao);
    if (ano && /^\d{4}$/.test(ano)) anos.add(ano);
    if (tipo && TIPOS_VALIDOS.has(tipo)) tipos.add(tipo);
  }

  return {
    setores: Array.from(setores).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    regioes: Array.from(regioes).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    anos: Array.from(anos).sort().reverse(),
    tipos: Array.from(tipos).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

function buscarEmpresa(nomeEmpresa) {
  const linhas = getLinhas(PIESP_COM_VALOR);
  const resultados = [];
  const termo = nomeEmpresa.toLowerCase();

  for (let i = 1; i < linhas.length; i += 1) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const empresaLinha = (cols[3] || '').trim();
    const investidoraLinha = (cols[4] || '').trim();
    if (!empresaLinha.toLowerCase().includes(termo) && !investidoraLinha.toLowerCase().includes(termo)) {
      continue;
    }

    resultados.push({
      empresa: empresaLinha,
      municipio: (cols[7] || 'Não informado').trim(),
      regiao: (cols[8] || 'Não informada').trim(),
      ano: (cols[1] || '').trim(),
      setor: (cols[10] || 'Outros').trim(),
      tipo: (cols[14] || '').trim(),
      descricao: (cols[9] || '').trim().substring(0, 300),
      valor_milhoes_reais: (cols[5] || '0').trim(),
    });
  }

  resultados.sort((a, b) => parseValorMilhoes(b.valor_milhoes_reais) - parseValorMilhoes(a.valor_milhoes_reais));
  const totalMilhoes = resultados.reduce((acc, item) => acc + parseValorMilhoes(item.valor_milhoes_reais), 0);

  function agrupar(campo) {
    const mapa = new Map();
    for (const item of resultados) {
      const atual = mapa.get(item[campo]) || { valor: 0, count: 0 };
      atual.valor += parseValorMilhoes(item.valor_milhoes_reais);
      atual.count += 1;
      mapa.set(item[campo], atual);
    }

    return Array.from(mapa.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 8)
      .map(([nome, { valor, count }]) => ({
        nome,
        valor: Math.round(valor * 10) / 10,
        count,
      }));
  }

  const porAno = Array.from(
    resultados.reduce((mapa, item) => {
      const atual = mapa.get(item.ano) || { valor: 0, count: 0 };
      atual.valor += parseValorMilhoes(item.valor_milhoes_reais);
      atual.count += 1;
      mapa.set(item.ano, atual);
      return mapa;
    }, new Map()).entries(),
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nome, { valor, count }]) => ({
      nome,
      valor: Math.round(valor * 10) / 10,
      count,
    }));

  return {
    total: resultados.length,
    totalMilhoes: Math.round(totalMilhoes * 10) / 10,
    projetos: resultados,
    porSetor: agrupar('setor'),
    porMunicipio: agrupar('municipio'),
    porRegiao: agrupar('regiao'),
    porAno,
  };
}

function toolResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

function createMcpServer() {
  const server = new McpServer({
    name: 'piesp-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'consultar_projetos_piesp',
    {
      description: 'Filtra investimentos PIESP com valor por ano, município, região, setor e termo livre.',
      inputSchema: z.object({
        ano: z.string().optional(),
        municipio: z.string().optional(),
        regiao: z.string().optional(),
        setor: z.string().optional(),
        termo_busca: z.string().optional(),
      }),
    },
    async (args) => toolResult(consultarProjetosPiesp(args)),
  );

  server.registerTool(
    'consultar_anuncios_sem_valor',
    {
      description: 'Consulta anúncios PIESP sem cifra declarada por ano, município e termo livre.',
      inputSchema: z.object({
        ano: z.string().optional(),
        municipio: z.string().optional(),
        termo_busca: z.string().optional(),
      }),
    },
    async (args) => toolResult(consultarAnunciosSemValor(args)),
  );

  server.registerTool(
    'filtrar_para_relatorio',
    {
      description: 'Retorna agregações analíticas completas por setor, município, região, ano e tipo.',
      inputSchema: z.object({
        setor: z.union([z.string(), z.array(z.string())]).optional(),
        regiao: z.union([z.string(), z.array(z.string())]).optional(),
        ano: z.union([z.string(), z.array(z.string())]).optional(),
        tipo: z.union([z.string(), z.array(z.string())]).optional(),
        municipio: z.union([z.string(), z.array(z.string())]).optional(),
        termo_busca: z.string().optional(),
      }),
    },
    async (args) => toolResult(filtrarParaRelatorio(args)),
  );

  server.registerTool(
    'get_metadados',
    {
      description: 'Lista setores, regiões, anos e tipos válidos presentes na base PIESP.',
    },
    async () => toolResult(getMetadados()),
  );

  server.registerTool(
    'buscar_empresa',
    {
      description: 'Gera um dossiê de empresa com projetos, totais por ano, município, região e setor.',
      inputSchema: z.object({
        nome_empresa: z.string().min(1),
      }),
    },
    async ({ nome_empresa }) => toolResult(buscarEmpresa(nome_empresa)),
  );

  return server;
}

async function handleMcpRequest(req, res) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer();

  const cleanup = async () => {
    try {
      await server.close();
    } catch {}
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'piesp-mcp', transport: 'streamable-http', sessionMode: 'stateless' }));
    return;
  }

  if (url.pathname === '/mcp') {
    try {
      await handleMcpRequest(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      if (!res.writableEnded) {
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }));
      }
      console.error('[piesp-mcp] request failed:', error);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[piesp-mcp] listening on http://${HOST}:${PORT}`);
  console.log(`[piesp-mcp] health: http://${HOST}:${PORT}/health`);
  console.log(`[piesp-mcp] mcp: http://${HOST}:${PORT}/mcp`);
});
