import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';

// DEBUG ENCODING — remove após diagnóstico
const _primeiraLinha = PIESP_DATA.split('\n')[0];
const _amostra = PIESP_DATA.split('\n').slice(1, 4);
console.log('🔍 CSV header:', _primeiraLinha);
console.log('🔍 CSV amostra linhas 1-3:');
_amostra.forEach((l, i) => { if (l.trim()) { const cols = l.split(';'); console.log(`  linha ${i+1} | col8="${cols[8]}" | col10="${cols[10]}" | municipio="${cols[7]}"`); } });

// Valores canônicos — usados para filtrar linhas corrompidas do CSV
const SETORES_VALIDOS = new Set([
  'Agropecuária', 'Comércio', 'Indústria', 'Infraestrutura', 'Serviços',
]);

const TIPOS_VALIDOS = new Set([
  'Implantação', 'Ampliação', 'Modernização', 'Ampliação/Modernização',
]);

// ─────────────────────────────────────────────────────────────
// Mapeamento de regiões → municípios (fallback quando a coluna
// "regiao" do CSV não tem o nome esperado pelo usuário).
// Nomes em minúsculas para comparação case-insensitive.
// ─────────────────────────────────────────────────────────────

// Todos os nomes SEM diacríticos (norm() remove acentos antes de comparar)
const RMSP = new Set([
  'aruja','barueri','biritiba-mirim','biritiba mirim','caieiras','cajamar',
  'carapicuiba','cotia','diadema','embu das artes','embu-guacu','embu guacu',
  'ferraz de vasconcelos','francisco morato','franco da rocha','guararema',
  'guarulhos','itapecerica da serra','itapevi','itaquaquecetuba','jandira',
  'juquitiba','mairipora','maua','mogi das cruzes','osasco',
  'pirapora do bom jesus','poa','ribeirao pires','rio grande da serra',
  'salesopolis','santa isabel','santana de parnaiba','santo andre',
  'sao bernardo do campo','sao caetano do sul','sao lourenco da serra',
  'sao paulo','suzano','tabao da serra','vargem grande paulista',
]);

const RM_CAMPINAS = new Set([
  'americana','artur nogueira','campinas','cosmopolis','engenheiro coelho',
  'holambra','hortolandia','indaiatuba','itatiba','jaguariuna','monte mor',
  'morungaba','nova odessa','paulinia','pedreira','santa barbara d oeste',
  'santo antonio de posse','sumare','valinhos','vinhedo',
]);

const RM_BAIXADA_SANTISTA = new Set([
  'bertioga','cubatao','guaruja','itanhaem','mongagua',
  'peruibe','praia grande','santos','sao vicente',
]);

const RM_VALE_PARAIBA = new Set([
  'cacapava','caraguatatuba','guaratingueta','jacarei','lorena',
  'pindamonhangaba','sao jose dos campos','taubate','ubatuba',
]);

const RM_SOROCABA = new Set([
  'aluminio','aracariguama','aracoiaba da serra','boituva','capela do alto',
  'cerquilho','cesario lange','ibiuna','ipero','itapetininga','itu','jumirim',
  'laranjal paulista','mairinque','piedade','pilar do sul','porto feliz',
  'salto','salto de pirapora','sao miguel arcanjo','sarapui','sorocaba',
  'tapiai','tatui','votorantim',
]);

// Termos já normalizados (sem diacríticos) — norm() é aplicado antes da comparação
const REGIAO_MUNICIPIOS: Array<{ termos: string[]; municipios: Set<string> }> = [
  {
    termos: ['sao paulo','rmsp','grande sp','grande sao paulo','metropolitana de sao paulo','ra sao paulo'],
    municipios: RMSP,
  },
  {
    termos: ['campinas','rm campinas','metropolitana de campinas','ra campinas'],
    municipios: RM_CAMPINAS,
  },
  {
    termos: ['baixada santista','santos','rm baixada','litoral','metropolitana de santos','ra santos'],
    municipios: RM_BAIXADA_SANTISTA,
  },
  {
    termos: ['vale do paraiba','vale paraiba','sao jose dos campos','metropolitana de sao jose','ra sao jose dos campos'],
    municipios: RM_VALE_PARAIBA,
  },
  {
    termos: ['sorocaba','rm sorocaba','metropolitana de sorocaba','ra sorocaba'],
    municipios: RM_SOROCABA,
  },
];

