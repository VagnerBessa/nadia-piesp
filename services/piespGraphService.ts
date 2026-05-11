import { getDbConnection } from './duckdbService';
import { canonicalSetor } from './piespDataService';

export type NodeType = 'investidora' | 'empresa_alvo' | 'municipio' | 'setor';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  valor_total: number;
  count: number;
  count_sem_valor: number;
  ano_min?: number;
  ano_max?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  count: number;
  tem_valor: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    total_projetos: number;
    total_com_valor: number;
    total_sem_valor: number;
    total_valor_milhoes: number;
    total_nos_disponiveis: number;
    no_central?: string;
  };
}

interface RawRow {
  empresa_alvo: string | null;
  investidora_s: string | null;
  municipio: string | null;
  setor_desc: string | null;
  reais_milhoes: number | null;
  anuncio_ano: number | null;
}

function buildGraphFromRecords(rows: RawRow[], noCentral?: string): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  function addNode(id: string, type: NodeType, valor: number, temValor: boolean, ano?: number | null) {
    const n = nodesMap.get(id);
    if (n) {
      n.valor_total += valor;
      n.count += 1;
      if (!temValor) n.count_sem_valor += 1;
      if (ano) {
        if (!n.ano_min || ano < n.ano_min) n.ano_min = ano;
        if (!n.ano_max || ano > n.ano_max) n.ano_max = ano;
      }
    } else {
      nodesMap.set(id, {
        id, label: id, type,
        valor_total: valor, count: 1,
        count_sem_valor: temValor ? 0 : 1,
        ano_min: ano ?? undefined,
        ano_max: ano ?? undefined,
      });
    }
  }

  function addEdge(source: string, target: string, valor: number, temValor: boolean) {
    const key = `${source}__${target}`;
    const e = edgesMap.get(key);
    if (e) {
      e.weight += valor;
      e.count += 1;
      if (temValor) e.tem_valor = true;
    } else {
      edgesMap.set(key, { source, target, weight: valor, count: 1, tem_valor: temValor });
    }
  }

  for (const row of rows) {
    const empresa = row.empresa_alvo?.trim() || 'Desconhecida';
    const municipio = row.municipio?.trim() || '';
    const setor = canonicalSetor(row.setor_desc || '');
    const valor = (row.reais_milhoes as number) || 0;
    const temValor = valor > 0;
    const ano = row.anuncio_ano ?? undefined;

    addNode(empresa, 'empresa_alvo', valor, temValor, ano);

    if (municipio && municipio !== 'Não informado') {
      addNode(municipio, 'municipio', valor, temValor, ano);
      addEdge(empresa, municipio, valor, temValor);
    }

    if (setor && setor !== 'Outros') {
      addNode(setor, 'setor', valor, temValor, ano);
      addEdge(empresa, setor, valor, temValor);
    }

    // Split by comma OR " / " (spaced slash = list separator); bare "/" kept intact (S/A, Ltda/Me)
    if (row.investidora_s) {
      const partes = row.investidora_s.split(/,|\s+\/\s+/).map(s => s.trim()).filter(s => s.length > 3);
      for (const inv of partes) {
        if (inv === empresa) continue; // mesma entidade nos dois papéis — evita self-loop
        addNode(inv, 'investidora', valor, temValor, ano);
        addEdge(inv, empresa, valor, temValor);
      }
    }
  }

  const allNodes = Array.from(nodesMap.values())
    .sort((a, b) => b.valor_total - a.valor_total || b.count - a.count);

  const nodeIds = new Set(allNodes.map(n => n.id));
  const filteredEdges = Array.from(edgesMap.values())
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const totalValor = rows.reduce((s, r) => s + ((r.reais_milhoes as number) || 0), 0);
  const comValor = rows.filter(r => (r.reais_milhoes || 0) > 0).length;

  return {
    nodes: allNodes,
    edges: filteredEdges,
    meta: {
      total_projetos: rows.length,
      total_com_valor: comValor,
      total_sem_valor: rows.length - comValor,
      total_valor_milhoes: Math.round(totalValor * 10) / 10,
      total_nos_disponiveis: allNodes.length,
      no_central: noCentral,
    },
  };
}

function normalizeRegiao(regiao: string): string {
  return regiao.toLowerCase()
    .replace(/^ra\s+/, '')
    .replace(/^regi[aãá]o\s+(administrativa|metropolitana|admin\.?)\s+(de|do|da|dos|das)\s+/, '')
    .replace(/^regi[aãá]o\s+(de|do|da)\s+/, '')
    .replace(/^grande\s+/, '')
    .replace(/[áàãâä]/g, '_').replace(/[éèêë]/g, '_')
    .replace(/[íìîï]/g, '_').replace(/[óòõôö]/g, '_')
    .replace(/[úùûü]/g, '_').replace(/[ç]/g, '_')
    .trim();
}

