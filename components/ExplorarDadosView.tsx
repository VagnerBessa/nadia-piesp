import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import { getMetadados, filtrarParaRelatorio, FiltroRelatorio, ResumoRelatorio } from '../services/piespDataService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatHeaderSphere } from './ChatHeaderSphere';
import { SmallNadiaSphere } from './SmallNadiaSphere';

interface ExplorarDadosViewProps {
  onNavigateHome: () => void;
}

const TODOS = '';

function buildPrompt(filtros: FiltroRelatorio, resumo: ResumoRelatorio): string {
  const filtroDesc = [
    filtros.setor ? `Setor: ${filtros.setor}` : null,
    filtros.regiao ? `Região: ${filtros.regiao}` : null,
    filtros.ano ? `Ano: ${filtros.ano}` : null,
    filtros.tipo ? `Tipo de investimento: ${filtros.tipo}` : null,
  ].filter(Boolean).join(' | ') || 'Sem filtros específicos (base completa)';

  const totalBi = (resumo.totalMilhoes / 1000).toFixed(1).replace('.', ',');

  const projetosTexto = resumo.projetos.slice(0, 15).map((p, i) =>
    `${i + 1}. ${p.empresa} — ${p.municipio} (${p.regiao}), ${p.ano}, Setor: ${p.setor}, Tipo: ${p.tipo || 'N/I'}, Valor: R$ ${p.valor_milhoes_reais} mi — "${p.descricao}"`
  ).join('\n');

  const porSetorTexto = resumo.porSetor.map(s =>
    `- ${s.nome}: R$ ${s.valor} mi em ${s.count} projeto(s)`
  ).join('\n');

  const porMunicipioTexto = resumo.porMunicipio.map(m =>
    `- ${m.nome}: R$ ${m.valor} mi em ${m.count} projeto(s)`
  ).join('\n');

  const porRegiaoTexto = resumo.porRegiao.map(r =>
    `- ${r.nome}: R$ ${r.valor} mi em ${r.count} projeto(s)`
  ).join('\n');

  const porAnoTexto = resumo.porAno.map(a =>
    `- ${a.nome}: R$ ${a.valor} mi em ${a.count} projeto(s)`
  ).join('\n');

  return `Você é a Nadia, analista de investimentos da Fundação Seade especializada no PIESP (Pesquisa de Investimentos no Estado de São Paulo).

O usuário solicitou um relatório analítico com o seguinte recorte:
**${filtroDesc}**

DADOS FILTRADOS DO PIESP:
- Total de projetos encontrados: ${resumo.total}
- Valor total: R$ ${resumo.totalMilhoes} milhões (R$ ${totalBi} bilhões)

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
- \`line\`: Para mostrar "Evolução no Tempo" (anual).
- \`bar\`: Para comparar valores absolutos (Cidades, Regiões, Principais Setores).
- \`pie\`: Para exibir divisões/share.

Por favor, inclua pelo menos 2 a 3 gráficos de frentes *diferentes* (ex: 1 de evolução cronológica, 1 top ranking de cidades e 1 de distribuição de tipos/setores) distribuídos logicamente entre as seções. Insira gráficos apenas com os dados brutos numéricos listados nesta prompt.`;
}

const ExplorarDadosView: React.FC<ExplorarDadosViewProps> = ({ onNavigateHome }) => {
  const metadados = useMemo(() => getMetadados(), []);

  const [setor, setSetor] = useState('');
  const [regiao, setRegiao] = useState('');
  const [ano, setAno] = useState('');
  const [tipo, setTipo] = useState('');

  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumoStats, setResumoStats] = useState<{ total: number; totalMilhoes: number } | null>(null);

  // Preview count as filters change
  const previewCount = useMemo(() => {
    const filtro: FiltroRelatorio = {
      setor: setor || undefined,
      regiao: regiao || undefined,
      ano: ano || undefined,
      tipo: tipo || undefined,
    };
    // Quick count without full aggregation
    const r = filtrarParaRelatorio(filtro);
    return r.total;
  }, [setor, regiao, ano, tipo]);

  const handleGerarRelatorio = async () => {
    setIsLoading(true);
    setError(null);
    setRelatorio(null);

    try {
      const filtro: FiltroRelatorio = {
        setor: setor || undefined,
        regiao: regiao || undefined,
        ano: ano || undefined,
        tipo: tipo || undefined,
      };

      const resumo = filtrarParaRelatorio(filtro);
      setResumoStats({ total: resumo.total, totalMilhoes: resumo.totalMilhoes });

      if (resumo.total === 0) {
        setError('Nenhum projeto encontrado com os filtros selecionados. Tente ampliar o recorte.');
        setIsLoading(false);
        return;
      }

      const prompt = buildPrompt(filtro, resumo);

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });

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
          <aside className="flex-shrink-0 lg:w-72 p-5 border-b lg:border-b-0 lg:border-r border-slate-700/50 flex flex-col gap-5">
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

                <div>
                  <label className={labelClass}>Ano</label>
                  <div className="relative">
                    <select value={ano} onChange={e => setAno(e.target.value)} className={selectClass}>
                      <option value="">{TODOS}</option>
                      {metadados.anos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
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
            {(setor || regiao || ano || tipo) && (
              <button
                onClick={() => { setSetor(''); setRegiao(''); setAno(''); setTipo(''); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
              >
                Limpar filtros
              </button>
            )}
          </aside>

          {/* Área do relatório */}
          <main className="flex-grow overflow-y-auto custom-scrollbar p-6">
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
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <SmallNadiaSphere />
                <p className="text-slate-400 animate-pulse text-sm">A Nadia está analisando os dados...</p>
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
                      <p className="text-xl font-bold text-white">{resumoStats.total.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg px-4 py-3 border border-slate-700/50">
                      <p className="text-xs text-slate-400">Valor total</p>
                      <p className="text-xl font-bold text-rose-400">
                        R$ {(resumoStats.totalMilhoes / 1000).toFixed(1).replace('.', ',')} bi
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-6 text-slate-200">
                  <MarkdownRenderer content={relatorio} />
                </div>
                <p className="text-xs text-slate-500 text-center pt-2">
                  Relatório gerado pela Nadia com base nos dados do PIESP. Valide informações críticas na fonte oficial.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default ExplorarDadosView;
