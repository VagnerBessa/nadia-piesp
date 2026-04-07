import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import { getUniqueEmpresas, buscarEmpresaNoPiesp, ResumoRelatorio } from '../services/piespDataService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { Source } from '../hooks/useChat';

interface PerfilEmpresaViewProps {
  onNavigateHome: () => void;
}

function buildDossiePrompt(empresa: string, piespData: ResumoRelatorio): string {
  const totalBi = piespData.totalMilhoes >= 1000
    ? `R$ ${(piespData.totalMilhoes / 1000).toFixed(1).replace('.', ',')} bilhões`
    : `R$ ${piespData.totalMilhoes.toFixed(0)} milhões`;

  const projetosTexto = piespData.projetos.length > 0
    ? piespData.projetos.map((p, i) =>
        `${i + 1}. Ano: ${p.ano} | Município: ${p.municipio} (${p.regiao}) | Setor: ${p.setor} | Tipo: ${p.tipo || 'N/I'} | Valor: R$ ${p.valor_milhoes_reais} mi\n   Descrição: "${p.descricao}"`
      ).join('\n\n')
    : 'Nenhum projeto com valor divulgado encontrado na base do PIESP para essa empresa.';

  const setoresTexto = piespData.porSetor.map(s =>
    `- ${s.nome}: R$ ${s.valor} mi (${s.count} projeto${s.count > 1 ? 's' : ''})`
  ).join('\n') || '—';

  const municipiosTexto = piespData.porMunicipio.map(m =>
    `- ${m.nome}: R$ ${m.valor} mi`
  ).join('\n') || '—';

  return `Você é a Nadia, analista de investimentos da Fundação Seade especializada no PIESP.

O usuário solicitou um dossiê completo sobre a empresa: **"${empresa}"**

DADOS INTERNOS DO PIESP (base de investimentos confirmados no Estado de SP):
- Total de projetos registrados: ${piespData.total}
- Valor total investido no Estado de SP: ${totalBi}

PROJETOS DETALHADOS:
${projetosTexto}

CONCENTRAÇÃO SETORIAL:
${setoresTexto}

CONCENTRAÇÃO MUNICIPAL:
${municipiosTexto}

---
Sua tarefa:
1. Use a ferramenta de busca para pesquisar na internet informações sobre a empresa "${empresa}", incluindo: perfil corporativo, grupo econômico ao qual pertence, origem do capital (nacional/estrangeiro), notícias recentes e contexto setorial.
2. Combine essas informações com os dados internos do PIESP acima.
3. Gere um dossiê completo em português, bem estruturado com markdown (## seções, **negrito**, - listas).

O dossiê deve conter:

## Perfil Corporativo
(quem é a empresa, origem de capital, grupo econômico, sede, atividade principal)

## Histórico de Investimentos no Estado de São Paulo (PIESP)
(analise os dados internos: valores, localização, setores, evolução temporal)

## Presença e Estratégia no Estado
(o que os investimentos revelam sobre a estratégia da empresa em SP)

## Últimas Notícias e Contexto Atual
(baseado na busca na internet: expansões, resultados recentes, projetos anunciados)

## Perspectivas
(interpretação analítica: para onde a empresa parece estar indo, riscos e oportunidades)

Seja analítico e baseado em evidências. Não use adjetivos vazios. Cite fontes quando relevante.`;
}

const PerfilEmpresaView: React.FC<PerfilEmpresaViewProps> = ({ onNavigateHome }) => {
  const todasEmpresas = useMemo(() => getUniqueEmpresas(), []);

  const [busca, setBusca] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [dossie, setDossie] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
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
          thinkingConfig: { thinkingBudget: 2048 },
        },
      });

      // 4. Extrai fontes do grounding
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let extractedSources: Source[] = [];
      if (groundingChunks) {
        extractedSources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((w: any) => w?.uri && w?.title)
          .map((w: any) => ({ uri: w.uri, title: w.title }))
          .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.uri === v.uri) === i);
      }

      setDossie(response.text || 'Não foi possível gerar o dossiê.');
      setSources(extractedSources);
    } catch (e: any) {
      setError(`Erro ao gerar dossiê: ${e?.message || 'Falha desconhecida.'}`);
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
            <ChatHeaderSphere />
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
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-6 text-slate-200">
                <MarkdownRenderer content={dossie} />
              </div>

              {/* Fontes */}
              {sources.length > 0 && (
                <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Fontes consultadas na internet
                  </h4>
                  <ul className="space-y-1.5">
                    {sources.map((source, i) => (
                      <li key={i}>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 hover:underline text-xs truncate block"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
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
