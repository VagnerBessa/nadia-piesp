
import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../utils/prompts';
import { GEMINI_API_KEY } from '../config';
import { consultarEmpreendedorismoData, consultarAnunciosSemValor } from '../services/empreendedorismoDataService';
import { getRedeEmpresa, getRedeRegiao, getRedeQuery } from '../services/empreendedorismoGraphService';
import { buildSystemInstructionWithSkill, buildSystemInstructionWithSkillByName, detectSkill } from '../services/skillDetector';
import { callOpenRouter } from '../services/openrouterService';
import { OPENROUTER_API_KEY } from '../config';

export interface Source {
  uri: string;
  title: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
}

// Tipo local para o histórico compatível com a API
interface HistoryItem {
  role: 'user' | 'model';
  parts: any[];
}

export type ResponseMode = 'fast' | 'complete';

const initialMessage: Message = {
    role: 'model',
    text: 'Olá! Sou a Nadia, assistente de IA da Fundação Seade. Posso analisar dados do Painel de Empreendedorismo do Estado de São Paulo, ajudando a explorar informações sobre abertura, fechamento e crescimento de empresas em diversos setores. O que gostaria de saber?'
};

// A descrição da região agora é estática porque os metadados são carregados de forma assíncrona.
const regiaoDesc = 'A região administrativa do Estado de SP, ex: "Região Metropolitana de São Paulo" ou "Campinas". Usar quando o usuário perguntar por região, não por município específico.';

