import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
  termo_busca?: string;
}

export function consultarPiespData(filtro: FiltroPiesp) {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];
  
  // A primeira linha é o cabeçalho
  // indices (piesp_confirmados_com_valor): 1=ano, 3=empresa_alvo, 5=reais, 7=municipio, 9=descr_investimento, 10=setor
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 11) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[7]?.trim()?.toLowerCase() || '';
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
