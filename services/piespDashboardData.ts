/**
 * piespDashboardData.ts
 * Serviço de agregação para o dashboard PIESP.
 * Agora usa DuckDB WASM via piespDataService (Parquet) em vez de parsear CSV.
 */
import { getDbConnection } from './duckdbService';
import { canonicalSetor } from './piespDataService';

// --- Tipos ---
export interface PiespRecord {
  ano: string;
  mes: string;
  empresa: string;
  investidora: string;
  reais_milhoes: number;
  municipio: string;
  regiao: string;
  setor: string;
  cnae2: string;
  tipo: string;
  descricao: string;
}

export interface AggItem {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

export interface DashboardData {
  totalBilhoes: string;
  totalProjetos: number;
  totalEmpresas: number;
  totalMunicipios: number;
  porAno: AggItem[];
  porMes?: AggItem[];
  porSetor: AggItem[];
  porMunicipio: AggItem[];
  porRegiao: AggItem[];
  porEmpresa: AggItem[];
  porTipo: AggItem[];
  rmspVsInterior: { rmsp: number; interior: number };
}

const MES_NAMES: Record<string, string> = {
  '1': 'Jan', '2': 'Fev', '3': 'Mar', '4': 'Abr',
  '5': 'Mai', '6': 'Jun', '7': 'Jul', '8': 'Ago',
  '9': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

// --- Paleta de cores ---
const COLORS = [
  '#f43f5e', '#22d3ee', '#34d399', '#fbbf24', '#818cf8',
  '#f97316', '#a78bfa', '#fb7185', '#2dd4bf', '#e879f9',
];

function formatBilhoes(milhoes: number): string {
  const bi = milhoes / 1000;
  return bi.toFixed(1).replace('.', ',');
}

function topNFromMap(map: Map<string, { soma: number; count: number }>, n: number): AggItem[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1].soma - a[1].soma)
    .slice(0, n)
    .map(([name, { soma, count }], i) => ({
      name,
      value: Math.round(soma * 10) / 10,
      count,
      color: COLORS[i % COLORS.length],
    }));
}

// --- Carrega records do DuckDB (async) ---
async function loadRecords(anoFilter?: string): Promise<PiespRecord[]> {
  const conn = await getDbConnection();
  const whereClause = anoFilter ? `WHERE anuncio_ano = ${parseInt(anoFilter)} AND reais_milhoes > 0` : `WHERE reais_milhoes > 0`;
  const result = await conn.query(`
    SELECT anuncio_ano, anuncio_mes, empresa_alvo, investidora_s, reais_milhoes, 
           municipio, regiao, setor_desc, cnae_inv_2_desc, tipo, descr_investimento
    FROM piesp
    ${whereClause}
  `);
  
  return result.toArray().map(r => {
    const row = r.toJSON();
    return {
      ano: row.anuncio_ano?.toString() || '',
      mes: row.anuncio_mes?.toString() || '',
      empresa: row.empresa_alvo || 'Não informada',
      investidora: row.investidora_s || '',
      reais_milhoes: row.reais_milhoes || 0,
      municipio: row.municipio || 'Não informado',
      regiao: row.regiao || 'Não informada',
      setor: canonicalSetor(row.setor_desc || ''),
      cnae2: row.cnae_inv_2_desc || '',
      tipo: row.tipo || 'Não classificado',
      descricao: row.descr_investimento || '',
    };
  });
}

// --- Funções auxiliares ---
function agruparPor(records: PiespRecord[], campo: keyof PiespRecord): Map<string, { soma: number; count: number }> {
  const map = new Map<string, { soma: number; count: number }>();
  for (const r of records) {
    const key = r[campo] as string;
    if (!key) continue;
    const existing = map.get(key) || { soma: 0, count: 0 };
    existing.soma += r.reais_milhoes;
    existing.count += 1;
    map.set(key, existing);
  }
  return map;
}