const empreendedorismoTools = [{ functionDeclarations: [
  {
    name: "listar_datasets",
    description: "Lista todos os conjuntos de dados (datasets) disponíveis da Fundação SEADE.\n\n    A Fundação SEADE (Sistema Estadual de Análise de Dados) é o órgão de\n    estatísticas do Estado de São Paulo.\n\n    Use esta ferramenta para descobrir quais datasets existem, seus slugs\n    e seus metadados descritivos (título, descrição, tema, fonte, período, cobertura territorial), caso o usuário pergunte sobre assuntos além de empresas e negócios.\n\n    Retorna: slug, título, descrição, tema, fonte, período de referência, periodicidade,\n    cobertura territorial, total de linhas e data de atualização.",
    parameters: { type: Type.OBJECT, properties: { "busca": { type: Type.STRING, description: "Busca textual pelo nome, título ou tema do dataset." }, "tema": { type: Type.STRING, description: "Filtra por tema (ex: 'Economia', 'Saúde', 'Educação', 'Demografia')." }, "limite": { type: Type.NUMBER, description: "Máximo de resultados (padrão: 50)" }, }, required: [] }
  },
  {
    name: "consultar_dicionario",
    description: "Retorna o dicionário de dados completo de um dataset da Fundação SEADE.\n    \n    O dicionário contém a definição de TODAS as colunas do dataset, incluindo:\n    - Nome da coluna (nome_limpo para queries)\n    - Tipo de dado (texto, numérico, etc.)\n    - Descrição detalhada do que a coluna representa\n    - Fonte\n    - Notas\n    \n    IMPORTANTE: Sempre consulte o dicionário ANTES de buscar ou agregar dados,\n    para entender o significado exato de cada coluna e formular queries corretas.",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "ID ou slug do dataset. Obtido via listar_datasets (campo id_dataset)." }, }, required: ["dataset_id"] }
  },
  {
    name: "buscar_dados",
    description: "Busca e filtra dados em um dataset específico da Fundação SEADE.\n\n    Permite filtrar por qualquer coluna usando operadores:\n    - \"=\" (igual), \"!=\" (diferente)\n    - \">\" , \">=\" , \"<\" , \"<=\" (comparação numérica)\n    - \"LIKE\" (contém texto, use % como curinga)\n    - \"IN\" (lista de valores)\n    - \"BETWEEN\" (intervalo numérico ou de datas)\n\n    DICA: Consulte o dicionário primeiro para saber os nomes exatos das colunas.\n    Nomes de municípios estão geralmente em MAIÚSCULAS (ex: \"SANTOS\", \"SÃO PAULO\").\n    Anos são geralmente inteiros (ex: 2022, não \"2022\").\n\n    Retorna as linhas do dataset que atendem aos filtros, com paginação.\n    Máximo de 10.000 linhas por página. Paginação disponível via parâmetros 'limite' e 'pagina'.\n    A resposta inclui 'total_disponivel' (total de linhas que satisfazem os filtros) e\n    'truncado: true' quando há mais linhas além das retornadas.",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "ID ou slug do dataset" }, "filtros": { type: Type.ARRAY, description: "Lista de filtros a aplicar", items: { type: Type.OBJECT, properties: { "coluna": { type: Type.STRING, description: "Nome da coluna" }, "operador": { type: Type.STRING, enum: ["=","!=",">",">=","<","<=","LIKE","IN","BETWEEN"] }, "valor": { type: Type.OBJECT, description: "Valor para comparação. String, número ou array (para IN/BETWEEN)" }, }, required: ["coluna","operador","valor"] } }, "colunas": { type: Type.ARRAY, description: "Colunas a retornar. Se vazio, retorna todas.", items: { type: Type.STRING } }, "ordenar_por": { type: Type.STRING, description: "Coluna para ordenação" }, "ordem": { type: Type.STRING, enum: ["ASC","DESC"] }, "limite": { type: Type.NUMBER, description: "Máx linhas por página (até 10000)" }, "pagina": { type: Type.NUMBER }, }, required: ["dataset_id"] }
  },
  {
    name: "agregar_dados",
    description: "Realiza agregações estatísticas sobre um dataset da Fundação SEADE.\n\n    Funções disponíveis:\n    - SOMA: soma dos valores\n    - MEDIA: média aritmética\n    - CONTAGEM: contagem de registros não-nulos (IMPORTANTE: NUNCA use '*' como nome de coluna. Para contar o total de linhas, use o nome de uma coluna real do dataset, como 'CNPJ' ou 'id').\n    - MINIMO / MAXIMO: extremos\n    - MEDIANA: percentil 50\n    - DESVIO_PADRAO: desvio padrão amostral\n    - VARIANCIA: variância amostral\n    - PERCENTIL: percentil customizado (exige campo 'percentil_p' entre 0 e 1)\n    - CONTAGEM_DISTINTA: COUNT(DISTINCT col)\n\n    Paginação: use 'limite' (até 10.000 grupos) e 'pagina' para navegar conjuntos grandes.\n    Filtro pós-agregação: use 'tendo' (HAVING) para filtrar grupos pelo valor agregado.\n    Resposta inclui 'total_grupos' e 'truncado: true' quando há mais grupos além dos retornados.\n\n    Exemplo: \"qual o PIB total por município da RMSP em 2022?\"\n    - dataset_id: \"pib-municipios\", agrupar_por: [\"municipio\"]\n    - agregacoes: [{ coluna: \"pib\", funcao: \"SOMA\" }]\n    - filtros: [{ coluna: \"ano\", operador: \"=\", valor: 2022 }, { coluna: \"regiao\", operador: \"=\", valor: \"RMSP\" }]",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING }, "agrupar_por": { type: Type.ARRAY, description: "Colunas para agrupamento (GROUP BY)", items: { type: Type.STRING } }, "agregacoes": { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { "coluna": { type: Type.STRING }, "funcao": { type: Type.STRING, enum: ["SOMA","MEDIA","CONTAGEM","MINIMO","MAXIMO","MEDIANA","DESVIO_PADRAO","VARIANCIA","PERCENTIL","CONTAGEM_DISTINTA"] }, "alias": { type: Type.STRING, description: "Nome do resultado (opcional)" }, "percentil_p": { type: Type.NUMBER, description: "Para PERCENTIL: valor entre 0 e 1 (ex: 0.9 para P90)" }, }, required: ["coluna","funcao"] } }, "filtros": { type: Type.ARRAY, description: "Filtros aplicados antes da agregação (WHERE)", items: { type: Type.OBJECT, properties: { "coluna": { type: Type.STRING, description: "Nome da coluna" }, "operador": { type: Type.STRING, enum: ["=","!=",">",">=","<","<=","LIKE","IN","BETWEEN"] }, "valor": { type: Type.OBJECT, description: "Valor para comparação. String, número ou array (para IN/BETWEEN)" }, }, required: ["coluna","operador","valor"] } }, "tendo": { type: Type.ARRAY, description: "Filtros pós-agregação (HAVING). Use o alias da agregação como coluna.", items: { type: Type.OBJECT, properties: { "coluna": { type: Type.STRING, description: "Alias da agregação ou coluna agrupada" }, "operador": { type: Type.STRING, enum: ["=","!=",">",">=","<","<="] }, "valor": { type: Type.NUMBER }, }, required: ["coluna","operador","valor"] } }, "ordenar_por": { type: Type.STRING }, "ordem": { type: Type.STRING, enum: ["ASC","DESC"] }, "limite": { type: Type.NUMBER, description: "Máx grupos por página (até 10000)" }, "pagina": { type: Type.NUMBER }, }, required: ["dataset_id","agregacoes"] }
  },
  {
    name: "baixar_csv",
    description: "Retorna o conteúdo original do dataset ou instrução de obtenção rápida.\n    \n    Devido a limitações de tamanho em transações para IA, se um dataset tiver \n    mais de milhares de linhas, apenas uma amostra será retornada junto com detalhes \n    de onde baixar a versão em bulk. Para buscas precisas, você DEVE utilizar o buscar_dados.",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "ID ou slug do dataset" }, "limite": { type: Type.NUMBER }, }, required: ["dataset_id"] }
  },
  {
    name: "comparar_dados",
    description: "Compara dados entre períodos, regiões ou categorias de um dataset SEADE.\n\n    Tipos de comparação:\n    - TEMPORAL: compara o mesmo indicador em períodos diferentes\n      Ex: \"Compare a população de SP entre 2010 e 2020\"\n    - REGIONAL: compara o mesmo indicador entre regiões\n      Ex: \"Compare o PIB de Santos, Guarujá e São Vicente em 2022\"\n    - CATEGORICA: compara valores agrupados por uma dimensão\n      Ex: \"Compare natalidade por faixa etária da mãe\"\n\n    Retorna dados com paginação. Resposta inclui 'total_disponivel' e 'truncado: true'\n    quando há mais grupos além dos retornados.",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING }, "tipo": { type: Type.STRING, enum: ["TEMPORAL","REGIONAL","CATEGORICA"] }, "coluna_valor": { type: Type.STRING, description: "Coluna numérica a comparar" }, "coluna_comparacao": { type: Type.STRING, description: "Coluna de agrupamento (ano, municipio, etc.)" }, "valores_comparar": { type: Type.ARRAY, description: "Valores a comparar (sempre como strings — DuckDB faz cast). Ex: [\"2010\", \"2020\"] ou [\"SANTOS\", \"GUARUJÁ\"]", items: { type: Type.STRING } }, "filtros": { type: Type.ARRAY, description: "Filtros adicionais (mesmo formato de buscar_dados)", items: { type: Type.OBJECT, properties: { "coluna": { type: Type.STRING, description: "Nome da coluna" }, "operador": { type: Type.STRING, enum: ["=","!=",">",">=","<","<=","LIKE","IN","BETWEEN"] }, "valor": { type: Type.OBJECT, description: "Valor para comparação. String, número ou array (para IN/BETWEEN)" }, }, required: ["coluna","operador","valor"] } }, "funcao_agregacao": { type: Type.STRING, enum: ["SOMA","MEDIA","CONTAGEM"] }, "limite": { type: Type.NUMBER, description: "Máx grupos por página (até 10000)" }, "pagina": { type: Type.NUMBER }, }, required: ["dataset_id","tipo","coluna_valor","coluna_comparacao","valores_comparar"] }
  },
  {
    name: "descrever_dataset",
    description: "Retorna características estruturais de um dataset (total de linhas, tipos, estatísticas).\n    Útil para entender a dimensão e a qualidade dos dados antes de fazer agregações pesadas.\n\n    Sem 'coluna': usa SUMMARIZE do DuckDB com amostragem (200k linhas) para retornar para TODAS as colunas:\n      min, max, média, desvio padrão, quartis (q25/q50/q75), contagem e % de nulos.\n\n    Com 'coluna': análise específica com MIN, MAX, COUNT DISTINCT e Top-10 valores mais frequentes\n      (usando amostra configurável via 'sample_size').",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "ID ou slug do dataset" }, "coluna": { type: Type.STRING, description: "Opcional: Coluna específica para análise aprofundada (Top-N, Min, Max)" }, "sample_size": { type: Type.NUMBER, description: "Tamanho da amostra para estatísticas (default 200k)" }, }, required: ["dataset_id"] }
  },
  {
    name: "amostra_dataset",
    description: "Retorna uma amostra aleatória de linhas de um dataset.\n    Útil para entender o formato, conteúdo e exemplos de dados reais presentes, com baixíssimo custo\n    computacional, pois extrai aleatoriamente sem necessidade de ler todo o arquivo (USING SAMPLE).",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "ID ou slug do dataset" }, "colunas": { type: Type.ARRAY, description: "Colunas a retornar. Se vazio, retorna todas.", items: { type: Type.STRING } }, "tamanho_amostra": { type: Type.NUMBER, description: "Quantidade de linhas na amostra (default 100, max 1000)" }, }, required: ["dataset_id"] }
  },
  {
    name: "executar_sql",
    description: "Executa uma consulta SQL customizada (APENAS SELECT) em um ou mais datasets.\n    Ferramenta avançada para subqueries, window functions e JOINs entre datasets.\n\n    Modo simples (um dataset):\n      - Passe 'dataset_id' e use FROM dataset na query.\n      - Ex: SELECT * FROM dataset WHERE ano = 2022 LIMIT 100\n\n    Modo multi-dataset (JOIN entre datasets):\n      - Passe 'datasets': [{\"alias\":\"pib\",\"dataset_id\":\"pib-municipios\"},{\"alias\":\"pop\",\"dataset_id\":\"populacao\"}]\n      - Use os aliases como nomes de tabela na query.\n      - Ex: SELECT p.municipio, p.pib, q.populacao FROM pib p JOIN pop q ON p.cod = q.cod\n\n    Regras:\n    1. Aspas duplas para colunas, aspas simples para valores literais.\n    2. Somente SELECT (sandbox). Outros comandos retornarão erro.\n    3. Limite embutido: 10.000 linhas.\n    4. Todos os datasets em 'datasets' devem estar no escopo do domínio.",
    parameters: { type: Type.OBJECT, properties: { "dataset_id": { type: Type.STRING, description: "Dataset principal (modo simples). Use FROM dataset na query." }, "datasets": { type: Type.ARRAY, description: "Múltiplos datasets (modo multi). Cada entrada vira um CTE/alias.", items: { type: Type.OBJECT, properties: { "alias": { type: Type.STRING, description: "Nome que a query usará como tabela (ex: 'pib')" }, "dataset_id": { type: Type.STRING, description: "Slug do dataset" }, }, required: ["alias","dataset_id"] } }, "query": { type: Type.STRING, description: "Query SQL SELECT. Use FROM dataset (simples) ou FROM alias (multi)." }, }, required: ["query"] }
  },
  {
    name: "buscar_coluna",
    description: "Busca colunas em todos os datasets usando linguagem natural e similaridade semântica (embeddings VSS).\n    Útil quando você não sabe o nome exato de uma coluna mas sabe o que ela representa.\n\n    Exemplos:\n    - \"rendimento mensal\" → encontra colunas como 'renda_media', 'salario_mensal'\n    - \"código do município\" → encontra 'cod_municipio', 'id_mun', 'codigo_ibge'\n    - \"taxa de mortalidade infantil\" → encontra a coluna certa no dataset de saúde\n\n    Retorna as colunas mais similares com score de similaridade (0–1) e o dataset ao qual pertencem.\n    Filtrado automaticamente pelos datasets permitidos do domínio.",
    parameters: { type: Type.OBJECT, properties: { "query": { type: Type.STRING, description: "Texto livre descrevendo a informação que você procura" }, "dataset_id": { type: Type.STRING, description: "Opcional: limita a busca a um dataset específico" }, "limite": { type: Type.NUMBER, description: "Máx de colunas a retornar (até 20)" }, }, required: ["query"] }
  },
] }];

