import { callMcpTool } from './mcpService';

const DATASET_ID = 'empresas-sp-mar26-20260522';

export interface FiltroEmpreendedorismo {
  municipio?: string;
  regiao?: string;
  setor?: string;
  termo_busca?: string;
  ano?: string;
  ano_inicio?: string;
  ano_fim?: string;
  data_inicio?: string;
  data_fim?: string;
  porte?: string;
  opcao_mei?: string;
  sexo?: string;
  natureza_juridica?: string;
  situacao?: string;
}

export interface EmpresaResumo {
  cnpj: string;
  municipio: string;
  regiao: string;
  setor: string;
  atividade: string;
  porte: string;
  opcao_mei: string;
  sexo: string;
  natureza_juridica: string;
  situacao: string;
  data_inicio: string;
}

export interface ResumoEmpreendedorismo {
  total_empresas: number;
  empresas: EmpresaResumo[];
  setores: { nome: string; count: number; valor: number }[];
  atividades: { nome: string; count: number; valor: number }[];
  municipios: { nome: string; count: number; valor: number }[];
  regioes: { nome: string; count: number; valor: number }[];
  portes: { nome: string; count: number; valor: number }[];
  meis: { nome: string; count: number; valor: number }[];
  sexos: { nome: string; count: number; valor: number }[];
  naturezas: { nome: string; count: number; valor: number }[];
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function canonicalMunicipio(value: string): string {
  const aliases: Record<string, string> = {
    jundiai: 'Jundiaí',
    'sao paulo': 'São Paulo',
    'sao jose dos campos': 'São José dos Campos',
    'sao jose do rio preto': 'São José do Rio Preto',
    'sao bernardo do campo': 'São Bernardo do Campo',
    'sao caetano do sul': 'São Caetano do Sul',
    'sao carlos': 'São Carlos',
    'ribeirao preto': 'Ribeirão Preto',
    'braganca paulista': 'Bragança Paulista',
    'mogi das cruzes': 'Mogi das Cruzes',
    'taboao da serra': 'Taboão da Serra',
    'aracatuba': 'Araçatuba',
  };
  return aliases[normalizeKey(value)] || value;
}

export function canonicalSetor(value: string): string {
  const normalized = normalizeKey(value || '');
  if (normalized.includes('agro')) return 'Agropecuária';
  if (normalized.includes('comerc')) return 'Comércio';
  if (normalized.includes('industr')) return 'Indústria';
  if (normalized.includes('infra')) return 'Infraestrutura';
  if (normalized.includes('servic')) return 'Serviços';
  return value;
}

function normalizeMei(value: string): string {
  const normalized = normalizeKey(value || '');
  if (['sim', 's', 'mei', 'microempreendedor individual'].includes(normalized)) return 'Sim';
  if (['nao', 'n'].includes(normalized)) return 'Não';
  if (normalized.includes('nao se aplica')) return 'Não se aplica';
  return value;
}

function normalizeSexo(value: string): string {
  const normalized = normalizeKey(value || '');
  if (['homem', 'homens', 'masculino', 'm'].includes(normalized)) return 'Homem';
  if (['mulher', 'mulheres', 'feminino', 'f'].includes(normalized)) return 'Mulher';
  return value;
}

function buildFilters(filtro: FiltroEmpreendedorismo): any[] {
  const filters: any[] = [];

  if (filtro.municipio) filters.push({ coluna: 'Nome do município', operador: 'ILIKE', valor: `%${canonicalMunicipio(filtro.municipio)}%` });
  if (filtro.regiao) filters.push({ coluna: 'Região Administrativa', operador: 'ILIKE', valor: `%${filtro.regiao}%` });
  if (filtro.setor) filters.push({ coluna: 'Setor de atividade econômica', operador: 'ILIKE', valor: `%${canonicalSetor(filtro.setor)}%` });
  if (filtro.termo_busca) filters.push({ coluna: 'Atividade econômica', operador: 'ILIKE', valor: `%${filtro.termo_busca}%` });
  if (filtro.porte) filters.push({ coluna: 'Porte da empresa', operador: '=', valor: filtro.porte });
  if (filtro.opcao_mei) filters.push({ coluna: 'Opção MEI', operador: '=', valor: normalizeMei(filtro.opcao_mei) });
  if (filtro.sexo) filters.push({ coluna: 'Sexo', operador: '=', valor: normalizeSexo(filtro.sexo) });
  if (filtro.natureza_juridica) filters.push({ coluna: 'Natureza jurídica', operador: 'ILIKE', valor: `%${filtro.natureza_juridica}%` });
  if (filtro.situacao) filters.push({ coluna: 'Situacao cadastral', operador: '=', valor: filtro.situacao });

  const anoInicio = filtro.ano_inicio || filtro.ano;
  const anoFim = filtro.ano_fim || filtro.ano;
  if (filtro.data_inicio) filters.push({ coluna: 'Data do início de atividade', operador: '>=', valor: filtro.data_inicio });
  else if (anoInicio) filters.push({ coluna: 'Data do início de atividade', operador: '>=', valor: `${anoInicio}-01-01` });

  if (filtro.data_fim) filters.push({ coluna: 'Data do início de atividade', operador: '<=', valor: filtro.data_fim });
  else if (anoFim) filters.push({ coluna: 'Data do início de atividade', operador: '<=', valor: `${anoFim}-12-31` });

  return filters;
}

function inferKnownFilters(args: FiltroEmpreendedorismo): FiltroEmpreendedorismo {
  const next = { ...args };
  const text = normalizeKey(`${args.termo_busca || ''} ${args.natureza_juridica || ''}`);
  if (text.includes('inova-simples') || text.includes('inova simples') || text.includes('empresa simples de inovacao')) {
    next.natureza_juridica = 'Empresa Simples de Inovação';
    if (args.termo_busca && normalizeKey(args.termo_busca).includes('inova')) delete next.termo_busca;
  }
  return next;
}

async function aggregate(filters: any[], groupBy: string, limit = 10) {
  const res = await callMcpTool('agregar_dados', {
    dataset_id: DATASET_ID,
    agrupar_por: [groupBy],
    agregacoes: [{ coluna: 'CNPJ', funcao: 'CONTAGEM' }],
    filtros: filters,
    ordenar_por: 'contagem_CNPJ',
    ordem: 'DESC',
    limite: limit,
  });

  if (res?.error) throw new Error(res.error);

  return (res?.data?.dados || res?.dados || []).map((row: any) => ({
    nome: row[groupBy] || 'Não informado',
    count: Number(row.contagem_CNPJ || 0),
    valor: Number(row.contagem_CNPJ || 0),
  }));
}

export async function consultarEmpreendedorismoData(args: FiltroEmpreendedorismo): Promise<ResumoEmpreendedorismo> {
  const filtro = inferKnownFilters(args);
  const filters = buildFilters(filtro);

  const totalRes = await callMcpTool('agregar_dados', {
    dataset_id: DATASET_ID,
    agrupar_por: [],
    agregacoes: [{ coluna: 'CNPJ', funcao: 'CONTAGEM' }],
    filtros: filters,
  });
  if (totalRes?.error) throw new Error(totalRes.error);

  const setores = await aggregate(filters, 'Setor de atividade econômica');
  const atividades = await aggregate(filters, 'Atividade econômica', 20);
  const municipios = await aggregate(filters, 'Nome do município');
  const regioes = await aggregate(filters, 'Região Administrativa');
  const portes = await aggregate(filters, 'Porte da empresa');
  const meis = await aggregate(filters, 'Opção MEI');
  const sexos = await aggregate(filters, 'Sexo');
  const naturezas = await aggregate(filters, 'Natureza jurídica');
  const registrosRes = await callMcpTool('buscar_dados', { dataset_id: DATASET_ID, filtros: filters, limite: 10 });
  if (registrosRes?.error) throw new Error(registrosRes.error);

  const rows = registrosRes?.data?.linhas || registrosRes?.data?.dados || registrosRes?.linhas || registrosRes?.dados || [];
  return {
    total_empresas: Number(totalRes?.data?.dados?.[0]?.contagem_CNPJ || totalRes?.dados?.[0]?.contagem_CNPJ || 0),
    setores,
    atividades,
    municipios,
    regioes,
    portes,
    meis,
    sexos,
    naturezas,
    empresas: rows.map((row: any) => ({
      cnpj: row.CNPJ || '',
      municipio: row['Nome do município'] || '',
      regiao: row['Região Administrativa'] || '',
      setor: row['Setor de atividade econômica'] || '',
      atividade: row['Atividade econômica'] || '',
      porte: row['Porte da empresa'] || '',
      opcao_mei: row['Opção MEI'] || '',
      sexo: row.Sexo || '',
      natureza_juridica: row['Natureza jurídica'] || '',
      situacao: row['Situacao cadastral'] || '',
      data_inicio: row['Data do início de atividade'] || '',
    })),
  };
}

export async function getMetadados() {
  return {
    setores: ['Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços'],
    regioes: ['Região Metropolitana de São Paulo', 'Região Administrativa de Campinas', 'Região Administrativa de Sorocaba'],
    anos: ['2023', '2024', '2025', '2026'],
    tipos: ['MEI', 'ME', 'EPP', 'Empresa Simples de Inovação'],
  };
}
