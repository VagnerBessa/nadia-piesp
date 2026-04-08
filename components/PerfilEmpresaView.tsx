import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import { getUniqueEmpresas, buscarEmpresaNoPiesp, ResumoRelatorio } from '../services/piespDataService';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { EmbeddedChart } from './EmbeddedChart';

interface SourceItem {
  uri: string;
  title: string;
}

interface PerfilEmpresaViewProps {
  onNavigateHome: () => void;
}

function injectInlineCitations(text: string, supports: any[]): string {
  if (!supports?.length) return text;

  // A API do Gemini retorna endIndex como um offset em BYTES (UTF-8),
  // e não em caracteres UTF-16. Precisamos trabalhar em nível de array de bytes
  // para evitar que os marcadores despedacem palavras com acento.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let textBytes = encoder.encode(text);

  // Ordena por endIndex decrescente para inserir do fim ao início (preserva índices)
  const sorted = [...supports]
    .filter(s => s.segment?.endIndex != null && s.groundingChunkIndices?.length > 0)
    .sort((a, b) => (b.segment.endIndex ?? 0) - (a.segment.endIndex ?? 0));

  for (const support of sorted) {
    const end: number = support.segment.endIndex;
    if (end > textBytes.length) continue; // safety check

    const chunkIndices: number[] = support.groundingChunkIndices ?? [];
    const unique = [...new Set(chunkIndices)].sort((a, b) => a - b);
    
    // Adicionamos um espaço antes do marcador se ele for grudado no texto, opcional,
    // mas o principal é juntar os marcadores num só.
    const markerStr = unique.map(i => `[${i + 1}]`).join('');
    const markerBytes = encoder.encode(markerStr);

    const newBytes = new Uint8Array(textBytes.length + markerBytes.length);
    newBytes.set(textBytes.slice(0, end), 0);
    newBytes.set(markerBytes, end);
    newBytes.set(textBytes.slice(end), end + markerBytes.length);
    textBytes = newBytes;
  }
  
  return decoder.decode(textBytes);
}