// Ferramentas de pesquisa: Google Search para contexto externo
// (não pode ser combinado com functionDeclarations na mesma chamada)
const searchTools = [
  { googleSearch: {} }
];

import { callMcpTool } from '../services/mcpService';

// Executa a ferramenta localmente via servidor MCP e retorna o resultado
async function executarFerramenta(nome: string, args: any): Promise<any> {
  const isEmpreendedorismoTool = empreendedorismoTools[0].functionDeclarations.some(t => t.name === nome);
  if (isEmpreendedorismoTool) {
    return await callMcpTool(nome, args);
  }
  return { error: 'Ferramenta não reconhecida' };
}

// Rótulos legíveis para as skills — usados no prompt de crítica
const SKILL_LABELS: Record<string, string> = {
  comercio_exterior:        'Comércio Exterior e Exportações',
  emprego_empregabilidade:  'Emprego e Empregabilidade',
  qualificacao_profissional:'Qualificação Profissional',
  logistica_infraestrutura: 'Logística e Infraestrutura',
  inovacao_tecnologia:      'Inovação e Tecnologia',
  desenvolvimento_regional: 'Desenvolvimento Regional',
  cadeias_produtivas:       'Cadeias Produtivas',
  transicao_energetica:     'Transição Energética e Sustentabilidade',
};