/**
 * Remove diacríticos e normaliza para comparação robusta,
 * independente de encoding do CSV (Latin-1 vs UTF-8).
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s-]/g, ' ')       // remove caracteres estranhos (encoding garbled)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dado o nome de região digitado pelo usuário, retorna o Set de municípios
 * correspondente (ou null se não for uma região conhecida).
 * Usa norm() para comparação sem diacríticos.
 */
function resolverRegiaoEmMunicipios(filtroRegiao: string): Set<string> | null {
  const q = norm(filtroRegiao);
  for (const { termos, municipios } of REGIAO_MUNICIPIOS) {
    if (termos.some(t => q.includes(t) || t.includes(q))) {
      return municipios;
    }
  }
  return null;
}

/**
 * Verifica se um município (nome da base) está na região solicitada.
 * Compara sem diacríticos para robustez.
 */
function municipioNaRegiao(municipioNaBase: string, municipiosRegiao: Set<string>): boolean {
  const m = norm(municipioNaBase);
  return municipiosRegiao.has(m);
}

/**
 * Compara dois nomes de região de forma tolerante — sem diacríticos.
 */
function regiaoMatchPorNome(regiaoNaBase: string, filtroRegiao: string): boolean {
  const a = norm(regiaoNaBase);
  const b = norm(filtroRegiao);
  if (a.includes(b) || b.includes(a)) return true;

  const stripPrefix = (s: string) =>
    s
      .replace(/^ra\s+/, '')
      .replace(/^regiao\s+(administrativa|metropolitana|admin\.?)\s+(de|do|da|dos|das)\s+/, '')
      .replace(/^regiao\s+(de|do|da)\s+/, '')
      .replace(/^grande\s+/, '')
      .trim();

  const keyA = stripPrefix(a);
  const keyB = stripPrefix(b);
  return keyA.length > 0 && (keyA.includes(keyB) || keyB.includes(keyA));
}

/**
 * Match completo: tenta por nome da coluna "regiao" do CSV e,
 * se falhar, verifica se o município é membro da região pedida.
 */
function regiaoMatch(regiaoNaBase: string, municipioNaBase: string, filtroRegiao: string): boolean {
  if (regiaoMatchPorNome(regiaoNaBase, filtroRegiao)) return true;
  const municipios = resolverRegiaoEmMunicipios(filtroRegiao);
  if (municipios) return municipioNaRegiao(municipioNaBase, municipios);
  return false;
}

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  regiao?: string;
  setor?: string;
  termo_busca?: string;
}

export function consultarPiespData(filtro: FiltroPiesp) {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];

  // A primeira linha é o cabeçalho
  // indices (piesp_confirmados_com_valor): 1=ano, 3=empresa_alvo, 5=reais, 7=municipio, 8=regiao, 9=descr_investimento, 10=setor
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (!linhaValida(colunas)) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[7]?.trim()?.toLowerCase() || '';
    const regiaoLinha = colunas[8]?.trim()?.toLowerCase() || '';
    const empresaLinha = colunas[3] || 'Desconhecida';
    const setorLinha = colunas[10] || 'Geral';
    const descricaoLinha = colunas[9] || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) {
      match = false;
    }

    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) {
      match = false;
    }

    if (filtro.regiao && !regiaoMatch(regiaoLinha, municipioLinha, filtro.regiao)) {
      match = false;
    }

    if (filtro.setor && setorLinha.toLowerCase() !== filtro.setor.toLowerCase()) {
      match = false;
    }

    if (filtro.termo_busca) {
      const tb = filtro.termo_busca.toLowerCase();
      // busca semântica livre em vários campos textuais
      const textToSearch = (empresaLinha + ' ' + setorLinha + ' ' + descricaoLinha).toLowerCase();
      if (!textToSearch.includes(tb)) {
        match = false;
      }
    }

    if (match) {
      resultados.push({
        empresa: empresaLinha,
        municipio: colunas[7] || 'Não informado',
        regiao: colunas[8] || 'Não informada',
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
  setor?: string;
  regiao?: string;
  ano?: string;
  tipo?: string;
  municipio?: string;
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

    if (filtro.ano && anoLinha !== filtro.ano) continue;
    if (filtro.setor && setorLinha !== filtro.setor) continue;
    if (filtro.regiao && !regiaoMatch(regiaoLinha, municipioLinha, filtro.regiao)) continue;
    if (filtro.tipo && tipoLinha !== filtro.tipo) continue;
    if (filtro.municipio && !municipioLinha.toLowerCase().includes(filtro.municipio.toLowerCase())) continue;
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

    if (filtro.setor && setorLinha.toLowerCase() !== filtro.setor.toLowerCase()) {
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
