import { getDbConnection } from './duckdbService';

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  regiao?: string;
  setor?: string;
  termo_busca?: string;
  ano_inicio?: string;
  ano_fim?: string;
  tipo?: string;
}

export interface FiltroRelatorio extends FiltroPiesp {}

export interface ProjetoResumo {
  empresa: string;
  municipio: string;
  regiao: string;
  setor: string;
  ano: string;
  periodo: string;
  valor_milhoes_reais: number;
  tipo: string;
  descricao: string;
  ano_inicio?: number;
  ano_fim?: number;
}

export interface ResumoRelatorio {
  total_investimentos: number;
  total_projetos: number;
  setores: { nome: string; valor: number; count: number }[];
  regioes: { nome: string; valor: number; count: number }[];
  municipios: { nome: string; valor: number; count: number }[];
  evolucao_anual: { nome: string; valor: number; count: number }[];
  projetos: ProjetoResumo[];
}

export function canonicalSetor(s: string): string {
  const l = s?.toLowerCase() || '';
  if (l.includes('infraestrutura')) return 'Infraestrutura';
  if (l.includes('ind') && l.includes('stria')) return 'Indústria';
  if (l.includes('com') && l.includes('rcio')) return 'Comércio';
  if (l.includes('servi')) return 'Serviços';
  if (l.includes('agropec')) return 'Agropecuária';
  return s || 'Outros';
}

function buildWhereClause(filtro: FiltroPiesp): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filtro.ano) {
    conditions.push(`anuncio_ano = ?`);
    params.push(parseInt(filtro.ano));
  }
  
  if (filtro.setor) {
    const s = canonicalSetor(filtro.setor);
    if (s === 'Infraestrutura') conditions.push(`LOWER(setor_desc) LIKE '%infraestrutura%'`);
    else if (s === 'Indústria') conditions.push(`LOWER(setor_desc) LIKE '%ind_stria%'`);
    else if (s === 'Comércio') conditions.push(`LOWER(setor_desc) LIKE '%com_rcio%'`);
    else if (s === 'Serviços') conditions.push(`LOWER(setor_desc) LIKE '%servi_os%'`);
    else if (s === 'Agropecuária') conditions.push(`LOWER(setor_desc) LIKE '%agropec%'`);
    else {
      conditions.push(`setor_desc = ?`);
      params.push(s);
    }
  }
  
  if (filtro.tipo) {
    conditions.push(`tipo = ?`);
    params.push(filtro.tipo);
  }
  
  if (filtro.municipio) {
    conditions.push(`LOWER(municipio) LIKE ?`);
    params.push(`%${filtro.municipio.toLowerCase()}%`);
  }
  
  // Região: strip prefixes e handle accents via wildcards
  if (filtro.regiao) {
    let r = filtro.regiao.toLowerCase()
      .replace(/^ra\s+/, '')
      .replace(/^regi[aãá]o\s+(administrativa|metropolitana|admin\.?)\s+(de|do|da|dos|das)\s+/, '')
      .replace(/^regi[aãá]o\s+(de|do|da)\s+/, '')
      .replace(/^grande\s+/, '')
      .replace(/[áàãâä]/g, '_')
      .replace(/[éèêë]/g, '_')
      .replace(/[íìîï]/g, '_')
      .replace(/[óòõôö]/g, '_')
      .replace(/[úùûü]/g, '_')
      .replace(/[ç]/g, '_')
      .trim();
    conditions.push(`(LOWER(regiao) LIKE ? OR LOWER(municipio) LIKE ?)`);
    params.push(`%${r}%`, `%${r}%`);
  }
  
  if (filtro.termo_busca) {
    let t = filtro.termo_busca.toLowerCase()
      .replace(/[áàãâä]/g, '_')
      .replace(/[éèêë]/g, '_')
      .replace(/[íìîï]/g, '_')
      .replace(/[óòõôö]/g, '_')
      .replace(/[úùûü]/g, '_')
      .replace(/[ç]/g, '_');
    conditions.push(`LOWER(CONCAT_WS(' ', empresa_alvo, setor_desc, descr_investimento, cnae_inv_2_desc, cnae_inv_descricao, cnae_empresa_descricao)) LIKE ?`);
    params.push(`%${t}%`);
  }
  
  if (filtro.ano_inicio || filtro.ano_fim) {
    const reqInicio = filtro.ano_inicio ? parseInt(filtro.ano_inicio) : 0;
    const reqFim = filtro.ano_fim ? parseInt(filtro.ano_fim) : 9999;
    
    conditions.push(`investimento_ano_inicio <= ? AND investimento_ano_fim >= ?`);
    params.push(reqFim, reqInicio);
  }
  
  const where = conditions.length > 0 ? `WHERE ` + conditions.join(' AND ') : '';
  return { where, params };
}

