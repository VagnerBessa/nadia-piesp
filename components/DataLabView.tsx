import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import { filtrarParaRelatorio, getMetadados, FiltroRelatorio, ResumoRelatorio } from '../services/piespDataService';
import { DynamicDashboard, DashboardData, parseDashboard } from './DynamicDashboard';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import DESIGN_SKILL from '../skills/datalab_design.md?raw';

interface DataLabViewProps {
  onNavigateHome: () => void;
}

// ───────────────────────────────────────────────
// Prompts
// ───────────────────────────────────────────────

// Carregado uma vez — metadados não mudam durante a sessão
const _metadadosDataLab = getMetadados();

function buildExtractFiltersPrompt(query: string): string {
  const regioesList = _metadadosDataLab.regioes.length > 0
    ? _metadadosDataLab.regioes.join(', ')
    : 'Região Metropolitana de São Paulo, Região Administrativa de Campinas, Região Administrativa de Sorocaba';

  return `Você é um extrator de filtros para a base de dados PIESP (investimentos no Estado de SP).

O usuário fez a seguinte solicitação de análise:
"${query}"

Extraia os filtros de busca e retorne APENAS um objeto JSON válido, sem texto adicional:
{
  "municipio": "nome do município específico se mencionado, senão omita",
  "setor": "um de: Agropecuária, Comércio, Indústria, Infraestrutura, Serviços — apenas se mencionado",
  "regiao": "nome EXATO da região, copiado da lista abaixo — apenas se o usuário mencionar uma região, senão omita",
  "ano": "ano com 4 dígitos se mencionado, senão omita",
  "termo_busca": "palavra-chave temática (ex: 'energia', 'automóvel', 'data center') se a análise for sobre tema específico, senão omita"
}

Regiões válidas na base (usar o nome exato): ${regioesList}

Omita campos não mencionados. Retorne apenas o JSON.`;
}