const CRITIQUE_SYSTEM_INSTRUCTION = `Você é um editor sênior de análises econômicas da Fundação Seade. Recebeu uma pergunta, a lente analítica ativa e uma resposta candidata. Sua tarefa: aplicar 5 testes de qualidade analítica e corrigir a resposta se necessário.

Regras: não invente dados, não altere valores ou nomes de empresas, preserve o nível de detalhe e o estilo de escrita. Retorne APENAS o texto da resposta — corrigido ou aprovado como está. Sem introduções nem comentários sobre o processo.`;

async function critiqueCandidateResponse(
  ai: GoogleGenAI,
  originalQuestion: string,
  candidateResponse: string,
  skillName: string
): Promise<string | null> {
  const skillLabel = SKILL_LABELS[skillName] ?? skillName;

  const prompt = `PERGUNTA: ${originalQuestion}

LENTE ANALÍTICA ATIVA: ${skillLabel}

RESPOSTA CANDIDATA:
${candidateResponse}

---

TESTE 1 — OMISSÃO POR RESSALVA (CRÍTICO — tolerância zero)
Localize CADA investimento na resposta. Para cada um, verifique se aparece junto com qualquer uma destas expressões (ou equivalentes):
• "sem impacto direto", "não diretamente ligado", "não contribui diretamente"
• "embora seja predominantemente doméstico", "voltado ao mercado interno", "foco no mercado doméstico"
• "sem vínculo com exportação", "impacto indireto", "pode ter impactos indiretos"
• "primariamente para atender a demanda doméstica"
• "pode haver um potencial exportador, mas é preciso analisar"
• "dependendo do tipo específico", "para determinar sua competitividade"
• qualquer formulação que admite que o investimento NÃO passa no filtro da lente ativa
AÇÃO OBRIGATÓRIA: Remova COMPLETAMENTE esses investimentos e todos os parágrafos que os mencionam. Não os referencie nem com ressalva. Se remover um investimento criar uma frase solta, remova a frase também.

TESTE 2 — CLUSTER DOMINANTE E ERROS FACTUAIS
Verifique com seu conhecimento de treinamento:

a) O cluster exportador dominante da região está identificado na análise (não em nota de rodapé — no corpo principal)?
• RA Franca → calçados de couro bovino são a identidade exportadora histórica da região (maior polo de footwear do Brasil); se presente nos dados, deve abrir ou dominar a análise
• RA São José dos Campos → aeroespacial (Embraer, Tier 1)
• RA Ribeirão Preto, RA Araçatuba, RA Bauru → sucroenergético
• RA Campinas → petroquímica, TI
• RMSP/ABC → automotivo
Se o cluster está ausente ou relegado ao final como nota: AÇÃO: reescreva para colocá-lo na abertura ou no corpo principal.

b) A análise comete o erro de tratar CBAM como risco para etanol de segunda geração (E2G)?
• CBAM é RISCO para etanol E1G (convencional, alta intensidade de carbono)
• CBAM é VANTAGEM COMPETITIVA para etanol E2G (celulósico, 70-90% menos carbono que gasolina)
Se a análise diz "monitorar o CBAM" ou "impacto do CBAM" para um investimento E2G: AÇÃO: corrija para explicar que E2G tem vantagem competitiva frente ao CBAM.

TESTE 3 — ESTRUTURA DE LISTA: REESCRITA OBRIGATÓRIA
Faça este diagnóstico: conte quantos parágrafos começam com o nome de uma empresa ou de um setor/categoria.
Se 3 ou mais parágrafos começam com nome de empresa/setor → a resposta FALHOU neste teste.
AÇÃO OBRIGATÓRIA quando falhar: NÃO faça edições incrementais. DESCARTE a estrutura atual e REESCREVA a análise completa seguindo este esquema:
  Parágrafo 1 — Padrão dominante: "O conjunto de investimentos de [região] revela [padrão não-óbvio]..."
  Parágrafo 2 — Hipótese e evidência: use empresas específicas como PROVA do argumento, não como assunto
  Parágrafo 3 — Tensão ou contradição (se houver)
  Parágrafo 4 — Insight conclusivo específico (não genérico)
Comprimento: 3 a 5 parágrafos. Sem subtítulos em negrito separando empresas.

TESTE 4 — CONCLUSÃO GENÉRICA
A conclusão usa: "desenvolvimento contínuo", "tem potencial", "é dinâmica", "perspectivas positivas", "crescimento expressivo", "foco produtivo com forte inserção"?
AÇÃO: Substitua por insight específico desta região e desta lente.

TESTE 5 — CONTAMINAÇÃO DE LENTE
Há análises de lentes diferentes da ativa ("${skillLabel}")? Ex: parágrafos sobre emprego, inovação tecnológica, desenvolvimento regional sem vínculo com exportação ou comércio externo?
AÇÃO: Remova completamente.

---
Se PASSOU em todos os 5 testes: retorne o texto EXATAMENTE como está.
Se FALHOU em qualquer teste: retorne a versão corrigida.
Retorne APENAS o texto da resposta. Nenhum comentário sobre o processo.`;

  try {
    const result = await (ai.models as any).generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: CRITIQUE_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const refined = (result.text as string | undefined)?.trim();
    if (!refined || refined.length < 50) return null;
    return refined;
  } catch (e) {
    console.warn('⚠️ [Critique] Falhou silenciosamente:', e);
    return null;
  }
}

