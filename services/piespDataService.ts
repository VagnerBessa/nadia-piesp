import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';

// Valores canônicos — usados para filtrar linhas corrompidas do CSV
const SETORES_VALIDOS = new Set([
  'Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços',
]);

const TIPOS_VALIDOS = new Set([
  'Implantação', 'Ampliação', 'Modernização', 'Ampliação/Modernização',
]);

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  regiao?: string;
  termo_busca?: string;
}

// Normaliza termos de região: "Região Administrativa de Santos", "RA de Santos", "RA Santos" → "ra santos"
function normalizarRegiao(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/regi[aã]o administrativa d[eoa]?\s*/i, 'ra ')
    .replace(/\bra de\b/gi, 'ra')
    .replace(/\s+/g, ' ')
    .trim();
}

export function consultarPiespData(filtro: FiltroPiesp) {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];

  // indices (piesp_confirmados_com_valor): 1=ano, 3=empresa_alvo, 5=reais, 7=municipio, 8=regiao, 9=descr_investimento, 10=setor
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (!linhaValida(colunas)) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[7]?.trim()?.toLowerCase() || '';
    const regiaoLinha = colunas[8]?.trim() || '';
    const empresaLinha = colunas[3] || 'Desconhecida';
    const setorLinha = colunas[10] || 'Geral';
    const descricaoLinha = colunas[9] || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) {
      match = false;
    }

    if (filtro.regiao) {
      const regiaoFiltro = normalizarRegiao(filtro.regiao);
      const regiaoNorm = normalizarRegiao(regiaoLinha);
      if (!regiaoNorm.includes(regiaoFiltro) && !regiaoFiltro.includes(regiaoNorm)) {
        match = false;
      }
    }

    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) {
      match = false;
    }

    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      const textToSearch = (empresaLinha + ' ' + setorLinha + ' ' + descricaoLinha).toLowerCase();
      if (!textToSearch.includes(tb)) {
        match = false;
      }
    }

    if (match) {
      resultados.push({
        empresa: empresaLinha,
        municipio: colunas[7] || 'Não informado',
        regiao: regiaoLinha || 'Não informada',
        ano: anoLinha,
        setor: setorLinha,
        descricao: descricaoLinha.substring(0, 150),
        valor_milhoes_reais: colunas[5] || '0,00'
      });
    }
  }

  // Se houver mais de 5 resultados, vamos ordenar pelo valor convertido para número pra pegar os top 5.
  // Como reais_milhoes tem formato brasileiro "9.400,00", tem que limpar pra fazer sort
  resultados.sort((a, b) => {
    const limpaValor = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais);
  });
  // Retorna todos os resultados ordenados por valor (maiores primeiro)
  // Se houver muitos, o top 10 é enviado ao modelo + total real para contexto
  const total = resultados.length;
  return { total, projetos: resultados.slice(0, 10) };
}

export interface FiltroRelatorio {
  setor?: string | string[];
  regiao?: string | string[];
  ano?: string | string[];
  tipo?: string | string[];
  municipio?: string | string[];
  termo_busca?: string;
}

export interface ResumoRelatorio {
  total: number;
  totalMilhoes: number;
  projetos: {
    empresa: string;
    municipio: string;
    regiao: string;
    ano: string;
    setor: string;
    tipo: string;
    descricao: string;
    valor_milhoes_reais: string;
  }[];
  porSetor: { nome: string; valor: number; count: number }[];
  porMunicipio: { nome: string; valor: number; count: number }[];
  porRegiao: { nome: string; valor: number; count: number }[];
  porAno: { nome: string; valor: number; count: number }[];
}