export async function filtrarParaRelatorio(filtro: FiltroRelatorio): Promise<ResumoRelatorio> {
  const conn = await getDbConnection();
  const { where, params } = buildWhereClause(filtro);
  
  const query = `SELECT * FROM piesp ${where}`;
  
  console.log('🦆 DuckDB Query:', query, 'Params:', params);
  
  const stmt = await conn.prepare(query);
  const result = await stmt.query(...params);
  const rows = result.toArray().map(r => r.toJSON());
  
  let totalValor = 0;
  const isPeriodo = !!(filtro.ano_inicio || filtro.ano_fim);
  
  const resultados = rows.map(r => {
    const valor = r.reais_milhoes || 0;
    totalValor += valor;
    return {
      empresa: r.empresa_alvo || 'Desconhecida',
      municipio: r.municipio || 'Não informado',
      regiao: r.regiao || 'Não informada',
      setor: canonicalSetor(r.setor_desc),
      ano: r.anuncio_ano ? r.anuncio_ano.toString() : '',
      periodo: r.periodo_original || '',
      valor_milhoes_reais: valor,
      tipo: r.tipo || '',
      descricao: r.descr_investimento || '',
      ano_inicio: r.investimento_ano_inicio
    };
  });
  
  function agrupar(chave: string) {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      const key = (r as any)[chave];
      if (!key || key === 'Desconhecida' || key === 'Não informado' || key === 'Não informada') continue;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += r.valor_milhoes_reais;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  function agruparAno() {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      let key = r.ano;
      if (isPeriodo && r.ano_inicio) {
        key = r.ano_inicio.toString();
      }
      if (!key) continue;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += r.valor_milhoes_reais;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  return {
    total_investimentos: Math.round(totalValor * 10) / 10,
    total_projetos: resultados.length,
    setores: agrupar('setor'),
    regioes: agrupar('regiao'),
    municipios: agrupar('municipio'),
    evolucao_anual: agruparAno(),
    projetos: resultados.sort((a, b) => b.valor_milhoes_reais - a.valor_milhoes_reais)
  };
}

export async function consultarPiespData(filtro: FiltroPiesp) {
  const relatorio = await filtrarParaRelatorio(filtro);
  return {
    total_projetos: relatorio.total_projetos,
    valor_total_milhoes: relatorio.total_investimentos,
    projetos: relatorio.projetos.slice(0, 10).map(p => ({
      empresa: p.empresa,
      municipio: p.municipio,
      regiao: p.regiao,
      ano: p.ano,
      setor: p.setor,
      descricao: p.descricao.substring(0, 150),
      valor_milhoes_reais: p.valor_milhoes_reais.toFixed(2).replace('.', ',')
    }))
  };
}

export async function consultarAnunciosSemValor(filtro: FiltroPiesp) {
  const conn = await getDbConnection();
  const { where, params } = buildWhereClause(filtro);
  
  const where2 = where 
    ? where + ` AND (reais_milhoes IS NULL OR reais_milhoes = 0)` 
    : `WHERE (reais_milhoes IS NULL OR reais_milhoes = 0)`;
  
  const query = `
    SELECT empresa_alvo, municipio, setor_desc, anuncio_ano, periodo_original, descr_investimento 
    FROM piesp
    ${where2}
  `;
  
  const stmt = await conn.prepare(query);
  const result = await stmt.query(...params);
  const rows = result.toArray().map(r => r.toJSON());
  
  return {
    total_anuncios: rows.length,
    anuncios: rows.slice(0, 10).map(r => ({
      empresa: r.empresa_alvo,
      municipio: r.municipio,
      setor: canonicalSetor(r.setor_desc),
      ano: r.anuncio_ano?.toString() || '',
      descricao: (r.descr_investimento || '').substring(0, 150)
    }))
  };
}

export async function getMetadados() {
  const conn = await getDbConnection();
  const [setoresResult, regioesResult, anosResult, tiposResult] = await Promise.all([
    conn.query(`SELECT DISTINCT setor_desc FROM piesp WHERE setor_desc IS NOT NULL`),
    conn.query(`SELECT DISTINCT regiao FROM piesp WHERE regiao IS NOT NULL`),
    conn.query(`SELECT DISTINCT anuncio_ano FROM piesp WHERE anuncio_ano IS NOT NULL`),
    conn.query(`SELECT DISTINCT tipo FROM piesp WHERE tipo IS NOT NULL`)
  ]);
  
  const setores = new Set<string>();
  setoresResult.toArray().forEach(r => {
    const s = canonicalSetor(r.toJSON().setor_desc);
    if (s && s !== 'Outros') setores.add(s);
  });
  
  return {
    setores: Array.from(setores).sort(),
    regioes: regioesResult.toArray().map(r => r.toJSON().regiao).sort(),
    anos: anosResult.toArray().map(r => r.toJSON().anuncio_ano?.toString()).filter(Boolean).sort().reverse(),
    tipos: tiposResult.toArray().map(r => r.toJSON().tipo).sort()
  };
}

export async function getUniqueEmpresas(): Promise<string[]> {
  const conn = await getDbConnection();
  const result = await conn.query(`SELECT DISTINCT empresa_alvo FROM piesp WHERE empresa_alvo IS NOT NULL`);
  return result.toArray().map(r => r.toJSON().empresa_alvo).filter((e: string) => e !== 'Desconhecida').sort();
}

export async function buscarEmpresaNoPiesp(nomeEmpresa: string): Promise<ResumoRelatorio> {
  return await filtrarParaRelatorio({ termo_busca: nomeEmpresa });
}