function buildDossiePrompt(empresa: string, piespData: ResumoRelatorio): string {
  const totalFormatado = piespData.totalMilhoes >= 1000
    ? `R$ ${(piespData.totalMilhoes / 1000).toFixed(1).replace('.', ',')} bilhões`
    : `R$ ${piespData.totalMilhoes.toFixed(0)} milhões`;

  const projetosTexto = piespData.projetos.length > 0
    ? piespData.projetos.map((p, i) =>
        `${i + 1}. Ano ${p.ano} | ${p.municipio} (${p.regiao}) | Setor: ${p.setor} | Tipo: ${p.tipo || 'N/I'} | Valor: R$ ${p.valor_milhoes_reais} mi\n   Descrição: "${p.descricao}"`
      ).join('\n\n')
    : 'Nenhum projeto com valor divulgado encontrado para essa empresa na base PIESP.';

  const setoresTexto = piespData.porSetor.map(s =>
    `- ${s.nome}: R$ ${s.valor} mi (${s.count} projeto${s.count > 1 ? 's' : ''})`
  ).join('\n') || '—';

  const municipiosTexto = piespData.porMunicipio.map(m =>
    `- ${m.nome}: R$ ${m.valor} mi`
  ).join('\n') || '—';

  const porAnoTexto = piespData.porAno.map(a =>
    `- ${a.nome}: R$ ${a.valor} mi (${a.count} projetos)`
  ).join('\n') || '—';

  return `Você é a Nadia, analista sênior de investimentos da Fundação Seade.

O usuário solicitou um dossiê completo e aprofundado sobre: **"${empresa}"**

DADOS INTERNOS DO PIESP — investimentos confirmados no Estado de SP:
- Projetos registrados: ${piespData.total} | Valor total: ${totalFormatado}

PROJETOS DETALHADOS:
${projetosTexto}

CONCENTRAÇÃO SETORIAL (PIESP):
${setoresTexto}

CONCENTRAÇÃO MUNICIPAL (PIESP):
${municipiosTexto}

EVOLUÇÃO DOS ANÚNCIOS POR ANO (PIESP):
${porAnoTexto}

---
INSTRUÇÕES:

Use a ferramenta de busca para pesquisar ativamente as seguintes informações sobre "${empresa}":

1. PERFIL CORPORATIVO — grupo econômico, origem de capital (nacional/estrangeiro), controladores, sede, atividade principal, CNPJs relevantes
2. DESEMPENHO FINANCEIRO — receita líquida, EBITDA, lucro líquido, margem EBITDA, dívida líquida, alavancagem (últimos 2–3 anos disponíveis). Se listada em bolsa: market cap, performance da ação, rating de crédito (Moody's/Fitch/S&P). Se privada e sem dados públicos, declare isso explicitamente.
3. POSIÇÃO DE MERCADO — market share estimado, principais concorrentes, posicionamento competitivo
4. FATOS RECENTES — resultados trimestrais, expansões, fusões/aquisições, desinvestimentos, projetos anunciados (últimos 12–18 meses)
5. ESTRATÉGIA EM SP — o que os dados do PIESP revelam sobre a estratégia da empresa no Estado

Gere um dossiê estruturado em português, usando markdown rico:
- ## para seções principais
- ### para subseções
- **negrito** para métricas e números
- Tabelas markdown (| col | col |) para dados financeiros quando houver múltiplos anos
- - listas para itens

O dossiê deve ter exatamente esta estrutura:

## Perfil Corporativo
(identidade, grupo, capital, sede, atividade)

## Desempenho Financeiro e Econômico
(métricas financeiras com dados quantitativos; use tabela se houver série histórica; declare ausência de dados públicos se for empresa privada sem disclosure)

## Posição de Mercado
(market share, competidores, posicionamento setorial)

## Histórico no Estado de São Paulo — PIESP
(analise os dados internos: valores, municípios, setores, evolução temporal dos projetos)

## Fatos Recentes e Estratégia
(últimos 12–18 meses: resultados, expansões, M&A, projetos)

## Perspectivas e Riscos
(interpretação analítica: vetores de crescimento, riscos regulatórios, ESG, exposição cambial quando relevante)

Você PODE e DEVE inserir MÚLTIPLOS GRÁFICOS no meio do texto para apoiar visualmente sua análise. Para gerar um gráfico, utilize um bloco markdown exato de JSON com a sintaxe \`\`\`json-chart.

Exemplo 1 (Gráfico de Linha para evolução nos Anos):
\`\`\`json-chart
{
  "title": "Evolução dos Investimentos Anunciados (R$ mi)",
  "type": "line",
  "data": [ {"name": "2020", "value": 2366}, {"name": "2021", "value": 3560} ]
}
\`\`\`

Exemplo 2 (Gráfico para Receita Diária, Cidades ou Setores):
\`\`\`json-chart
{
  "title": "Evolução do Faturamento / Receita por Região",
  "type": "bar",
  "data": [ {"name": "2022", "value": 1500}, {"name": "2023", "value": 2100} ]
}
\`\`\`

Para a propriedade \`type\`, use:
- \`line\`: Para mostrar "Evolução temporal" ou séries históricas (mínimo de 3 pontos).
- \`bar\`: Para comparar valores absolutos (Ex: Múltiplas Cidades, Múltiplos Setores).
- \`pie\`: Para exibir divisões proporcionais (Ex: Market share).

**REGRAS CRÍTICAS SOBRE "QUANDO NÃO USAR" GRÁFICOS (DADOS ESCASSOS):**
- Se a empresa tiver atuação em apenas **1 município** na base, NÃO gere gráfico de Concentração Municipal. Apenas cite no texto.
- Se a empresa pertencer a apenas **1 setor** na base, NÃO gere gráfico de Concentração Setorial.
- Se os dados de Evolução temporal tiverem apenas **1 ou 2 anos**, NÃO gere gráfico de linha nem de barras para anos. Use apenas texto.
- O propósito do gráfico é comparar. Se não houver nada para comparar (só existe 1 categoria com 100% do valor), **É PROIBIDO GERAR O BLOCO json-chart** para aquele dado.

Se (e somente se) houver dados suficientes para comparação, inclua gráficos. Não gere gráficos apenas por gerar.`;
}

// ─── Renderizador de dossiê com suporte a citações inline, tabelas e headers ────

interface DossieRendererProps {
  content: string;
  sources: SourceItem[];
}