export function filtrarParaRelatorio(filtro: FiltroRelatorio): ResumoRelatorio {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: ResumoRelatorio['projetos'] = [];

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

    const checkMatch = (valor: string, filtroVal?: string | string[], exact = true): boolean => {
      if (!filtroVal) return true;
      const arr = Array.isArray(filtroVal) ? filtroVal : [filtroVal];
      if (arr.length === 0) return true;
      const vLower = valor.toLowerCase();
      
      return arr.some(f => {
         const fStr = typeof f === 'string' ? f.toLowerCase() : String(f).toLowerCase();
         // Para matches flexíveis (como "RA de Campinas" vs "RA Campinas"), aceitamos se houver intersecção significativa
         if (!exact) {
            return vLower.includes(fStr) || fStr.includes(vLower);
         }
         return vLower === fStr;
      });
    };

    if (!checkMatch(anoLinha, filtro.ano)) continue;
    if (!checkMatch(setorLinha, filtro.setor)) continue;
    if (!checkMatch(regiaoLinha, filtro.regiao, false)) continue; // flexível para "RA de alguma coisa"
    if (!checkMatch(tipoLinha, filtro.tipo)) continue;
    if (!checkMatch(municipioLinha, filtro.municipio, false)) continue;
    
    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      const textToSearch = (empresaLinha + ' ' + setorLinha + ' ' + descricaoLinha).toLowerCase();
      if (!textToSearch.includes(tb)) continue;
    }

    resultados.push({
      empresa: empresaLinha,
      municipio: municipioLinha,
      regiao: regiaoLinha,
      ano: anoLinha,
      setor: setorLinha,
      tipo: tipoLinha,
      descricao: descricaoLinha.substring(0, 200),
      valor_milhoes_reais: valorStr,
    });
  }

  // Ordena por valor decrescente
  const limpaValor = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
  resultados.sort((a, b) => limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais));

  const totalMilhoes = resultados.reduce((acc, r) => acc + limpaValor(r.valor_milhoes_reais), 0);

  // Agrupamentos simples
  function agrupar(campo: keyof typeof resultados[0]) {
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
      const key = r.ano as string;
      if (!key) continue;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Cronológico (Crescente)
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

/**
 * Verifica se uma linha do CSV parece íntegra (não foi corrompida por quebra de linha dentro de campo com aspas).
 * Linhas válidas têm pelo menos 15 colunas e o setor deve ser um dos 5 conhecidos.
 */
function linhaValida(cols: string[]): boolean {
  if (cols.length < 15) return false;
  const setor = (cols[10] || '').trim();
  return SETORES_VALIDOS.has(setor);
}

export function getMetadados(): { setores: string[]; regioes: string[]; anos: string[]; tipos: string[] } {
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

export function getUniqueEmpresas(): string[] {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const empresas = new Set<string>();
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';');
    if (cols.length < 4) continue;
    const empresa = (cols[3] || '').trim();
    if (empresa && empresa !== 'Desconhecida') empresas.add(empresa);
  }
  return Array.from(empresas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function buscarEmpresaNoPiesp(nomeEmpresa: string): ResumoRelatorio {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados: ResumoRelatorio['projetos'] = [];
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

  const limpaValor = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
  resultados.sort((a, b) => limpaValor(b.valor_milhoes_reais) - limpaValor(a.valor_milhoes_reais));
  const totalMilhoes = resultados.reduce((acc, r) => acc + limpaValor(r.valor_milhoes_reais), 0);

  function agrupar(campo: keyof typeof resultados[0]) {
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
      const key = r.ano as string;
      if (!key) continue;
      const existing = map.get(key) || { valor: 0, count: 0 };
      existing.valor += limpaValor(r.valor_milhoes_reais);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Cronológico (Crescente)
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

export function consultarAnunciosSemValor(filtro: FiltroPiesp) {
  const linhas = PIESP_SEM_VALOR_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];
  
  // A primeira linha é o cabeçalho
  // indices (piesp_confirmados_sem_valor): 1=ano, 3=empresa_alvo, 5=municipio, 7=descr_investimento, 8=setor_desc
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 8) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[5]?.trim()?.toLowerCase() || '';
    const empresaLinha = colunas[3] || 'Desconhecida';
    const setorLinha = colunas[8] || 'Geral';
    const descricaoLinha = colunas[7] || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) {
      match = false;
    }

    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) {
      match = false;
    }

    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      // busca semântica livre
      const textToSearch = (empresaLinha + ' ' + setorLinha + ' ' + descricaoLinha).toLowerCase();
      if (!textToSearch.includes(tb)) {
        match = false;
      }
    }

    if (match) {
      resultados.push({
        empresa: empresaLinha,
        municipio: colunas[5] || 'Não informado',
        ano: anoLinha,
        setor: setorLinha,
        descricao: descricaoLinha.substring(0, 150)
      });
    }
  }

  // Retorna todos os resultados (mais recentes primeiro)
  const total = resultados.length;
  return { total, projetos: resultados.slice(0, 10) };
}
