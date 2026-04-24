import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import duckdb from 'duckdb';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const KNOWLEDGE_BASE_DIR = join(PROJECT_ROOT, 'knowledge_base');
const PARQUET_PATH = join(KNOWLEDGE_BASE_DIR, 'piesp.parquet');
const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '127.0.0.1';

// Inicializa o banco de dados DuckDB (Em memória, lendo o Parquet)
const db = new duckdb.Database(':memory:');

async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (params.length === 0) {
      db.all(sql, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    } else {
      db.all(sql, params, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    }
  });
}

// Inicializa a view do Parquet para acesso rápido
await query(`CREATE VIEW piesp AS SELECT * FROM read_parquet('${PARQUET_PATH}')`);

function normalizarRegiao(texto = '') {
  return texto
    .toLowerCase()
    .replace(/regi[aã]o administrativa d[eoa]?\s*/i, 'ra ')
    .replace(/\bra de\b/gi, 'ra')
    .replace(/\s+/g, ' ')
    .trim();
}

async function consultarProjetosPiesp({ ano, municipio, regiao, setor, termo_busca }) {
  let sql = `SELECT * FROM piesp WHERE fonte = 'COM_VALOR'`;
  const params = [];

  if (ano) {
    sql += ` AND anuncio_ano = ?`;
    params.push(parseInt(ano));
  }
  if (municipio) {
    sql += ` AND lower(municipio) LIKE ?`;
    params.push(`%${municipio.toLowerCase()}%`);
  }
  if (setor) {
    sql += ` AND lower(setor_desc) = ?`;
    params.push(setor.toLowerCase());
  }
  if (regiao) {
    // Para região, mantemos a lógica de normalização se possível via SQL
    sql += ` AND (lower(regiao) LIKE ? OR ? LIKE lower(regiao))`;
    const regNorm = normalizarRegiao(regiao);
    params.push(`%${regNorm}%`);
    params.push(`%${regNorm}%`);
  }
  if (termo_busca) {
    sql += ` AND (lower(empresa_alvo) LIKE ? 
             OR lower(descr_investimento) LIKE ? 
             OR lower(setor_desc) LIKE ? 
             OR lower(cnae_inv_codigo) LIKE ? 
             OR lower(cnae_inv_descricao) LIKE ?)`;
    const t = `%${termo_busca.toLowerCase()}%`;
    params.push(t, t, t, t, t);
  }

  sql += ` ORDER BY reais_milhoes DESC LIMIT 10`;

  const rows = await query(sql, params);
  
  return {
    total: rows.length, // Simplificado, ideal seria um COUNT(*) separado se precisarmos do total real
    projetos: rows.map(r => ({
      empresa: r.empresa_alvo,
      municipio: r.municipio || 'Não informado',
      regiao: r.regiao || 'Não informada',
      ano: String(r.anuncio_ano),
      setor: r.setor_desc,
      tipo: r.tipo,
      cnae_codigo: r.cnae_inv_codigo,
      cnae_descricao: r.cnae_inv_descricao,
      ano_inicio: r.investimento_ano_inicio,
      ano_fim: r.investimento_ano_fim,
      descricao: r.descr_investimento?.substring(0, 200),
      valor_milhoes_reais: r.reais_milhoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    })),
  };
}

async function consultarAnunciosSemValor({ ano, municipio, termo_busca }) {
  let sql = `SELECT * FROM piesp WHERE fonte = 'SEM_VALOR'`;
  const params = [];

  if (ano) {
    sql += ` AND anuncio_ano = ?`;
    params.push(parseInt(ano));
  }
  if (municipio) {
    sql += ` AND lower(municipio) LIKE ?`;
    params.push(`%${municipio.toLowerCase()}%`);
  }
  if (termo_busca) {
    sql += ` AND (lower(empresa_alvo) LIKE ? 
             OR lower(descr_investimento) LIKE ?
             OR lower(cnae_inv_codigo) LIKE ? 
             OR lower(cnae_inv_descricao) LIKE ?)`;
    const t = `%${termo_busca.toLowerCase()}%`;
    params.push(t, t, t, t);
  }

  sql += ` LIMIT 10`;
  const rows = await query(sql, params);

  return {
    total: rows.length,
    projetos: rows.map(r => ({
      empresa: r.empresa_alvo,
      municipio: r.municipio || 'Não informado',
      ano: String(r.anuncio_ano),
      setor: r.setor_desc,
      cnae_codigo: r.cnae_inv_codigo,
      cnae_descricao: r.cnae_inv_descricao,
      ano_inicio: r.investimento_ano_inicio,
      ano_fim: r.investimento_ano_fim,
      descricao: r.descr_investimento?.substring(0, 200),
    })),
  };
}