function buildDashboardPrompt(query: string, resumo: ResumoRelatorio): string {
  const totalBi = (resumo.totalMilhoes / 1000).toFixed(1).replace('.', ',');

  const projetosTexto = resumo.projetos.slice(0, 12).map((p, i) =>
    `${i + 1}. ${p.empresa} | ${p.municipio} | ${p.setor} | ${p.ano} | R$ ${p.valor_milhoes_reais} mi`
  ).join('\n');

  const porSetorTexto  = resumo.porSetor.map(s => `${s.nome}: R$ ${s.valor} mi (${s.count} proj)`).join(' | ');
  const porMunicipioTexto = resumo.porMunicipio.slice(0, 8).map(m => `${m.nome}: R$ ${m.valor} mi (${m.count} proj)`).join(' | ');
  const porAnoTexto    = resumo.porAno.map(a => `${a.nome}: R$ ${a.valor} mi`).join(' | ');
  const porRegiaoTexto = resumo.porRegiao.slice(0, 5).map(r => `${r.nome}: R$ ${r.valor} mi (${r.count} proj)`).join(' | ');

  return `Você é a Nadia, analista de dados da Fundação Seade. O usuário pediu no Data Lab:
"${query}"

DADOS DO PIESP FILTRADOS:
- Total de projetos: ${resumo.total}
- Valor total: R$ ${resumo.totalMilhoes} mi (R$ ${totalBi} bi)
- Por setor: ${porSetorTexto || '(sem dados)'}
- Por município (top 8): ${porMunicipioTexto || '(sem dados)'}
- Por região: ${porRegiaoTexto || '(sem dados)'}
- Por ano: ${porAnoTexto || '(sem dados)'}

TOP PROJETOS:
${projetosTexto || '(sem projetos)'}

═══════════════════════════════════════════════════════
CATÁLOGO DE COMPONENTES DISPONÍVEIS
═══════════════════════════════════════════════════════

Você pode usar qualquer combinação dos seguintes tipos de seção:

1. "kpi-cards" — cards de métricas principais
   { "tipo": "kpi-cards", "cards": [
       { "label": "texto", "valor": "texto", "detalhe": "opcional", "tendencia": "up|down|neutral" }
   ]}
   → Use tendencia "up" para crescimento, "down" para queda, omita se não aplicável

2. "chart" — gráficos visuais (escolha o tipo mais adequado):
   { "tipo": "chart", "chart": { "type": "TIPO", "title": "texto", "data": [{"name":"","value":0}] }}

   Tipos disponíveis:
   • "bar"            → barras verticais — ranking de setores, regiões, tipos
   • "bar-horizontal" → barras horizontais — top empresas ou municípios (nomes longos)
   • "line"           → linha temporal — evolução ano a ano (dados escassos)
   • "area"           → área preenchida — evolução temporal com volume (dados ricos, 5+ anos)
   • "pie"            → pizza — distribuição proporcional entre categorias (≤ 6 fatias)
   • "composed"       → barra + linha sobrepostas — valor absoluto + tendência simultâneos
                        (adicione campo "linha": número nos itens de data para a linha)

3. "bar-list" — ranking textual com barra de proporção (sem eixos, mais limpo que chart)
   { "tipo": "bar-list", "titulo": "opcional", "items": [
       { "name": "texto", "value": 1500, "label": "R$ 1,5 bi" }
   ]}
   → Ideal para top 5-10 empresas ou municípios

4. "tabela" — tabela detalhada de projetos
   { "tipo": "tabela", "titulo": "opcional",
     "colunas": ["Col1","Col2"], "linhas": [["val","val"]] }

5. "texto" — análise narrativa interpretativa
   { "tipo": "texto", "conteudo": "parágrafos separados por \\n\\n" }

═══════════════════════════════════════════════════════
REGRAS DE LAYOUT ADAPTATIVO
═══════════════════════════════════════════════════════

Detecte o tipo de análise e monte o layout adequado:

SE FOR COMPARAÇÃO (dois ou mais municípios, empresas, setores comparados entre si):
  → kpi-cards com os totais de cada entidade (use detalhe para identificar qual é qual)
  → "bar-horizontal" ou "composed" mostrando os dois lados lado a lado
  → "bar-list" por empresa para cada entidade se houver dados suficientes
  → "tabela" com as colunas das entidades comparadas
  → "texto" com a interpretação da comparação

SE FOR EVOLUÇÃO TEMPORAL (histórico, tendência, série de anos):
  → kpi-cards com tendencia (up/down) comparando período inicial vs final
  → "area" obrigatório para evolução (use "line" se houver menos de 4 anos de dados)
  → "composed" se quiser mostrar valor absoluto + linha de crescimento ao mesmo tempo
  → "bar" setorial ou regional do período
  → "texto" sobre a trajetória

SE FOR RANKING / TOP N (maiores, principais, mais relevantes):
  → kpi-cards com totais gerais
  → "bar-list" como peça central do ranking
  → "bar-horizontal" para comparação visual
  → "pie" de distribuição proporcional
  → "tabela" detalhada
  → "texto" sobre os destaques

SE FOR TEMÁTICO / SETORIAL (setor específico, tema como energia, automóvel, etc.):
  → kpi-cards do tema
  → "pie" de distribuição geográfica ou por tipo
  → "bar" ou "bar-list" de empresas do setor
  → "area" ou "line" de evolução temporal do setor
  → "tabela" dos principais projetos
  → "texto" sobre o setor

SE FOR ANÁLISE GERAL (sem recorte específico):
  → kpi-cards gerais + "area" temporal + "bar" setorial + "pie" regional + "bar-list" municípios + "tabela" + "texto"

${DESIGN_SKILL}

═══════════════════════════════════════════════════════
REGRAS INVIOLÁVEIS DE SAÍDA
- Retorne APENAS o bloco \`\`\`json-dashboard, sem texto fora dele
- "value" nos dados de gráficos deve ser NÚMERO puro (sem R$, sem "mi", sem vírgula)
- Use SOMENTE dados numéricos reais da seção de dados acima — nunca invente ou estime
- O campo "label" no bar-list é o texto formatado exibido (ex: "R$ 2,1 bi")
- "texto" deve ser interpretativo e analítico, não uma lista dos números já visíveis nos gráficos
- Mínimo absoluto: 1 kpi-cards + 2 seções visuais (chart ou bar-list) + 1 texto

\`\`\`json-dashboard
{
  "titulo": "...",
  "subtitulo": "...",
  "secoes": [ ... ]
}
\`\`\``;
}

// ───────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────

