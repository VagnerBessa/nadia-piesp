import PIESP_DATA from '../knowledge_base/piesp_mini.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  regiao?: string;
  tipo?: string;
  setor?: string;
  empresa?: string;
  descricao?: string;
}

export function consultarPiespData(filtro: FiltroPiesp) {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];

  // A primeira linha é o cabeçalho
  // indices: 0=data, 1=ano, 2=mes, 3=empresa_alvo, 4=investidora, 5=reais, 6=dolares,
  //          7=municipio, 8=regiao, 9=descr_investimento, 10=setor_desc,
  //          11=cnae_inv_2_desc, 12=cnae_inv_5, 13=cnae_empresa_5, 14=tipo, 15=periodo
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 10) continue;

    const anoLinha       = colunas[1]?.trim();
    const municipioLinha = colunas[7]?.trim()?.toLowerCase() || '';
    const regiaoLinha    = colunas[8]?.trim()?.toLowerCase() || '';
    const descricaoLinha = colunas[9]?.trim()?.toLowerCase() || '';
    const setorLinha     = colunas[10]?.trim()?.toLowerCase() || '';
    const tipoLinha      = colunas[14]?.trim()?.toLowerCase() || '';
    const empresaLinha   = colunas[3]?.trim()?.toLowerCase() || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) match = false;
    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) match = false;
    if (filtro.regiao && !regiaoLinha.includes(filtro.regiao.toLowerCase())) match = false;
    if (filtro.setor && !setorLinha.includes(filtro.setor.toLowerCase())) match = false;
    if (filtro.tipo && !tipoLinha.includes(filtro.tipo.toLowerCase())) match = false;
    if (filtro.empresa && !empresaLinha.includes(filtro.empresa.toLowerCase())) match = false;
    if (filtro.descricao) {
      const termos = filtro.descricao.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (!termos.some(t => descricaoLinha.includes(t))) match = false;
    }

    if (match) {
      resultados.push({
        empresa: colunas[3] || 'Desconhecida',
        municipio: colunas[7] || 'Não informado',
        regiao: colunas[8] || 'Não informado',
        ano: anoLinha,
        setor: colunas[10] || 'Geral',
        tipo: colunas[14] || 'Não informado',
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

export function consultarAnunciosSemValor(filtro: FiltroPiesp) {
  const linhas = PIESP_SEM_VALOR_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];

  // A primeira linha é o cabeçalho
  // indices (sem colunas reais/dolares): 0=data, 1=ano, 2=mes, 3=empresa_alvo, 4=investidora,
  //          5=municipio, 6=regiao, 7=descr_investimento, 8=setor_desc,
  //          9=cnae_inv_2_desc, 10=cnae_inv_5, 11=cnae_empresa_5, 12=tipo, 13=periodo
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 8) continue;

    const anoLinha       = colunas[1]?.trim();
    const municipioLinha = colunas[5]?.trim()?.toLowerCase() || '';
    const regiaoLinha    = colunas[6]?.trim()?.toLowerCase() || '';
    const descricaoLinha = colunas[7]?.trim()?.toLowerCase() || '';
    const setorLinha     = colunas[8]?.trim()?.toLowerCase() || '';
    const tipoLinha      = colunas[12]?.trim()?.toLowerCase() || '';
    const empresaLinha   = colunas[3]?.trim()?.toLowerCase() || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) match = false;
    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) match = false;
    if (filtro.regiao && !regiaoLinha.includes(filtro.regiao.toLowerCase())) match = false;
    if (filtro.setor && !setorLinha.includes(filtro.setor.toLowerCase())) match = false;
    if (filtro.tipo && !tipoLinha.includes(filtro.tipo.toLowerCase())) match = false;
    if (filtro.empresa && !empresaLinha.includes(filtro.empresa.toLowerCase())) match = false;
    if (filtro.descricao) {
      const termos = filtro.descricao.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (!termos.some(t => descricaoLinha.includes(t))) match = false;
    }

    if (match) {
      resultados.push({
        empresa: colunas[3] || 'Desconhecida',
        municipio: colunas[5] || 'Não informado',
        regiao: colunas[6] || 'Não informado',
        ano: anoLinha,
        setor: colunas[8] || 'Geral',
        tipo: colunas[12] || 'Não informado',
        descricao: (colunas[7] || '').substring(0, 80) + '...'
      });
    }
  }

  // Retorna todos os resultados (mais recentes primeiro)
  const total = resultados.length;
  return { total, projetos: resultados.slice(0, 10) };
}