// --- Agregação de um conjunto de records ---
function agregarRecords(records: PiespRecord[]): DashboardData {
  const totalMilhoes = records.reduce((acc, r) => acc + r.reais_milhoes, 0);
  const empresasUnicas = new Set(records.map(r => r.empresa));
  const municipiosUnicos = new Set(records.map(r => r.municipio));

  const byAno = agruparPor(records, 'ano');
  const bySetor = agruparPor(records, 'setor');
  const byMunicipio = agruparPor(records, 'municipio');
  const byRegiao = agruparPor(records, 'regiao');
  const byEmpresa = agruparPor(records, 'empresa');
  const byTipo = agruparPor(records, 'tipo');

  const rmspTotal = records
    .filter(r => r.regiao.toLowerCase().includes('rm são paulo') || r.regiao.toLowerCase().includes('rm s'))
    .reduce((acc, r) => acc + r.reais_milhoes, 0);

  const porAno = Array.from(byAno.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, { soma, count }], i) => ({
      name, value: Math.round(soma * 10) / 10, count, color: COLORS[i % COLORS.length],
    }));

  // Por mês
  const byMes = new Map<string, { soma: number; count: number }>();
  for (const r of records) {
    const mesNum = r.mes.replace(/^0/, '');
    if (!mesNum) continue;
    const existing = byMes.get(mesNum) || { soma: 0, count: 0 };
    existing.soma += r.reais_milhoes;
    existing.count += 1;
    byMes.set(mesNum, existing);
  }
  const porMes = Array.from(byMes.entries())
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([mesNum, { soma, count }]) => ({
      name: MES_NAMES[mesNum] || mesNum,
      value: Math.round(soma * 10) / 10,
      count,
      color: '#f43f5e',
    }));

  return {
    totalBilhoes: formatBilhoes(totalMilhoes),
    totalProjetos: records.length,
    totalEmpresas: empresasUnicas.size,
    totalMunicipios: municipiosUnicos.size,
    porAno,
    porMes,
    porSetor: topNFromMap(bySetor, 8),
    porMunicipio: topNFromMap(byMunicipio, 10),
    porRegiao: topNFromMap(byRegiao, 10),
    porEmpresa: topNFromMap(byEmpresa, 10),
    porTipo: topNFromMap(byTipo, 5),
    rmspVsInterior: {
      rmsp: Math.round(rmspTotal * 10) / 10,
      interior: Math.round((totalMilhoes - rmspTotal) * 10) / 10,
    },
  };
}

// --- Cache ---
let _cache: DashboardData | null = null;
const _cacheByYear = new Map<string, DashboardData>();

export async function getAvailableYears(): Promise<string[]> {
  const conn = await getDbConnection();
  const result = await conn.query(`SELECT DISTINCT anuncio_ano FROM piesp WHERE anuncio_ano IS NOT NULL AND reais_milhoes > 0 ORDER BY anuncio_ano`);
  return result.toArray().map(r => r.toJSON().anuncio_ano?.toString()).filter(Boolean);
}

export async function getDashboardData(): Promise<DashboardData> {
  if (_cache) return _cache;
  const records = await loadRecords();
  _cache = agregarRecords(records);
  return _cache;
}

export async function getDashboardDataByYear(ano: string): Promise<DashboardData> {
  if (_cacheByYear.has(ano)) return _cacheByYear.get(ano)!;
  const records = await loadRecords(ano);
  const result = agregarRecords(records);
  _cacheByYear.set(ano, result);
  return result;
}

/**
 * Gera um resumo textual dos dados para injeção no system instruction da Nadia (modo voz contextualizado).
 */
export async function getDashboardContext(): Promise<string> {
  const d = await getDashboardData();
  return `
DADOS AGREGADOS DO DASHBOARD PIESP (calculados da base real):
- Total acumulado: R$ ${d.totalBilhoes} bilhões em ${d.totalProjetos} projetos
- ${d.totalEmpresas} empresas distintas em ${d.totalMunicipios} municípios
- Top 3 setores: ${d.porSetor.slice(0, 3).map(s => `${s.name} (R$ ${formatBilhoes(s.value)} bi)`).join(', ')}
- Top 3 municípios: ${d.porMunicipio.slice(0, 3).map(m => `${m.name} (R$ ${formatBilhoes(m.value)} bi)`).join(', ')}
- RMSP: R$ ${formatBilhoes(d.rmspVsInterior.rmsp)} bi vs Interior: R$ ${formatBilhoes(d.rmspVsInterior.interior)} bi
- Por tipo: ${d.porTipo.map(t => `${t.name}: ${t.count} projetos`).join(', ')}
  `.trim();
}
