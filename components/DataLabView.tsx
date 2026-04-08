import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import { filtrarParaRelatorio, FiltroRelatorio, ResumoRelatorio } from '../services/piespDataService';
import { DynamicDashboard, DashboardData, parseDashboard } from './DynamicDashboard';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface DataLabViewProps {
  onNavigateHome: () => void;
}

// ───────────────────────────────────────────────
// Prompts
// ───────────────────────────────────────────────

function buildExtractFiltersPrompt(query: string): string {
  return `Você é um extrator de filtros para a base de dados PIESP (investimentos no Estado de SP).

O usuário fez a seguinte solicitação de análise:
"${query}"

Extraia os filtros de busca e retorne APENAS um objeto JSON válido, sem texto adicional:
{
  "municipio": "nome do município se mencionado, senão omita",
  "setor": "um de: Agropecuária, Comércio, Indústria, Infraestrutura, Serviços — apenas se mencionado",
  "regiao": "nome da região administrativa de SP se mencionada, senão omita",
  "ano": "ano com 4 dígitos se mencionado, senão omita",
  "termo_busca": "palavra-chave temática (ex: 'energia', 'automóvel', 'data center') se a análise for sobre tema específico, senão omita"
}

Omita campos não mencionados. Retorne apenas o JSON.`;
}

function buildDashboardPrompt(query: string, resumo: ResumoRelatorio): string {
  const totalBi = (resumo.totalMilhoes / 1000).toFixed(1).replace('.', ',');

  const projetosTexto = resumo.projetos.slice(0, 12).map((p, i) =>
    `${i + 1}. ${p.empresa} | ${p.municipio} | ${p.setor} | ${p.ano} | R$ ${p.valor_milhoes_reais} mi`
  ).join('\n');

  const porSetorTexto = resumo.porSetor.map(s => `${s.nome}: R$ ${s.valor} mi (${s.count} projetos)`).join(' | ');
  const porMunicipioTexto = resumo.porMunicipio.slice(0, 6).map(m => `${m.nome}: R$ ${m.valor} mi`).join(' | ');
  const porAnoTexto = resumo.porAno.map(a => `${a.nome}: R$ ${a.valor} mi`).join(' | ');
  const porRegiaoTexto = resumo.porRegiao.slice(0, 5).map(r => `${r.nome}: R$ ${r.valor} mi`).join(' | ');

  return `Você é a Nadia, analista de dados da Fundação Seade. O usuário pediu no Data Lab:
"${query}"

DADOS DO PIESP FILTRADOS:
- Total de projetos: ${resumo.total}
- Valor total: R$ ${resumo.totalMilhoes} mi (R$ ${totalBi} bi)
- Por setor: ${porSetorTexto || '(sem dados)'}
- Por município (top 6): ${porMunicipioTexto || '(sem dados)'}
- Por região: ${porRegiaoTexto || '(sem dados)'}
- Por ano: ${porAnoTexto || '(sem dados)'}

TOP PROJETOS:
${projetosTexto || '(sem projetos)'}

TAREFA: Gere um dashboard analítico completo. Retorne APENAS um bloco \`\`\`json-dashboard com esta estrutura exata:

\`\`\`json-dashboard
{
  "titulo": "título descritivo da análise",
  "subtitulo": "período e escopo",
  "secoes": [
    {
      "tipo": "kpi-cards",
      "cards": [
        { "label": "Total Investido", "valor": "R$ X bi", "detalhe": "em Y projetos" },
        { "label": "Principal Setor", "valor": "Nome", "detalhe": "R$ X mi" },
        { "label": "Principal Município", "valor": "Nome", "detalhe": "R$ X mi" },
        { "label": "Ano de Pico", "valor": "XXXX", "detalhe": "R$ X mi" }
      ]
    },
    {
      "tipo": "chart",
      "chart": {
        "type": "line",
        "title": "Evolução Anual dos Investimentos (R$ mi)",
        "data": [{ "name": "2020", "value": 0 }]
      }
    },
    {
      "tipo": "chart",
      "chart": {
        "type": "bar",
        "title": "Investimentos por Setor (R$ mi)",
        "data": [{ "name": "Setor", "value": 0 }]
      }
    },
    {
      "tipo": "chart",
      "chart": {
        "type": "pie",
        "title": "Distribuição por Região",
        "data": [{ "name": "Região", "value": 0 }]
      }
    },
    {
      "tipo": "tabela",
      "titulo": "Maiores Projetos",
      "colunas": ["Empresa", "Município", "Setor", "Ano", "Valor (R$ mi)"],
      "linhas": [["Empresa", "Município", "Setor", "Ano", "Valor"]]
    },
    {
      "tipo": "texto",
      "conteudo": "Análise interpretativa em 3-4 parágrafos: padrões encontrados, concentrações geográficas/setoriais, destaques e o que os dados sinalizam."
    }
  ]
}
\`\`\`

REGRAS OBRIGATÓRIAS:
- Inclua EXATAMENTE os 4 KPIs, 3 gráficos (line cronológico, bar por setor, pie por região), 1 tabela e 1 texto analítico
- Use apenas dados numéricos reais fornecidos acima — nunca invente valores
- O campo "value" nos gráficos deve ser número (sem R$, sem unidade)
- A tabela deve listar os top 8 projetos reais com valores corretos
- O texto analítico deve ser interpretativo, não apenas descritivo`;
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