function normalizeTermos(s: string): string {
  return s.toLowerCase()
    .replace(/[áàãâä]/g, '_').replace(/[éèêë]/g, '_')
    .replace(/[íìîï]/g, '_').replace(/[óòõôö]/g, '_')
    .replace(/[úùûü]/g, '_').replace(/[ç]/g, '_');
}

export async function getRedeEmpresa(nome: string): Promise<GraphData> {
  const conn = await getDbConnection();
  const pattern = `%${nome.toLowerCase()}%`;
  const stmt = await conn.prepare(
    `SELECT empresa_alvo, investidora_s, municipio, setor_desc, reais_milhoes, anuncio_ano
     FROM piesp
     WHERE LOWER(empresa_alvo) LIKE ? OR LOWER(investidora_s) LIKE ?
     LIMIT 2000`
  );
  const result = await stmt.query(pattern, pattern);
  const rows = result.toArray().map(r => r.toJSON()) as RawRow[];
  return buildGraphFromRecords(rows, nome);
}

export async function getRedeRegiao(regiao: string): Promise<GraphData> {
  const conn = await getDbConnection();
  const pattern = `%${normalizeRegiao(regiao)}%`;
  const stmt = await conn.prepare(
    `SELECT empresa_alvo, investidora_s, municipio, setor_desc, reais_milhoes, anuncio_ano
     FROM piesp
     WHERE LOWER(regiao) LIKE ? OR LOWER(municipio) LIKE ?
     LIMIT 2000`
  );
  const result = await stmt.query(pattern, pattern);
  const rows = result.toArray().map(r => r.toJSON()) as RawRow[];
  return buildGraphFromRecords(rows);
}

export async function getRedeTema(keywords: string[]): Promise<GraphData> {
  const conn = await getDbConnection();
  const campo = `LOWER(CONCAT_WS(' ', empresa_alvo, setor_desc, descr_investimento))`;
  const terms = keywords.map(normalizeTermos);
  const clauses = terms.map(() => `${campo} LIKE ?`).join(' OR ');
  const params = terms.map(t => `%${t}%`);
  const stmt = await conn.prepare(
    `SELECT empresa_alvo, investidora_s, municipio, setor_desc, reais_milhoes, anuncio_ano
     FROM piesp WHERE (${clauses}) LIMIT 2000`
  );
  const result = await stmt.query(...params);
  const rows = result.toArray().map(r => r.toJSON()) as RawRow[];
  return buildGraphFromRecords(rows);
}

export async function getRedeQuery(filtros: {
  investidora?: string;
  empresa_alvo?: string;
  municipio?: string;
  setor?: string;
  regiao?: string;
  ano?: string;
  termo_busca?: string;
}): Promise<GraphData> {
  const conn = await getDbConnection();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filtros.investidora) {
    conditions.push(`LOWER(investidora_s) LIKE ?`);
    params.push(`%${filtros.investidora.toLowerCase()}%`);
  }
  if (filtros.empresa_alvo) {
    conditions.push(`LOWER(empresa_alvo) LIKE ?`);
    params.push(`%${filtros.empresa_alvo.toLowerCase()}%`);
  }
  if (filtros.ano) {
    conditions.push(`anuncio_ano = ?`);
    params.push(parseInt(filtros.ano));
  }
  if (filtros.municipio) {
    conditions.push(`LOWER(municipio) LIKE ?`);
    params.push(`%${filtros.municipio.toLowerCase()}%`);
  }
  if (filtros.regiao) {
    const r = normalizeRegiao(filtros.regiao);
    conditions.push(`(LOWER(regiao) LIKE ? OR LOWER(municipio) LIKE ?)`);
    params.push(`%${r}%`, `%${r}%`);
  }
  if (filtros.setor) {
    conditions.push(`LOWER(setor_desc) LIKE ?`);
    params.push(`%${filtros.setor.toLowerCase()}%`);
  }
  if (filtros.termo_busca) {
    const campo = `LOWER(CONCAT_WS(' ', empresa_alvo, setor_desc, descr_investimento))`;
    const termos = filtros.termo_busca.split(',').map(s => normalizeTermos(s.trim())).filter(Boolean);
    const termClauses = termos.map(() => `${campo} LIKE ?`).join(' OR ');
    conditions.push(`(${termClauses})`);
    termos.forEach(t => params.push(`%${t}%`));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = await conn.prepare(
    `SELECT empresa_alvo, investidora_s, municipio, setor_desc, reais_milhoes, anuncio_ano
     FROM piesp ${where} LIMIT 2000`
  );
  const result = await stmt.query(...params);
  const rows = result.toArray().map(r => r.toJSON()) as RawRow[];
  return buildGraphFromRecords(rows);
}