async function filtrarParaRelatorio({ setor, regiao, ano, tipo, municipio, termo_busca }) {
  let where = `WHERE fonte = 'COM_VALOR'`;
  const params = [];

  const addFilter = (col, val, exact = true) => {
    if (!val) return;
    const vals = Array.isArray(val) ? val : [val];
    if (vals.length === 0) return;

    if (exact) {
      where += ` AND ${col} IN (${vals.map(() => '?').join(',')})`;
      params.push(...vals);
    } else {
      where += ` AND (${vals.map(() => `lower(${col}) LIKE ?`).join(' OR ')})`;
      params.push(...vals.map(v => `%${v.toLowerCase()}%`));
    }
  };

  addFilter('anuncio_ano', ano);
  addFilter('setor_desc', setor);
  addFilter('tipo', tipo);
  addFilter('municipio', municipio, false);
  
  if (regiao) {
    const regioes = Array.isArray(regiao) ? regiao : [regiao];
    where += ` AND (${regioes.map(() => `lower(regiao) LIKE ?`).join(' OR ')})`;
    params.push(...regioes.map(r => `%${normalizarRegiao(r)}%`));
  }

  if (termo_busca) {
    where += ` AND (lower(empresa_alvo) LIKE ? 
               OR lower(descr_investimento) LIKE ?
               OR lower(cnae_inv_codigo) LIKE ? 
               OR lower(cnae_inv_descricao) LIKE ?)`;
    const t = `%${termo_busca.toLowerCase()}%`;
    params.push(t, t, t, t);
  }

  // 1. Projetos principais
  const projetos = await query(`SELECT * FROM piesp ${where} ORDER BY reais_milhoes DESC LIMIT 20`, params);
  
  // 2. Totais
  const totals = await query(`SELECT count(*) as total, sum(reais_milhoes) as totalMilhoes FROM piesp ${where}`, params);

  // 3. Agrupamentos (usando DuckDB GROUP BY que é muito mais rápido)
  const agrupar = async (col) => {
    return query(`
      SELECT ${col} as nome, sum(reais_milhoes) as valor, count(*) as count 
      FROM piesp ${where} 
      GROUP BY 1 ORDER BY valor DESC LIMIT 8
    `, params);
  };

  const porSetor = await agrupar('setor_desc');
  const porMunicipio = await agrupar('municipio');
  const porRegiao = await agrupar('regiao');
  const porAno = await query(`
    SELECT CAST(anuncio_ano AS VARCHAR) as nome, sum(reais_milhoes) as valor, count(*) as count 
    FROM piesp ${where} 
    GROUP BY 1 ORDER BY 1 ASC
  `, params);

  return {
    total: totals[0].total,
    totalMilhoes: Math.round((totals[0].totalMilhoes || 0) * 10) / 10,
    projetos: projetos.map(r => ({
      empresa: r.empresa_alvo,
      municipio: r.municipio,
      regiao: r.regiao,
      ano: String(r.anuncio_ano),
      setor: r.setor_desc,
      tipo: r.tipo,
      cnae_codigo: r.cnae_inv_codigo,
      cnae_descricao: r.cnae_inv_descricao,
      ano_inicio: r.investimento_ano_inicio,
      ano_fim: r.investimento_ano_fim,
      descricao: r.descr_investimento?.substring(0, 300),
      valor_milhoes_reais: r.reais_milhoes.toLocaleString('pt-BR'),
    })),
    porSetor: porSetor.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porMunicipio: porMunicipio.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porRegiao: porRegiao.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porAno: porAno.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
  };
}

