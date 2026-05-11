import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateWithFallback } from '../services/geminiService';
import { getMetadados, filtrarParaRelatorio, FiltroRelatorio, ResumoRelatorio } from '../services/piespDataService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';
import CapivaraPet, { PetState } from './CapivaraPet';

interface ExplorarDadosViewProps {
  onNavigateHome: () => void;
}

const TODOS = '';

function buildPrompt(filtros: FiltroRelatorio, resumo: ResumoRelatorio): string {
  const filtroDesc = [
    filtros.setor ? `Setor: ${filtros.setor}` : null,
    filtros.regiao ? `Região: ${filtros.regiao}` : null,
    filtros.ano && filtros.ano.length > 0 ? `Ano(s) de Anúncio: ${filtros.ano.join(', ')}` : null,
    filtros.ano_inicio || filtros.ano_fim ? `Período de Execução: ${filtros.ano_inicio || 'Início'} a ${filtros.ano_fim || 'Fim'}` : null,
    filtros.tipo ? `Tipo de investimento: ${filtros.tipo}` : null,
  ].filter(Boolean).join(' | ') || 'Sem filtros específicos (base completa)';

  const totalBi = (resumo.total_investimentos / 1000).toFixed(1).replace('.', ',');

  const projetosTexto = resumo.projetos.slice(0, 15).map((p, i) =>
    `${i + 1}. ${p.empresa} — ${p.municipio} (${p.regiao}), ${p.ano}, Setor: ${p.setor}, Tipo: ${p.tipo || 'N/I'}, Valor: R$ ${p.valor_milhoes_reais} mi — "${p.descricao}"`
  ).join('\n');

  const porSetorTexto = resumo.setores.map(s =>
    `- ${s.nome}: R$ ${s.valor} mi em ${s.count} projeto(s)`
  ).join('\n');

  const porMunicipioTexto = resumo.municipios.map(m =>
    `- ${m.nome}: R$ ${m.valor} mi em ${m.count} projeto(s)`
  ).join('\n');

  const porRegiaoTexto = resumo.regioes.map(r =>
    `- ${r.nome}: R$ ${r.valor} mi em ${r.count} projeto(s)`
  ).join('\n');

  const porAnoTexto = resumo.evolucao_anual.map(a =>
    `- ${a.nome}: R$ ${a.valor} mi em ${a.count} projeto(s)`
  ).join('\n');

  return `Você é a Nadia, analista de investimentos da Fundação Seade especializada no PIESP (Pesquisa de Investimentos no Estado de São Paulo).

O usuário solicitou um relatório analítico com o seguinte recorte:
**${filtroDesc}**

DADOS FILTRADOS DO PIESP:
- Total de projetos encontrados: ${resumo.total_projetos}
- Valor total: R$ ${resumo.total_investimentos} milhões (R$ ${totalBi} bilhões)

PRINCIPAIS PROJETOS (top 15 por valor):
${projetosTexto}

DISTRIBUIÇÃO POR SETOR:
${porSetorTexto || '(sem dados)'}

DISTRIBUIÇÃO POR MUNICÍPIO:
${porMunicipioTexto || '(sem dados)'}

DISTRIBUIÇÃO POR REGIÃO:
${porRegiaoTexto || '(sem dados)'}

EVOLUÇÃO DOS ANÚNCIOS POR ANO:
${porAnoTexto || '(sem dados)'}

---
Com base exclusivamente nesses dados do PIESP, gere um relatório executivo analítico e bem estruturado em português. Use markdown (## para seções, **negrito** para destaques, - para listas). O relatório deve conter:

## Resumo Executivo
(síntese dos números principais e o que se destaca)

## Principais Projetos e Empresas
(analise os maiores investimentos, quem são as empresas, o que planejam)

## Padrões Setoriais e Regionais
(o que os dados revelam sobre concentrações geográficas e setoriais)

## Análise e Perspectivas
(interpretação analítica: o que esses investimentos sinalizam, implicações para o estado)

Seja analítico, não apenas descritivo. Evite adjetivos vagos como "importante", "significativo" ou "crucial". Deixe que os números falem.

Você PODE e DEVE inserir MÚLTIPLOS GRÁFICOS no meio do texto para apoiar visualmente sua análise. Para gerar um gráfico, utilize um bloco markdown exato de JSON com a sintaxe \`\`\`json-chart.

Exemplo 1 (Gráfico de Linha para evolução nos Anos):
\`\`\`json-chart
{
  "title": "Evolução dos Investimentos Anunciados (R$ mi)",
  "type": "line",
  "data": [ {"name": "2020", "value": 2366}, {"name": "2021", "value": 3560} ]
}
\`\`\`

Exemplo 2 (Gráfico para Cidades ou Setores):
\`\`\`json-chart
{
  "title": "Investimentos por Município (R$ mi)",
  "type": "bar",
  "data": [ {"name": "São Paulo", "value": 2366}, {"name": "Cajamar", "value": 356} ]
}
\`\`\`

Para a propriedade \`type\`, use OBRIGATORIAMENTE:
- \`line\`: Para mostrar "Evolução temporal" ou séries históricas (mínimo de 3 pontos).
- \`bar\`: Para comparar valores absolutos (Cidades, Regiões, Principais Setores).
- \`pie\`: Para exibir divisões/share.

**REGRAS CRÍTICAS SOBRE "QUANDO NÃO USAR" GRÁFICOS (DADOS ESCASSOS):**
- Se houver projetos em apenas **1 município**, NÃO gere gráfico de Distribuição por Município. Apenas cite no texto.
- Se houver projetos em apenas **1 setor** ou **1 região**, NÃO gere gráfico de Distribuição.
- Se os dados de Evolução temporal tiverem apenas **1 ou 2 anos**, NÃO gere gráfico de linha nem de barras para anos. Use apenas texto.
- O propósito do gráfico é comparar. Se não houver nada para comparar (só existe 1 categoria com 100% do valor em qualquer dimensão), **É PROIBIDO GERAR O BLOCO json-chart** para aquele dado.

Se (e somente se) houver dados suficientes para comparação, procure incluir 2 a 3 gráficos de frentes diferentes (ex: cronológica, ranking de cidades, setores) distribuídos logicamente entre as seções. Não gere gráficos apenas por gerar. Insira gráficos apenas com os dados brutos numéricos listados nesta prompt.`;
}

