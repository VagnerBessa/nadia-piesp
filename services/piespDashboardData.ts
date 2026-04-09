/**
 * piespDashboardData.ts
 * Serviço de agregação para o dashboard PIESP.
 * Parseia o CSV completo e retorna estruturas prontas para gráficos Recharts.
 */
import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';

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
  '#f97316', '#a78bfa', '#fb7185', '#2dd4bf', '#e879f7',
];

// Valores canônicos de setor — linhas com setor fora destes foram corrompidas por csv multiline
const SETORES_VALIDOS = new Set([
  'Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços',
]);

// --- Parser ---
function parseCSV(): PiespRecord[] {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const records: PiespRecord[] = [];

  // Colunas: 0=data, 1=ano, 2=mes, 3=empresa_alvo, 4=investidora_s,
  //          5=reais_milhoes, 6=dolares_milhoes, 7=municipio, 8=regiao,
  //          9=descr_investimento, 10=setor_desc, 11=cnae_inv_2_desc,
  //          12=cnae_inv_5_cod_desc, 13=cnae_empresa_5_cod_desc, 14=tipo, 15=periodo
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (cols.length < 15) continue;
    const setorRaw = (cols[10] || '').trim();
    if (!SETORES_VALIDOS.has(setorRaw)) continue;

    const valorStr = (cols[5] || '0').trim().replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorStr) || 0;

    records.push({
      ano: (cols[1] || '').trim(),
      mes: (cols[2] || '').trim(),
      empresa: (cols[3] || 'Não informada').trim(),
      investidora: (cols[4] || '').trim(),
      reais_milhoes: valor,
      municipio: (cols[7] || 'Não informado').trim(),
      regiao: (cols[8] || 'Não informada').trim(),
      setor: (cols[10] || 'Outros').trim(),
      cnae2: (cols[11] || '').trim(),
      tipo: (cols[14] || 'Não classificado').trim(),
      descricao: (cols[9] || '').trim(),
    });
  }

  return records;
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

function topN(map: Map<string, { soma: number; count: number }>, n: number): AggItem[] {
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

function formatBilhoes(milhoes: number): string {
  const bi = milhoes / 1000;
  return bi.toFixed(1).replace('.', ',');
}

// --- Cache de records brutos ---
let _records: PiespRecord[] | null = null;
function getRecords(): PiespRecord[] {
  if (!_records) _records = parseCSV();
  return _records;
}

// --- Anos disponíveis na base ---
export function getAvailableYears(): string[] {
  return Array.from(new Set(getRecords().map(r => r.ano)))
    .filter(Boolean)
    .sort();
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

  // Por mês: agrupado por número de mês, exibido com nome abreviado
  const byMes = new Map<string, { soma: number; count: number }>();
  for (const r of records) {
    const mesNum = r.mes.replace(/^0/, ''); // remove zero à esquerda
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
    porSetor: topN(bySetor, 8),
    porMunicipio: topN(byMunicipio, 10),
    porRegiao: topN(byRegiao, 10),
    porEmpresa: topN(byEmpresa, 10),
    porTipo: topN(byTipo, 5),
    rmspVsInterior: {
      rmsp: Math.round(rmspTotal * 10) / 10,
      interior: Math.round((totalMilhoes - rmspTotal) * 10) / 10,
    },
  };
}

// --- Agregação principal ---
let _cache: DashboardData | null = null;
const _cacheByYear = new Map<string, DashboardData>();

export function getDashboardData(): DashboardData {
  if (_cache) return _cache;
  _cache = agregarRecords(getRecords());
  return _cache;
}

export function getDashboardDataByYear(ano: string): DashboardData {
  if (_cacheByYear.has(ano)) return _cacheByYear.get(ano)!;
  const filtered = getRecords().filter(r => r.ano === ano);
  const result = agregarRecords(filtered);
  _cacheByYear.set(ano, result);
  return result;
}

/**
 * Gera um resumo textual dos dados para injeção no system instruction da Nadia (modo voz contextualizado).
 */
export function getDashboardContext(): string {
  const d = getDashboardData();
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