async function getMetadados() {
  const setores = await query(`SELECT DISTINCT setor_desc FROM piesp WHERE setor_desc IS NOT NULL ORDER BY 1`);
  const regioes = await query(`SELECT DISTINCT regiao FROM piesp WHERE regiao IS NOT NULL ORDER BY 1`);
  const anos = await query(`SELECT DISTINCT anuncio_ano FROM piesp WHERE anuncio_ano IS NOT NULL ORDER BY 1 DESC`);
  const tipos = await query(`SELECT DISTINCT tipo FROM piesp WHERE tipo IS NOT NULL ORDER BY 1`);

  return {
    setores: setores.map(r => r.setor_desc),
    regioes: regioes.map(r => r.regiao),
    anos: anos.map(r => String(r.anuncio_ano)),
    tipos: tipos.map(r => r.tipo),
  };
}

async function buscarEmpresa({ nome_empresa }) {
  const where = `WHERE (lower(empresa_alvo) LIKE ? OR lower(investidora_s) LIKE ?)`;
  const p = [`%${nome_empresa.toLowerCase()}%`, `%${nome_empresa.toLowerCase()}%`];

  const projetos = await query(`SELECT * FROM piesp ${where} ORDER BY anuncio_ano DESC, reais_milhoes DESC`, p);
  const totals = await query(`SELECT count(*) as total, sum(reais_milhoes) as totalMilhoes FROM piesp ${where}`, p);

  const agrupar = async (col) => {
    return query(`
      SELECT ${col} as nome, sum(reais_milhoes) as valor, count(*) as count 
      FROM piesp ${where} 
      GROUP BY 1 ORDER BY valor DESC LIMIT 8
    `, p);
  };

  const porSetor = await agrupar('setor_desc');
  const porMunicipio = await agrupar('municipio');
  const porRegiao = await agrupar('regiao');
  const porAno = await query(`
    SELECT CAST(anuncio_ano AS VARCHAR) as nome, sum(reais_milhoes) as valor, count(*) as count 
    FROM piesp ${where} 
    GROUP BY 1 ORDER BY 1 ASC
  `, p);

  return {
    total: totals[0].total,
    totalMilhoes: Math.round((totals[0].totalMilhoes || 0) * 10) / 10,
    projetos: projetos.map(r => ({
      empresa: r.empresa_alvo,
      municipio: r.municipio,
      regiao: r.regiao,
      ano: String(r.anuncio_ano),
      setor: r.setor_desc,
      tipo: r.tipo,
      cnae_codigo: r.cnae_inv_codigo,
      cnae_descricao: r.cnae_inv_descricao,
      ano_inicio: r.investimento_ano_inicio,
      ano_fim: r.investimento_ano_fim,
      descricao: r.descr_investimento?.substring(0, 300),
      valor_milhoes_reais: r.reais_milhoes.toLocaleString('pt-BR'),
    })),
    porSetor: porSetor.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porMunicipio: porMunicipio.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porRegiao: porRegiao.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
    porAno: porAno.map(r => ({ ...r, valor: Math.round(r.valor * 10) / 10 })),
  };
}

function toolResult(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

const server = new McpServer({ name: 'piesp-duckdb-mcp', version: '1.0.0' });

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
  async (args) => toolResult(await consultarProjetosPiesp(args)),
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
  async (args) => toolResult(await consultarAnunciosSemValor(args)),
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
  async (args) => toolResult(await filtrarParaRelatorio(args)),
);

server.registerTool(
  'get_metadados',
  { description: 'Lista setores, regiões, anos e tipos válidos presentes na base PIESP.' },
  async () => toolResult(await getMetadados()),
);

server.registerTool(
  'buscar_empresa',
  {
    description: 'Gera um dossiê de empresa com projetos, totais por ano, município, região e setor.',
    inputSchema: z.object({ nome_empresa: z.string().min(1) }),
  },
  async (args) => toolResult(await buscarEmpresa(args)),
);

async function handleMcpRequest(req, res) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const cleanup = async () => { try { await server.close(); } catch {} };
  res.on('close', cleanup);
  res.on('finish', cleanup);
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'piesp-duckdb-mcp', version: 'v0.2' }));
    return;
  }

  if (url.pathname === '/mcp') {
    try { await handleMcpRequest(req, res); } 
    catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      if (!res.writableEnded) res.end(JSON.stringify({ error: error.message }));
      console.error('[piesp-duckdb-mcp] request failed:', error);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[piesp-duckdb-mcp] listening on http://${HOST}:${PORT}`);
});