const ExplorarDadosView: React.FC<ExplorarDadosViewProps> = ({ onNavigateHome }) => {
  const [metadados, setMetadados] = useState<{
    setores: string[]; regioes: string[]; anos: string[]; tipos: string[];
  }>({ setores: [], regioes: [], anos: [], tipos: [] });

  useEffect(() => {
    getMetadados().then(setMetadados).catch(console.error);
  }, []);

  const [setor, setSetor] = useState('');
  const [regiao, setRegiao] = useState('');
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [anoInicio, setAnoInicio] = useState('');
  const [anoFim, setAnoFim] = useState('');
  const [tipo, setTipo] = useState('');

  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumoStats, setResumoStats] = useState<{ total: number; totalMilhoes: number } | null>(null);
  const [previewCount, setPreviewCount] = useState(0);

  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [chartsShowing, setChartsShowing] = useState(false);
  const [chartsOpacity, setChartsOpacity] = useState(1);
  const [petPostStream, setPetPostStream] = useState(false);
  const [glassesActive, setGlassesActive] = useState(false);

  const [anoDropdownOpen, setAnoDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAnoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const minAnoAnuncio = anosSelecionados.length > 0 ? Math.min(...anosSelecionados.map(Number)) : null;

  useEffect(() => {
    let changed = false;
    let newAnoInicio = anoInicio;
    let newAnoFim = anoFim;

    if (minAnoAnuncio) {
      if (newAnoInicio && Number(newAnoInicio) < minAnoAnuncio) { newAnoInicio = ''; changed = true; }
      if (newAnoFim && Number(newAnoFim) < minAnoAnuncio) { newAnoFim = ''; changed = true; }
    }

    if (newAnoInicio && newAnoFim && Number(newAnoFim) < Number(newAnoInicio)) {
      newAnoFim = '';
      changed = true;
    }

    if (changed) {
      if (newAnoInicio !== anoInicio) setAnoInicio(newAnoInicio);
      if (newAnoFim !== anoFim) setAnoFim(newAnoFim);
    }
  }, [minAnoAnuncio, anoInicio, anoFim]);

  const opcoesPeriodo = useMemo(() => {
    return metadados.anos.filter(a => minAnoAnuncio ? Number(a) >= minAnoAnuncio : true);
  }, [metadados.anos, minAnoAnuncio]);

  // Preview count — atualiza sempre que os filtros mudam
  useEffect(() => {
    const filtro: FiltroRelatorio = {
      setor: setor || undefined,
      regiao: regiao || undefined,
      ano: anosSelecionados.length > 0 ? anosSelecionados : undefined,
      tipo: tipo || undefined,
      ano_inicio: anoInicio || undefined,
      ano_fim: anoFim || undefined,
    };
    filtrarParaRelatorio(filtro).then(r => setPreviewCount(r.total_projetos)).catch(() => setPreviewCount(0));
  }, [setor, regiao, anosSelecionados, tipo, anoInicio, anoFim]);

  // Transição escalonada: charts somem → pet muda → óculos aparecem
  useEffect(() => {
    if (isStreaming) {
      setChartsShowing(true);
      setChartsOpacity(1);
      setPetPostStream(false);
      setGlassesActive(false);
    } else if (chartsShowing) {
      requestAnimationFrame(() => setChartsOpacity(0));   // inicia fade CSS (0.8s)
      const t1 = setTimeout(() => setPetPostStream(true), 350);   // typing → idle
      const t2 = setTimeout(() => setGlassesActive(true), 550);   // óculos aparecem
      const t3 = setTimeout(() => setChartsShowing(false), 880);  // remove DOM
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isStreaming]);

  // Inicia streaming quando o relatório chega
  useEffect(() => {
    if (!relatorio || isLoading) return;
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setStreamedText('');
    setIsStreaming(true);
    let i = 0;
    const full = relatorio;
    streamIntervalRef.current = setInterval(() => {
      i += 8;
      if (i >= full.length) {
        setStreamedText(full);
        setIsStreaming(false);
        clearInterval(streamIntervalRef.current!);
      } else {
        setStreamedText(full.slice(0, i));
      }
    }, 16);
    return () => { if (streamIntervalRef.current) clearInterval(streamIntervalRef.current); };
  }, [relatorio, isLoading]);

  // Auto-scroll para o fundo durante o streaming
  useEffect(() => {
    if (mainRef.current && isStreaming) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [streamedText, isStreaming]);

  const handleGerarRelatorio = async () => {
    setIsLoading(true);
    setError(null);
    setRelatorio(null);

    try {
      const filtro: FiltroRelatorio = {
        setor: setor || undefined,
        regiao: regiao || undefined,
        ano: anosSelecionados.length > 0 ? anosSelecionados : undefined,
        tipo: tipo || undefined,
        ano_inicio: anoInicio || undefined,
        ano_fim: anoFim || undefined,
      };

      const resumo = await filtrarParaRelatorio(filtro);
      setResumoStats({ total: resumo.total_projetos, totalMilhoes: resumo.total_investimentos });

      if (resumo.total_projetos === 0) {
        setError('Nenhum projeto encontrado com os filtros selecionados. Tente ampliar o recorte.');
        setIsLoading(false);
        return;
      }

      const prompt = buildPrompt(filtro, resumo);

      const response = await generateWithFallback({ prompt, thinkingBudget: 0 });
      setRelatorio(response.text || 'Não foi possível gerar o relatório.');
    } catch (e: any) {
      setError('Nadia (servidores do Google Gemini) está enfrentando uma instabilidade/alta demanda momentânea. Por favor, aguarde alguns segundos e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectClass =
    'w-full bg-slate-800/60 border border-slate-600/60 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500 transition-colors appearance-none cursor-pointer';

  const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  const petState: PetState = (relatorio && !isLoading && !isStreaming) ? 'found' : 'analyzing';

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
        {/* Título da Página / Hero Section (Frontend Design Applied) */}
        <div className="flex-shrink-0 px-8 pt-10 pb-8 border-b border-slate-700/60 bg-gradient-to-b from-slate-900/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-rose-500/10 rounded-2xl ring-1 ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-rose-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl md:text-3xl font-black text-slate-50 tracking-tight">Explorar Dados</h1>
                <p className="text-sm font-medium text-slate-400">Relatórios analíticos do PIESP por filtro</p>
              </div>
            </div>
            <button
              onClick={onNavigateHome}
              className="px-5 py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 text-slate-300 hover:text-white text-sm font-bold transition-all shadow hover:shadow-lg"
            >
              ← Voltar ao Início
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-hidden flex flex-col lg:flex-row">
          {/* Painel de filtros */}
          <aside className="flex-shrink-0 lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-700/50 flex flex-col">
            {/* Área scrollável com os filtros */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 flex flex-col gap-5 custom-scrollbar">
              <div>
                <p className="text-xs text-slate-500 mb-4">
                  Selecione os filtros desejados e clique em <span className="text-rose-400 font-semibold">Gerar Relatório</span>.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Setor</label>
                    <div className="relative">
                      <select value={setor} onChange={e => setSetor(e.target.value)} className={selectClass}>
                        <option value="">{TODOS}</option>
                        {metadados.setores.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Região</label>
                    <div className="relative">
                      <select value={regiao} onChange={e => setRegiao(e.target.value)} className={selectClass}>
                        <option value="">{TODOS}</option>
                        {metadados.regioes.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                    </div>
                  </div>

                  <div className="relative" ref={dropdownRef}>
                    <label className={labelClass}>Anos de Anúncio</label>
                    <div
                      className={`${selectClass} flex items-center justify-between cursor-pointer`}
                      onClick={() => setAnoDropdownOpen(!anoDropdownOpen)}
                    >
                      <span className={anosSelecionados.length === 0 ? "text-slate-400" : "text-slate-200 truncate pr-4"}>
                        {anosSelecionados.length === 0 ? TODOS || 'Todos' : anosSelecionados.sort().join(', ')}
                      </span>
                      <span className="text-slate-400 text-xs">▾</span>
                    </div>

                    {anoDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="p-2 space-y-1">
                          {metadados.anos.map(a => {
                            const isSelected = anosSelecionados.includes(a);
                            return (
                              <div
                                key={a}
                                className="flex items-center space-x-3 px-2 py-2 hover:bg-slate-700 rounded cursor-pointer transition-colors"
                                onClick={() => {
                                  setAnosSelecionados(prev =>
                                    isSelected ? prev.filter(y => y !== a) : [...prev, a]
                                  );
                                }}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-500 bg-slate-900/50'}`}>
                                  {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className="text-sm font-medium text-slate-200">{a}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Período Início</label>
                      <div className="relative">
                        <select value={anoInicio} onChange={e => setAnoInicio(e.target.value)} className={selectClass}>
                          <option value="">{TODOS}</option>
                          {[...opcoesPeriodo].reverse().map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Período Fim</label>
                      <div className="relative">
                        <select value={anoFim} onChange={e => setAnoFim(e.target.value)} className={selectClass}>
                          <option value="">{TODOS}</option>
                          {[...opcoesPeriodo]
                            .reverse()
                            .filter(a => anoInicio ? Number(a) >= Number(anoInicio) : true)
                            .map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Tipo de Investimento</label>
                    <div className="relative">
                      <select value={tipo} onChange={e => setTipo(e.target.value)} className={selectClass}>
                        <option value="">{TODOS}</option>
                        {metadados.tipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview count */}
              <div className="bg-slate-800/40 rounded-lg px-4 py-3 border border-slate-700/50">
                <p className="text-xs text-slate-400">Projetos encontrados</p>
                <p className="text-2xl font-bold text-rose-400">{previewCount.toLocaleString('pt-BR')}</p>
              </div>

              <button
                onClick={handleGerarRelatorio}
                disabled={isLoading || previewCount === 0}
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {isLoading ? 'Gerando...' : 'Gerar Relatório'}
              </button>

              {/* Limpar filtros */}
              {(setor || regiao || anosSelecionados.length > 0 || tipo || anoInicio || anoFim) && (
                <button
                  onClick={() => { setSetor(''); setRegiao(''); setAnosSelecionados([]); setTipo(''); setAnoInicio(''); setAnoFim(''); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Pet — base da sidebar, some quando a consulta começa */}
            {!isLoading && !isStreaming && !relatorio && (
              <div className="flex-shrink-0 px-5 pb-4 pt-3 flex justify-start pointer-events-none select-none border-t border-slate-700/30" aria-hidden="true">
                <CapivaraPet state="idle" size={72} eyeAnim="capivara-eye-fields 11s ease-in-out 2s infinite" />
              </div>
            )}
          </aside>

          {/* Área do relatório */}
          <main ref={mainRef} className="flex-grow overflow-y-auto custom-scrollbar p-6">
            {!relatorio && !isLoading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <div>
                  <p className="text-slate-400 font-medium">Nenhum relatório gerado ainda</p>
                  <p className="text-slate-500 text-sm mt-1">Selecione os filtros ao lado e clique em Gerar Relatório</p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center gap-6">
                {/* Container: charts alinham ao topo do pet, sem espaço entre eles */}
                <div className="relative pointer-events-none select-none" style={{ width: 280, height: 180, overflow: 'visible' }} aria-hidden="true">

                  {/* Gráfico de barras — esquerda, rente ao pet */}
                  <div className="absolute" style={{ top: 8, left: 8, zIndex: 10, animation: 'pet-float-a 3.3s ease-in-out infinite', filter: 'drop-shadow(0 6px 18px rgba(59,130,246,0.55))' }}>
                    <div style={{ transform: 'perspective(300px) rotateX(8deg) rotateY(16deg)' }}>
                      <svg width="82" height="62" viewBox="0 0 82 62" style={{ display: 'block' }}>
                        <rect width="82" height="62" rx="8" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="1.5"/>
                        <line x1="8" y1="50" x2="76" y2="50" stroke="#1e293b" strokeWidth="0.8"/>
                        <line x1="8" y1="40" x2="76" y2="40" stroke="#1e293b" strokeWidth="0.8"/>
                        <line x1="8" y1="30" x2="76" y2="30" stroke="#1e293b" strokeWidth="0.8"/>
                        <rect x="10" y="40" width="11" height="14" fill="#3b82f6" rx="1.5"/>
                        <rect x="25" y="30" width="11" height="24" fill="#60a5fa" rx="1.5"/>
                        <rect x="40" y="20" width="11" height="34" fill="#2563eb" rx="1.5"/>
                        <rect x="55" y="34" width="11" height="20" fill="#1d4ed8" rx="1.5"/>
                        <rect x="66" y="44" width="10" height="10" fill="#93c5fd" rx="1.5"/>
                        <line x1="6" y1="55" x2="78" y2="55" stroke="#1e3a5f" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  </div>

                  {/* Tabela — direita, rente ao pet */}
                  <div className="absolute" style={{ top: 8, right: 8, zIndex: 10, animation: 'pet-float-b 2.9s ease-in-out 0.8s infinite', filter: 'drop-shadow(0 6px 18px rgba(244,63,94,0.4))' }}>
                    <div style={{ transform: 'perspective(300px) rotateX(8deg) rotateY(-16deg)' }}>
                      <svg width="82" height="62" viewBox="0 0 82 62" style={{ display: 'block' }}>
                        <rect width="82" height="62" rx="8" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="1.5"/>
                        <rect x="2"  y="2"  width="78" height="12" rx="3" fill="#1e3a5f"/>
                        <rect x="6"  y="4"  width="24" height="5"  rx="1" fill="#60a5fa" opacity="0.65"/>
                        <rect x="46" y="4"  width="16" height="5"  rx="1" fill="#60a5fa" opacity="0.65"/>
                        <rect x="2"  y="17" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="44" y="17" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="2"  y="27" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="44" y="27" width="22" height="7"  rx="1" fill="#f43f5e" opacity="0.5"/>
                        <rect x="2"  y="37" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="44" y="37" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="2"  y="47" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <rect x="44" y="47" width="36" height="7"  rx="1" fill="#1e293b"/>
                        <line x1="42" y1="2" x2="42" y2="60" stroke="#1e3a5f" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>

                  {/* Bloco de notas — centro, levemente acima dos outros dois */}
                  <div className="absolute" style={{ top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, animation: 'pet-float-c 4.1s ease-in-out 1.4s infinite', filter: 'drop-shadow(0 6px 18px rgba(148,163,184,0.35))' }}>
                    <svg width="68" height="58" viewBox="0 0 68 58" style={{ display: 'block' }}>
                      <rect width="68" height="58" rx="8" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="1.5"/>
                      {/* espiral de encadernação */}
                      <rect x="2" y="4"  width="8" height="50" rx="3" fill="#1a2744"/>
                      <circle cx="6" cy="12" r="2.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="1.2"/>
                      <circle cx="6" cy="24" r="2.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="1.2"/>
                      <circle cx="6" cy="36" r="2.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="1.2"/>
                      <circle cx="6" cy="48" r="2.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="1.2"/>
                      {/* linhas de texto */}
                      <rect x="16" y="10" width="46" height="4" rx="1.5" fill="#1e293b"/>
                      <rect x="16" y="19" width="38" height="4" rx="1.5" fill="#1e293b"/>
                      <rect x="16" y="28" width="46" height="4" rx="1.5" fill="#f43f5e" fillOpacity="0.45"/>
                      <rect x="16" y="37" width="30" height="4" rx="1.5" fill="#1e293b"/>
                      <rect x="16" y="46" width="42" height="4" rx="1.5" fill="#1e293b"/>
                    </svg>
                  </div>

                  {/* Pet — base, charts ficam rentes ao topo da cabeça */}
                  <div className="absolute bottom-0 left-1/2" style={{ transform: 'translateX(-50%)', zIndex: 1 }}>
                    <CapivaraPet state="found" size={110} />
                  </div>
                </div>

                <p className="text-slate-400 animate-pulse text-sm tracking-wide">Preparando os dados...</p>
              </div>
            )}

            {error && (
              <div className="bg-rose-900/20 border border-rose-700/50 rounded-lg p-4 text-rose-300 text-sm">
                {error}
              </div>
            )}

            {relatorio && !isLoading && (
              <div className="max-w-3xl mx-auto space-y-4">
                {resumoStats && (
                  <div className="flex gap-4 mb-6 flex-wrap">
                    <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                      <p className="text-xs text-slate-400">Projetos analisados</p>
                      <p className="text-xl font-bold text-white">{resumoStats.total?.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                      <p className="text-xs text-slate-400">Valor total</p>
                      <p className="text-xl font-bold text-rose-400">
                        R$ {((resumoStats.totalMilhoes ?? 0) / 1000).toFixed(1).replace('.', ',')} bi
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 items-start">
                  {/* Texto do relatório */}
                  <div className="flex-1 min-w-0 bg-slate-800/30 rounded-xl border border-slate-700/40 p-6 text-slate-200">
                    <MarkdownRenderer content={isStreaming ? streamedText : relatorio} />
                    {isStreaming && (
                      <span className="inline-block w-1.5 h-[1.1em] bg-rose-400/70 animate-pulse ml-0.5 align-middle rounded-sm" />
                    )}
                  </div>

                  {/* Pet direita — único bloco; gráficos fazem fade-out suave ao terminar */}
                  <div
                    className="flex-shrink-0 pointer-events-none select-none"
                    style={{
                      position: 'sticky',
                      bottom: '1rem',
                      alignSelf: 'flex-end',
                    }}
                    aria-hidden="true"
                  >
                    {/* gráficos acima do pet — fade-out escalonado */}
                    {chartsShowing && (
                      <div style={{
                        opacity: chartsOpacity,
                        transition: 'opacity 0.8s ease-out',
                        position: 'relative', width: 110, height: 44, overflow: 'visible',
                      }}>
                        <div className="absolute" style={{ top: 0, left: 0, animation: 'pet-float-a 3.3s ease-in-out infinite', filter: 'drop-shadow(0 4px 12px rgba(59,130,246,0.55))' }}>
                          <svg width="48" height="36" viewBox="0 0 48 36" style={{ display: 'block' }}>
                            <rect width="48" height="36" rx="5" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="1.2"/>
                            <rect x="5"  y="22" width="7" height="10" fill="#3b82f6" rx="1"/>
                            <rect x="15" y="16" width="7" height="16" fill="#60a5fa" rx="1"/>
                            <rect x="25" y="10" width="7" height="22" fill="#2563eb" rx="1"/>
                            <rect x="35" y="20" width="7" height="12" fill="#93c5fd" rx="1"/>
                            <line x1="3" y1="33" x2="45" y2="33" stroke="#1e3a5f" strokeWidth="1"/>
                          </svg>
                        </div>
                        <div className="absolute" style={{ top: 0, right: 0, animation: 'pet-float-b 2.9s ease-in-out 0.8s infinite', filter: 'drop-shadow(0 4px 12px rgba(244,63,94,0.4))' }}>
                          <svg width="48" height="36" viewBox="0 0 48 36" style={{ display: 'block' }}>
                            <rect width="48" height="36" rx="5" fill="#0d1b2a" stroke="#1e3a5f" strokeWidth="1.2"/>
                            <rect x="2" y="2" width="6" height="32" rx="2" fill="#1a2744"/>
                            <circle cx="5" cy="9"  r="1.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="0.8"/>
                            <circle cx="5" cy="18" r="1.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="0.8"/>
                            <circle cx="5" cy="27" r="1.8" fill="#0d1b2a" stroke="#3b82f6" strokeWidth="0.8"/>
                            <rect x="11" y="8"  width="33" height="3" rx="1" fill="#1e293b"/>
                            <rect x="11" y="15" width="25" height="3" rx="1" fill="#1e293b"/>
                            <rect x="11" y="22" width="33" height="3" rx="1" fill="#f43f5e" fillOpacity="0.4"/>
                            <rect x="11" y="29" width="20" height="3" rx="1" fill="#1e293b"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {/* pet — state e acessórios escalonados */}
                    <CapivaraPet
                      state={petPostStream ? 'idle' : 'typing'}
                      size={80}
                      withGlasses={glassesActive}
                      eyeAnim={glassesActive ? 'capivara-eye-proud 5.8s ease-in-out 0.6s infinite' : undefined}
                    />
                  </div>
                </div>

                {!isStreaming && glassesActive && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    Relatório gerado pela Nadia com base nos dados do PIESP. Valide informações críticas na fonte oficial.
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

    </>
  );
};

export default ExplorarDadosView;