const DossieRenderer: React.FC<DossieRendererProps> = ({ content, sources }) => {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Parseia inline: **bold**, *italic*, [N] citations
  const parseInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.+?\*\*|\*.+?\*|\[\d+\])/g);
    return parts.filter(Boolean).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={`${keyPrefix}-i${i}`}>{part.slice(1, -1)}</em>;
      }
      const citMatch = part.match(/^\[(\d+)\]$/);
      if (citMatch) {
        const idx = parseInt(citMatch[1], 10) - 1;
        const source = sources[idx];
        if (source) {
          return (
            <a
              key={`${keyPrefix}-c${i}`}
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={e => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setTooltip({ text: source.title, x: rect.left, y: rect.bottom + 4 });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[9px] font-bold align-super mx-0.5 hover:bg-sky-500/40 transition-colors cursor-pointer no-underline leading-none"
            >
              {idx + 1}
            </a>
          );
        }
        return <span key={`${keyPrefix}-c${i}`} className="text-sky-400/50 text-[9px] align-super">{part}</span>;
      }
      return part;
    });
  };

  // Parseia uma linha de tabela: "| col | col |" → array de células
  const parseTableRow = (line: string): string[] =>
    line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

  const isTableSeparator = (line: string) => /^\|[\s\-|:]+\|$/.test(line.trim());
  const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // H2
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={i} className="text-base font-bold text-white mt-6 mb-3 pb-1.5 border-b border-slate-600/50 flex items-center gap-2">
          <span className="w-1 h-4 bg-rose-500 rounded-full inline-block flex-shrink-0" />
          {parseInline(trimmed.slice(3), `h2-${i}`)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={i} className="text-sm font-semibold text-slate-200 mt-4 mb-2">
          {parseInline(trimmed.slice(4), `h3-${i}`)}
        </h3>
      );
      i++;
      continue;
    }

    // Tabela markdown
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      // Primeira linha = cabeçalho, segunda = separador (ignorar), resto = dados
      const header = parseTableRow(tableLines[0]);
      const dataRows = tableLines.slice(2).filter(l => !isTableSeparator(l)).map(parseTableRow);

      blocks.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-600">
                {header.map((cell, ci) => (
                  <th key={ci} className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    {parseInline(cell, `th-${i}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                      {parseInline(cell, `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Lista
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-none space-y-1 my-2 pl-1">
          {listItems.map((item, li) => (
            <li key={li} className="flex items-start gap-2 text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500/60 flex-shrink-0" />
              <span>{parseInline(item, `li-${i}-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Linha vazia
    if (!trimmed) {
      i++;
      continue;
    }

    // Chart
    if (trimmed.startsWith('```json-chart')) {
      const chartLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        chartLines.push(lines[i]);
        i++;
      }
      i++; // skip the closing ```
      
      try {
        const chartData = JSON.parse(chartLines.join('\n'));
        blocks.push(
          <EmbeddedChart 
            key={`chart-${i}`}
            title={chartData.title}
            type={chartData.type}
            data={chartData.data}
          />
        );
      } catch (e) {
        console.error('Failed to parse json-chart block in dossie:', e);
      }
      continue;
    }

    // Parágrafo normal
    blocks.push(
      <p key={i} className="text-slate-300 leading-relaxed my-1.5">
        {parseInline(trimmed, `p-${i}`)}
      </p>
    );
    i++;
  }

  return (
    <div className="relative">
      {blocks}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs bg-slate-700 border border-slate-500 text-slate-200 text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 300), top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

const PerfilEmpresaView: React.FC<PerfilEmpresaViewProps> = ({ onNavigateHome }) => {
  const todasEmpresas = useMemo(() => getUniqueEmpresas(), []);

  const [busca, setBusca] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dossie, setDossie] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresaPesquisada, setEmpresaPesquisada] = useState<string | null>(null);
  const [piespStats, setPiespStats] = useState<{ total: number; totalMilhoes: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sugestoesRef = useRef<HTMLDivElement>(null);

  // Filtra sugestões pelo que o usuário digitou
  const sugestoesFiltradas = useMemo(() => {
    if (busca.trim().length < 2) return [];
    const termo = busca.toLowerCase();
    return todasEmpresas.filter(e => e.toLowerCase().includes(termo)).slice(0, 8);
  }, [busca, todasEmpresas]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sugestoesRef.current && !sugestoesRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setMostrarSugestoes(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGerarDossie = async (nomeEmpresa?: string) => {
    const empresa = (nomeEmpresa || busca).trim();
    if (!empresa) return;

    setIsLoading(true);
    setError(null);
    setDossie(null);
    setSources([]);
    setEmpresaPesquisada(empresa);
    setMostrarSugestoes(false);

    try {
      // 1. Busca dados internos do PIESP
      const piespData = buscarEmpresaNoPiesp(empresa);
      setPiespStats({ total: piespData.total, totalMilhoes: piespData.totalMilhoes });

      // 2. Monta o prompt combinado
      const prompt = buildDossiePrompt(empresa, piespData);

      // 3. Chama Gemini com Google Search habilitado
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      // 4. Extrai fontes e citações do grounding metadata
      const groundingMeta = response.candidates?.[0]?.groundingMetadata;
      const groundingChunks = groundingMeta?.groundingChunks ?? [];
      const groundingSupports = groundingMeta?.groundingSupports ?? [];

      // Monta lista de fontes indexada (posição = índice do chunk)
      const extractedSources: SourceItem[] = groundingChunks
        .map((chunk: any) => chunk.web)
        .map((w: any) => w?.uri && w?.title ? { uri: w.uri, title: w.title } : null)
        .map((s: SourceItem | null) => s ?? { uri: '#', title: 'Fonte não disponível' });

      // Injeta marcadores [N] no texto nas posições exatas retornadas pela API
      const textoBase = response.text || 'Não foi possível gerar o dossiê.';
      const textoCitado = groundingSupports.length > 0
        ? injectInlineCitations(textoBase, groundingSupports)
        : textoBase;

      setDossie(textoCitado);
      setSources(extractedSources);
    } catch (e: any) {
      setError('Nadia (servidores do Google Gemini) está enfrentando uma instabilidade/alta demanda momentânea. Por favor, aguarde alguns segundos e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGerarDossie();
    }
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
      `}</style>

      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Header interno */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/50 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-rose-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Perfil de Empresa</h1>
              <p className="text-xs text-slate-400">Dados PIESP + pesquisa na internet</p>
            </div>
          </div>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-300 text-sm transition-all"
          >
            Voltar
          </button>
        </header>

        {/* Barra de busca */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-700/50">
          <div className="max-w-2xl mx-auto relative">
            <p className="text-xs text-slate-400 mb-2">
              Digite o nome de uma empresa para gerar um dossiê com dados do PIESP e informações da internet.
            </p>
            <div className="flex gap-3">
              <div className="flex-grow relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={busca}
                  onChange={e => {
                    setBusca(e.target.value);
                    setMostrarSugestoes(true);
                  }}
                  onFocus={() => setMostrarSugestoes(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: Volkswagen, Petrobras, Ambev..."
                  className="w-full bg-slate-800/60 border border-slate-600/60 text-slate-200 placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                  disabled={isLoading}
                />
                {/* Dropdown de sugestões */}
                {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
                  <div
                    ref={sugestoesRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600/60 rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    {sugestoesFiltradas.map(empresa => (
                      <button
                        key={empresa}
                        onClick={() => {
                          setBusca(empresa);
                          setMostrarSugestoes(false);
                          handleGerarDossie(empresa);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                      >
                        {empresa}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleGerarDossie()}
                disabled={isLoading || !busca.trim()}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors whitespace-nowrap"
              >
                {isLoading ? 'Gerando...' : 'Gerar Dossiê'}
              </button>
            </div>
          </div>
        </div>

        {/* Área do dossiê */}
        <main className="flex-grow overflow-y-auto custom-scrollbar p-6">
          {!dossie && !isLoading && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
              <div>
                <p className="text-slate-400 font-medium">Nenhum dossiê gerado ainda</p>
                <p className="text-slate-500 text-sm mt-1">Busque uma empresa pelo nome acima</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <SmallNadiaSphere />
              <div className="text-center">
                <p className="text-slate-400 animate-pulse text-sm">
                  A Nadia está pesquisando {empresaPesquisada}...
                </p>
                <p className="text-slate-500 text-xs mt-1">Consultando PIESP e buscando na internet</p>
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-2xl mx-auto bg-rose-900/20 border border-rose-700/50 rounded-lg p-4 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {dossie && !isLoading && (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Stats rápidos */}
              {piespStats && (
                <div className="flex gap-4 mb-6 flex-wrap">
                  <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                    <p className="text-xs text-slate-400">Projetos no PIESP</p>
                    <p className="text-xl font-bold text-white">{piespStats.total}</p>
                  </div>
                  {piespStats.totalMilhoes > 0 && (
                    <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                      <p className="text-xs text-slate-400">Valor total investido em SP</p>
                      <p className="text-xl font-bold text-rose-400">
                        {piespStats.totalMilhoes >= 1000
                          ? `R$ ${(piespStats.totalMilhoes / 1000).toFixed(1).replace('.', ',')} bi`
                          : `R$ ${piespStats.totalMilhoes.toFixed(0)} mi`}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                    <p className="text-xs text-slate-400">Empresa pesquisada</p>
                    <p className="text-base font-bold text-white truncate max-w-48">{empresaPesquisada}</p>
                  </div>
                </div>
              )}

              {/* Dossiê */}
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-6">
                <DossieRenderer content={dossie} sources={sources} />
              </div>

              {/* Fontes numeradas */}
              {sources.length > 0 && (
                <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Fontes consultadas
                  </h4>
                  <ol className="space-y-1.5 list-none">
                    {sources.map((source, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[9px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 hover:underline text-xs leading-relaxed"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center pt-2">
                Dossiê gerado pela Nadia combinando dados internos do PIESP com pesquisa na internet. Valide informações críticas nas fontes originais.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default PerfilEmpresaView;
