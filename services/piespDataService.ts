import PIESP_DATA from '../knowledge_base/piesp_mini.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';

export interface FiltroPiesp {
  ano?: string;
  municipio?: string;
}

export function consultarPiespData(filtro: FiltroPiesp) {
  const linhas = PIESP_DATA.split('\n').filter(l => l.trim().length > 0);
  const resultados = [];
  
  // A primeira linha é o cabeçalho
  // indices: 1=ano, 3=empresa, 5=reais, 7=municipio, 10=setor
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 10) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[7]?.trim()?.toLowerCase() || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) {
      match = false;
    }

    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) {
      match = false;
    }

    if (match) {
      resultados.push({
        empresa: colunas[3] || 'Desconhecida',
        municipio: colunas[7] || 'Não informado',
        ano: anoLinha,
        setor: colunas[10] || 'Geral',
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
  // indices: 1=ano, 3=empresa_alvo, 5=municipio, 8=setor_desc, 7=descr_investimento
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i].split(';');
    if (colunas.length < 8) continue;

    const anoLinha = colunas[1]?.trim();
    const municipioLinha = colunas[5]?.trim()?.toLowerCase() || '';

    let match = true;

    if (filtro.ano && anoLinha !== filtro.ano) {
      match = false;
    }

    if (filtro.municipio && !municipioLinha.includes(filtro.municipio.toLowerCase())) {
      match = false;
    }

    if (match) {
      resultados.push({
        empresa: colunas[3] || 'Desconhecida',
        municipio: colunas[5] || 'Não informado',
        ano: anoLinha,
        setor: colunas[8] || 'Geral',
        descricao: (colunas[7] || '').substring(0, 80) + '...' // resumo curto para a API falar
      });
    }
  }

  // Retorna todos os resultados (mais recentes primeiro)
  const total = resultados.length;
  return { total, projetos: resultados.slice(0, 10) };
}