const DataLabView: React.FC<DataLabViewProps> = ({ onNavigateHome }) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const { text: speechText, isListening, startListening, stopListening, hasRecognitionSupport } = useSpeechRecognition();
  const prevIsListening = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sincroniza texto do speech recognition no input
  useEffect(() => {
    if (speechText) setInputValue(speechText);
  }, [speechText]);

  // Auto-envia quando o reconhecimento de voz termina
  useEffect(() => {
    if (prevIsListening.current && !isListening && inputValue.trim()) {
      handleAnalyse(inputValue.trim());
    }
    prevIsListening.current = isListening;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const handleAnalyse = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setDashboard(null);
    setInputValue('');

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // ── Passo 1: extrai filtros da linguagem natural ──
      setLoadingStep('Interpretando sua solicitação...');
      const filterResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: buildExtractFiltersPrompt(query) }] }],
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });

      let filtros: FiltroRelatorio = {};
      try {
        const raw = filterResponse.text?.trim() || '{}';
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        filtros = JSON.parse(cleaned);
      } catch {
        // Se falhar o parse, segue sem filtros (base completa)
      }

      // ── Passo 2: consulta determinística no CSV ──
      setLoadingStep('Consultando a base PIESP...');
      const resumo = filtrarParaRelatorio(filtros);

      if (resumo.total === 0) {
        setError('Nenhum projeto encontrado com esses critérios. Tente uma busca mais ampla.');
        setIsLoading(false);
        return;
      }

      // ── Passo 3: gera o json-dashboard ──
      setLoadingStep(`Analisando ${resumo.total} projetos (R$ ${(resumo.totalMilhoes / 1000).toFixed(1).replace('.', ',')} bi)...`);
      const dashResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: buildDashboardPrompt(query, resumo) }] }],
        config: { thinkingConfig: { thinkingBudget: 1024 } },
      });

      const parsed = parseDashboard(dashResponse.text || '');
      if (!parsed) {
        setError('A Nadia não conseguiu gerar o dashboard. Tente reformular a solicitação.');
        setIsLoading(false);
        return;
      }

      setDashboard(parsed);
      setQueryHistory(prev => [query, ...prev.slice(0, 4)]);
    } catch (e: any) {
      setError(`Erro: ${e?.message || 'Falha desconhecida.'}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyse(inputValue);
    }
  };

  const handleMic = () => {
    if (isListening) stopListening();
    else startListening();
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
              <h1 className="text-lg font-bold text-slate-100">Data Lab</h1>
              <p className="text-xs text-slate-400">Dashboards gerados pela Nadia sob demanda</p>
            </div>
          </div>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 rounded-full bg-slate-800/70 hover:bg-slate-700/90 border border-slate-700 text-slate-300 text-sm transition-all"
          >
            Voltar
          </button>
        </header>

        {/* Área de prompt */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/30 bg-slate-900/30">
          <div className="max-w-3xl mx-auto">
            {/* Chips de histórico */}
            {queryHistory.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {queryHistory.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnalyse(q)}
                    disabled={isLoading}
                    className="text-xs px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all disabled:opacity-40"
                  >
                    {q.length > 40 ? q.slice(0, 40) + '…' : q}
                  </button>
                ))}
              </div>
            )}

            {/* Caixa de input */}
            <div className="flex gap-3 items-end">
              <div className="flex-grow relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Ouvindo…' : 'Ex: Analise os investimentos em Franca, compare Campinas e Sorocaba em 2025, mostre o setor de energia…'}
                  rows={2}
                  disabled={isLoading}
                  className={`w-full bg-slate-800/60 border rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 text-sm resize-none focus:outline-none transition-colors ${
                    isListening ? 'border-rose-500/70 bg-rose-950/20' : 'border-slate-600/60 focus:border-rose-500/60'
                  } disabled:opacity-50`}
                />
                {/* Mic button dentro do input */}
                {hasRecognitionSupport && (
                  <button
                    onClick={handleMic}
                    disabled={isLoading}
                    title={isListening ? 'Parar gravação' : 'Falar com a Nadia'}
                    className={`absolute right-3 bottom-3 p-1.5 rounded-full transition-all ${
                      isListening
                        ? 'text-rose-400 bg-rose-500/20 animate-pulse'
                        : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                    } disabled:opacity-40`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Botão analisar */}
              <button
                onClick={() => handleAnalyse(inputValue)}
                disabled={isLoading || !inputValue.trim()}
                className="flex-shrink-0 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {isLoading ? '…' : 'Analisar'}
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 ml-1">
              Pressione Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>

        {/* Área do dashboard */}
        <main className="flex-grow overflow-y-auto custom-scrollbar px-6 py-6">
          <div className="max-w-4xl mx-auto">

            {/* Estado vazio */}
            {!dashboard && !isLoading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50 pt-16">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
                <div>
                  <p className="text-slate-400 font-medium">Nenhuma análise gerada</p>
                  <p className="text-slate-500 text-sm mt-1">Descreva o que quer analisar ou fale com a Nadia</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {[
                    'Analise os investimentos em Franca',
                    'Compare Campinas e Sorocaba em 2025',
                    'Mostre o setor de energia no estado',
                    'Investimentos industriais no interior',
                  ].map(sugestao => (
                    <button
                      key={sugestao}
                      onClick={() => { setInputValue(sugestao); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-4 pt-16">
                <SmallNadiaSphere />
                <p className="text-slate-400 animate-pulse text-sm">{loadingStep || 'Processando...'}</p>
              </div>
            )}

            {/* Erro */}
            {error && !isLoading && (
              <div className="bg-rose-900/20 border border-rose-700/50 rounded-xl p-4 text-rose-300 text-sm max-w-xl mx-auto">
                {error}
              </div>
            )}

            {/* Dashboard gerado */}
            {dashboard && !isLoading && (
              <div className="bg-slate-800/20 rounded-2xl border border-slate-700/40 p-6">
                <DynamicDashboard data={dashboard} />
                <p className="text-xs text-slate-500 text-center pt-6 mt-4 border-t border-slate-700/30">
                  Dashboard gerado pela Nadia com dados do PIESP. Valide informações críticas na fonte oficial.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default DataLabView;
