/**
 * Camada de dados PIESP para o MCP Server.
 * Porta direta de services/piespDataService.ts, com leitura via fs em vez de import ?raw.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// mcp-server/src/ → root → knowledge_base/
const REPO_ROOT = resolve(__dirname, '../../');
const PIESP_CSV_PATH = resolve(REPO_ROOT, 'knowledge_base/piesp_confirmados_com_valor.csv');
const PIESP_SEM_VALOR_CSV_PATH = resolve(REPO_ROOT, 'knowledge_base/piesp_confirmados_sem_valor.csv');

function loadCsv(path: string, label: string): string {
  try {
    // Lê como binário e decodifica com Latin-1 — os CSVs da PIESP estão em Latin-1,
    // não UTF-8. Ler diretamente como 'utf-8' transforma acentos em U+FFFD (garbled).
    const buf = readFileSync(path);
    return new TextDecoder('latin-1').decode(buf);
  } catch {
    process.stderr.write(`[piesp-mcp] ⚠️  Arquivo não encontrado: ${path}\n`);
    process.stderr.write(`[piesp-mcp] Coloque o ${label} em knowledge_base/ na raiz do repositório.\n`);
    return '';
  }
}

// Carregados uma vez no startup (sem re-parse a cada chamada)
const PIESP_DATA = loadCsv(PIESP_CSV_PATH, 'piesp_confirmados_com_valor.csv');
const PIESP_SEM_VALOR_DATA = loadCsv(PIESP_SEM_VALOR_CSV_PATH, 'piesp_confirmados_sem_valor.csv');

// Valores canônicos — usados para filtrar linhas corrompidas do CSV
const SETORES_VALIDOS = new Set([
  'Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços',
]);

const TIPOS_VALIDOS = new Set([
  'Implantação', 'Ampliação', 'Modernização', 'Ampliação/Modernização',
]);

function linhaValida(cols: string[]): boolean {
  if (cols.length < 15) return false;
  const setor = (cols[10] || '').trim();
  return SETORES_VALIDOS.has(setor);
}

const limpaValor = (v: string) =>
  parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  termo_busca?: string;
}

export interface FiltroRelatorio {
  setor?: string;
  regiao?: string;
  ano?: string;
  tipo?: string;
  municipio?: string;
  termo_busca?: string;
}

export interface ProjetoResumo {
  empresa: string;
  municipio: string;
  regiao: string;
  ano: string;
  setor: string;
  tipo: string;
  descricao: string;
  valor_milhoes_reais: string;
}

export interface ResumoRelatorio {
  total: number;
  totalMilhoes: number;
  projetos: ProjetoResumo[];
  porSetor: { nome: string; valor: number; count: number }[];
  porMunicipio: { nome: string; valor: number; count: number }[];
  porRegiao: { nome: string; valor: number; count: number }[];
  porAno: { nome: string; valor: number; count: number }[];
}

// ─── Funções de consulta ───────────────────────────────────────────────────────

export function consultarProjetos(filtro: FiltroPiesp) {
  if (!PIESP_DATA) return { total: 0, projetos: [] };

  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: {
    empresa: string; municipio: string; ano: string;
    setor: string; descricao: string; valor_milhoes_reais: string;
  }[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const anoLinha = cols[1]?.trim();
    const municipioLinha = (cols[7]?.trim() || '').toLowerCase();
    const empresaLinha = cols[3] || 'Desconhecida';
    const investidoraLinha = cols[4] || '';
    const setorLinha = cols[10] || 'Geral';
    const descricaoLinha = cols[9] || '';

    if (filtro.ano && anoLinha !== filtro.ano) continue;
    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) continue;
    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      // Equalizado com frontend: incluindo CNAEs na varredura semântica do backend MCP
      const cnaeLinha = (cols[11] || '') + ' ' + (cols[12] || '') + ' ' + (cols[13] || '');
      const txt = (empresaLinha + ' ' + investidoraLinha + ' ' + setorLinha + ' ' + descricaoLinha + ' ' + cnaeLinha).toLowerCase();
      if (!txt.includes(tb)) continue;
    }

    const empresaFinal = investidoraLinha && investidoraLinha.trim().toLowerCase() !== empresaLinha.trim().toLowerCase() 
      ? `${empresaLinha} (${investidoraLinha})` 
      : empresaLinha;

    resultados.push({
      empresa: empresaFinal,
      municipio: cols[7] || 'Não informado',
      ano: anoLinha,
      setor: setorLinha,
      descricao: descricaoLinha.substring(0, 150),
      valor_milhoes_reais: cols[5] || '0,00',
    });
  }

  resultados.sort((a, b) => limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais));
  return { total: resultados.length, projetos: resultados.slice(0, 10) };
}

export function consultarAnunciosSemValor(filtro: FiltroPiesp) {
  if (!PIESP_SEM_VALOR_DATA) return { total: 0, projetos: [] };

  const linhas = PIESP_SEM_VALOR_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: {
    empresa: string; municipio: string; ano: string; setor: string; descricao: string;
  }[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (cols.length < 8) continue;

    const anoLinha = cols[1]?.trim();
    const municipioLinha = (cols[5]?.trim() || '').toLowerCase();
    const empresaLinha = cols[3] || 'Desconhecida';
    const investidoraLinha = cols[4] || '';
    const setorLinha = cols[8] || 'Geral';
    const descricaoLinha = cols[7] || '';

    if (filtro.ano && anoLinha !== filtro.ano) continue;
    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) continue;
    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      // Equalizado: Busca por CNAEs e Investidora na base de Anúncios Sem Valor via MCP
      const cnaeLinha = (cols[9] || '') + ' ' + (cols[10] || '') + ' ' + (cols[11] || '');
      const txt = (empresaLinha + ' ' + investidoraLinha + ' ' + setorLinha + ' ' + descricaoLinha + ' ' + cnaeLinha).toLowerCase();
      if (!txt.includes(tb)) continue;
    }

    const empresaFinal = investidoraLinha && investidoraLinha.trim().toLowerCase() !== empresaLinha.trim().toLowerCase() 
      ? `${empresaLinha} (${investidoraLinha})` 
      : empresaLinha;

    resultados.push({
      empresa: empresaFinal,
      municipio: cols[5] || 'Não informado',
      ano: anoLinha,
      setor: setorLinha,
      descricao: descricaoLinha.substring(0, 150),
    });
  }

  return { total: resultados.length, projetos: resultados.slice(0, 10) };
}

export function filtrarParaRelatorio(filtro: FiltroRelatorio): ResumoRelatorio {
  if (!PIESP_DATA) {
    return { total: 0, totalMilhoes: 0, projetos: [], porSetor: [], porMunicipio: [], porRegiao: [], porAno: [] };
  }

  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: ProjetoResumo[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const anoLinha = (cols[1] || '').trim();
    const empresaLinha = (cols[3] || 'Desconhecida').trim();
    const setorLinha = (cols[10] || 'Outros').trim();
    const municipioLinha = (cols[7] || 'Não informado').trim();
    const regiaoLinha = (cols[8] || 'Não informada').trim();
    const tipoLinha = (cols[14] || '').trim();
    const descricaoLinha = (cols[9] || '').trim();
    const valorStr = (cols[5] || '0').trim();

    if (filtro.ano && anoLinha !== filtro.ano) continue;
    if (filtro.setor && setorLinha !== filtro.setor) continue;
    if (filtro.regiao && regiaoLinha !== filtro.regiao) continue;
    if (filtro.tipo && tipoLinha !== filtro.tipo) continue;
    if (filtro.municipio && !municipioLinha.toLowerCase().includes(filtro.municipio.toLowerCase())) continue;
    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      const txt = (empresaLinha + ' ' + setorLinha + ' ' + descricaoLinha).toLowerCase();
      if (!txt.includes(tb)) continue;
    }

    resultados.push({
      empresa: empresaLinha, municipio: municipioLinha, regiao: regiaoLinha,
      ano: anoLinha, setor: setorLinha, tipo: tipoLinha,
      descricao: descricaoLinha.substring(0, 200),
      valor_milhoes_reais: valorStr,
    });
  }

  resultados.sort((a, b) => limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais));
  const totalMilhoes = resultados.reduce((acc, r) => acc + limpaValor(r.valor_milhoes_reais), 0);

  function agrupar(campo: keyof ProjetoResumo) {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      const key = r[campo] as string;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 8)
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  function agruparAno() {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      if (!r.ano) continue;
      const existing = map.get(r.ano) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(r.ano, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  return {
    total: resultados.length,
    totalMilhoes: Math.round(totalMilhoes * 10) / 10,
    projetos: resultados.slice(0, 20),
    porSetor: agrupar('setor'),
    porMunicipio: agrupar('municipio'),
    porRegiao: agrupar('regiao'),
    porAno: agruparAno(),
  };
}

export function getMetadados() {
  if (!PIESP_DATA) return { setores: [], regioes: [], anos: [], tipos: [] };

  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const setores = new Set<string>();
  const regioes = new Set<string>();
  const anos = new Set<string>();
  const tipos = new Set<string>();

  for (let i = 1; i < linhas.length; i++) {
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

export function buscarEmpresa(nomeEmpresa: string): ResumoRelatorio {
  if (!PIESP_DATA) {
    return { total: 0, totalMilhoes: 0, projetos: [], porSetor: [], porMunicipio: [], porRegiao: [], porAno: [] };
  }

  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: ProjetoResumo[] = [];
  const termo = nomeEmpresa.toLowerCase();

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (!linhaValida(cols)) continue;

    const empresaLinha = (cols[3] || '').trim();
    const investidoraLinha = (cols[4] || '').trim();
    if (!empresaLinha.toLowerCase().includes(termo) && !investidoraLinha.toLowerCase().includes(termo)) continue;

    const valorStr = (cols[5] || '0').trim();
    resultados.push({
      empresa: empresaLinha,
      municipio: (cols[7] || 'Não informado').trim(),
      regiao: (cols[8] || 'Não informada').trim(),
      ano: (cols[1] || '').trim(),
      setor: (cols[10] || 'Outros').trim(),
      tipo: (cols[14] || '').trim(),
      descricao: (cols[9] || '').trim().substring(0, 300),
      valor_milhoes_reais: valorStr,
    });
  }

  resultados.sort((a, b) => limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais));
  const totalMilhoes = resultados.reduce((acc, r) => acc + limpaValor(r.valor_milhoes_reais), 0);

  function agrupar(campo: keyof ProjetoResumo) {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      const key = r[campo] as string;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 8)
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  function agruparAno() {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of resultados) {
      if (!r.ano) continue;
      const existing = map.get(r.ano) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(r.ano, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, { valor, count }]) => ({ nome, valor: Math.round(valor * 10) / 10, count }));
  }

  return {
    total: resultados.length,
    totalMilhoes: Math.round(totalMilhoes * 10) / 10,
    projetos: resultados,
    porSetor: agrupar('setor'),
    porMunicipio: agrupar('municipio'),
    porRegiao: agrupar('regiao'),
    porAno: agruparAno(),
  };
}