interface UseChatOptions {
  selectedSkillName?: string | null;
}

// Extrai o código de erro ou status da exceção do Gemini
function getGeminiError(e: any) {
  const status = e?.status ?? e?.statusCode ?? e?.code ?? 0;
  const msg = (e?.message || JSON.stringify(e) || '').toLowerCase();
  
  const is503 = status === 503 || msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('fetch failed') || msg.includes('incomplete json') || msg.includes('load failed');
  const is429 = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
  const is500 = status === 500 || msg.includes('500') || msg.includes('internal');
  
  return { status, msg, is503, is429, is500 };
}

// Retry com backoff para erros temporários — tenta até maxRetries vezes com pausa crescente
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 2000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const { is503, is429, is500 } = getGeminiError(e);
      const isRetryable = is503 || is429 || is500;
      
      if (!isRetryable || attempt === maxRetries) throw e;
      
      const delay = baseDelayMs * (attempt + 1); // 2s, 4s
      console.warn(`⏳ Gemini Error — tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}

export const useChat = ({ selectedSkillName }: UseChatOptions = {}) => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingComplete, setStreamingComplete] = useState(false);
  
  const historyRef = useRef<HistoryItem[]>([
    { role: 'model', parts: [{ text: initialMessage.text }] }
  ]);

  const sendMessage = async (text: string, mode: ResponseMode = 'complete') => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setStreamingText(null);
    setStreamingComplete(false);

    // Atualização otimista da UI com a mensagem do usuário
    const userMessage: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMessage]);

    // Variáveis declaradas fora do try para serem acessíveis no catch (fallback OpenRouter)
    let currentContents: HistoryItem[] = [
      ...historyRef.current,
      { role: 'user', parts: [{ text: text }] }
    ];

    const systemInstructionWithSkill = selectedSkillName
      ? buildSystemInstructionWithSkillByName(SYSTEM_INSTRUCTION, selectedSkillName)
      : buildSystemInstructionWithSkill(SYSTEM_INSTRUCTION, text);

    const detectedSkill = selectedSkillName ? null : detectSkill(text);
    const usarPesquisa = detectedSkill?.name === 'inteligencia_empresarial';
    const ferramentasAtivas = usarPesquisa ? searchTools : empreendedorismoTools;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Configuração do modelo
      const modelName = 'gemini-2.5-flash';

      // Configuração de Thinking (Pensamento)
      const thinkingConfig = mode === 'complete'
        ? { thinkingConfig: { thinkingBudget: 512 } }   // reduzido de 2048 → 512 para evitar erros 429/503
        : { thinkingConfig: { thinkingBudget: 0 } };

      // Log de confirmação: mostra qual skill está ativa e o tamanho do system instruction
      if (selectedSkillName) {
        console.log(`🎯 [Agente manual] Skill "${selectedSkillName}" injetada. System instruction: ${systemInstructionWithSkill.length} chars.`);
      } else {
        const autoSkill = detectSkill(text);
        if (autoSkill) {
          console.log(`🎯 [Agente auto] Skill "${autoSkill.label}" detectada por keywords. System instruction: ${systemInstructionWithSkill.length} chars.`);
        } else {
          console.log(`ℹ️ [Sem agente] Nenhuma skill ativa. System instruction: ${systemInstructionWithSkill.length} chars.`);
        }
      }

      // Loop de function calling com streaming na resposta final.
      // Máx 3 iterações; cada iteração pode processar múltiplos function calls simultaneamente.
      let finalText = '';
      let finalSources: Source[] = [];

      for (let iteration = 0; iteration < 3; iteration++) {
        const iterResult = await withRetry(async () => {
          setStreamingText(null);
          const fcalls: any[] = [];
          let iterText = '';
          let lastChunk: any = null;

          const stream = await (ai.models as any).generateContentStream({
            model: modelName,
            contents: currentContents,
            config: {
              systemInstruction: systemInstructionWithSkill,
              tools: ferramentasAtivas,
              ...thinkingConfig
            }
          });

          for await (const chunk of stream) {
            lastChunk = chunk;
            const parts = chunk.candidates?.[0]?.content?.parts || [];

            let hasFunctionCall = false;
            for (const part of parts) {
              if (part.functionCall) {
                fcalls.push(part.functionCall);
                hasFunctionCall = true;
              }
            }

            if (hasFunctionCall) {
              iterText = '';
              setStreamingText(null);
            } else {
              const delta: string = chunk.text || '';
              if (delta) {
                iterText += delta;
                setStreamingText(prev => (prev || '') + delta);
              }
            }
          }

          return { fcalls, text: iterText, lastChunk };
        });

        if (iterResult.fcalls.length === 0) {
          // Resposta final em texto — coleta grounding e encerra o loop
          finalText = iterResult.text || "Não encontrei uma resposta para sua pergunta.";

          const groundingChunks = iterResult.lastChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks) {
            const webSources = groundingChunks
              .map((chunk: any) => chunk.web)
              .filter((webSource: any) => webSource && webSource.uri && webSource.title)
              .map((webSource: any) => ({ uri: webSource.uri, title: webSource.title }));
            finalSources = webSources.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.uri === v.uri) === i);
          }
          break;
        }

        // Tem function calls — executa e acumula no histórico
        setStreamingText(null);
        for (const fc of iterResult.fcalls) {
          const resultado = await executarFerramenta(fc.name!, fc.args || {});
          currentContents = [
            ...currentContents,
            { role: 'model' as const, parts: [{ functionCall: { name: fc.name!, args: fc.args || {} } }] },
            { role: 'user' as const, parts: [{ functionResponse: { name: fc.name!, response: resultado } }] }
          ];
        }
      }

      // Critique pass: revisa a resposta antes de apresentá-la ao usuário.
      // Roda enquanto isLoading ainda é true (bloqueia nova mensagem).
      // streamingText continua com a 1ª resposta (cursor piscando) — UX de "ainda processando".
      // O drain animará o texto da 1ª resposta; quando terminar, a mensagem refinada revela.
      const activeSkillForCritique = selectedSkillName || detectedSkill?.name;
      if (activeSkillForCritique && !usarPesquisa && finalText && finalText.length > 300 && mode === 'complete') {
        try {
          console.log(`✏️ [Critique] Revisando com lente "${activeSkillForCritique}"...`);
          const refined = await critiqueCandidateResponse(ai, text, finalText, activeSkillForCritique);
          if (refined && refined !== finalText) {
            console.log('✏️ [Critique] Resposta refinada.');
            finalText = refined;
          } else {
            console.log('✓ [Critique] Aprovada sem modificações.');
          }
        } catch (critiqueErr) {
          console.warn('⚠️ [Critique] Falhou silenciosamente — mantendo resposta original:', critiqueErr);
        }
      }

      const modelMessage: Message = {
        role: 'model',
        text: finalText || "Não encontrei uma resposta para sua pergunta.",
        sources: finalSources.length > 0 ? finalSources : undefined
      };

      // Atualiza o histórico para a próxima interação
      historyRef.current = [...currentContents, { role: 'model', parts: [{ text: finalText }] }];

      // Sinaliza conclusão — streamingText mantém o valor acumulado para o drain drenar
      setStreamingComplete(true);
      setMessages(prev => [...prev, modelMessage]);

    } catch (e: any) {
      setStreamingText(null);
      const { msg: rawMsg, is503, is429, is500 } = getGeminiError(e);
      console.error('❌ Chat error details:', { is503, is429, is500, message: e?.message || e });

      // Fallback OpenRouter: tenta quando Gemini retorna 503 ou 429
      if ((is503 || is429) && OPENROUTER_API_KEY) {
        console.warn(`🔀 Gemini ${is503 ? '503' : '429'} detectado — ativando fallback OpenRouter...`);
        try {
          const result = await callOpenRouter(
            currentContents,
            systemInstructionWithSkill,
            ferramentasAtivas as any,
            executarFerramenta
          );
          const modelMessage: Message = { role: 'model', text: result.text };
          historyRef.current = [...currentContents, { role: 'model', parts: [{ text: result.text }] }];
          setMessages(prev => [...prev, modelMessage]);
          return; // sucesso via fallback
        } catch (orError: any) {
          console.error('❌ OpenRouter fallback também falhou:', orError?.message || orError);
        }
      } else if ((is503 || is429) && !OPENROUTER_API_KEY) {
        console.error('❌ Erro de cota/sobrecarga mas OPENROUTER_API_KEY não está configurada.');
      }

      let errorMessage: string;

      if (rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('rate limit') || rawMsg.includes('resource_exhausted')) {
        errorMessage = '⚠️ Limite de requisições atingido (quota da API Gemini). Aguarde alguns segundos e tente novamente.';
      } else if (is503) {
        errorMessage = '⚠️ Os servidores do Google Gemini estão sobrecarregados no momento. Aguarde alguns segundos e tente novamente.';
      } else if (rawMsg.includes('500')) {
        errorMessage = '⚠️ Erro interno nos servidores do Google Gemini. Tente novamente.';
      } else if (rawMsg.includes('api_key') || rawMsg.includes('api key') || rawMsg.includes('invalid') || rawMsg.includes('401') || rawMsg.includes('403')) {
        errorMessage = '⚠️ Problema com a chave de API. Verifique as configurações.';
      } else {
        // Erro inesperado — mostra a mensagem real no console e um genérico na UI
        console.error('❌ Erro não categorizado:', rawMsg);
        errorMessage = `⚠️ Erro inesperado: ${e?.message?.substring(0, 120) || 'desconhecido'}. Verifique o console para detalhes.`;
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading, error, streamingText, streamingComplete };
};