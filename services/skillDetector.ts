// Importa todos os arquivos de skill como texto puro (são pequenos, ~3KB cada)
import EMPREGO from '../skills/emprego_empregabilidade.md?raw';
import QUALIFICACAO from '../skills/qualificacao_profissional.md?raw';
import LOGISTICA from '../skills/logistica_infraestrutura.md?raw';
import INOVACAO from '../skills/inovacao_tecnologia.md?raw';
import DESENVOLVIMENTO from '../skills/desenvolvimento_regional.md?raw';
import CADEIAS from '../skills/cadeias_produtivas.md?raw';
import TRANSICAO from '../skills/transicao_energetica.md?raw';
import COMERCIO from '../skills/comercio_exterior.md?raw';
import EMPRESA from '../skills/inteligencia_empresarial.md?raw';

interface SkillConfig {
  name: string;
  label: string;
  content: string;
  keywords: string[];
}

// Cada skill tem uma lista de palavras-chave que ativam sua detecção.
// A normalização (toLowerCase + sem acento) é feita antes da comparação.
const SKILLS: SkillConfig[] = [
  {
    name: 'emprego_empregabilidade',
    label: 'Emprego e Empregabilidade',
    content: EMPREGO,
    keywords: [
      'emprego', 'empregos', 'empregabilidade', 'trabalho', 'trabalhador', 'trabalhadores',
      'posto', 'postos', 'vaga', 'vagas', 'salario', 'salarios', 'remuneracao',
      'contratacao', 'contratacoes', 'desemprego', 'desempregado', 'formal', 'informal',
      'operario', 'funcionario', 'clt', 'carteira', 'sindicato', 'terceirizacao',
      'forca de trabalho', 'mercado de trabalho', 'geração de empregos', 'gerar empregos',
      'quantos empregos', 'criar empregos', 'criacao de empregos'
    ]
  },
  {
    name: 'qualificacao_profissional',
    label: 'Qualificação Profissional',
    content: QUALIFICACAO,
    keywords: [
      'qualificacao', 'qualificados', 'formacao', 'capacitacao', 'treinamento',
      'tecnico', 'tecnicos', 'senai', 'senac', 'universidade', 'faculdade',
      'escola tecnica', 'instituto federal', 'competencia', 'habilidade',
      'curso', 'cursos', 'profissional', 'profissionais', 'mao de obra qualificada',
      'mao de obra', 'capital humano', 'educacao profissional', 'formacao tecnica',
      'qualificado', 'especializacao', 'workforce'
    ]
  },
  {
    name: 'logistica_infraestrutura',
    label: 'Logística e Infraestrutura',
    content: LOGISTICA,
    keywords: [
      'logistica', 'transporte', 'transportes', 'rodovia', 'estrada', 'ferrovia',
      'porto', 'aeroporto', 'armazem', 'distribuicao', 'modal', 'infraestrutura',
      'caminhao', 'escoamento', 'corredor', 'acesso viario', 'malha',
      'energia eletrica', 'agua', 'saneamento', 'gargalo', 'hub logistico',
      'centro de distribuicao', 'cadeia de suprimento', 'supply chain',
      'last mile', 'ultima milha', 'intermodal', 'multimodal'
    ]
  },
  {
    name: 'inovacao_tecnologia',
    label: 'Inovação e Tecnologia',
    content: INOVACAO,
    keywords: [
      'inovacao', 'tecnologia', 'tecnologico', 'pesquisa', 'desenvolvimento',
      'p&d', 'p e d', 'startup', 'startups', 'digital', 'digitalizacao',
      'automacao', 'robotica', 'inteligencia artificial', 'ia', 'machine learning',
      'data center', 'software', 'industria 4.0', 'industria 40', 'patente',
      'high tech', 'high-tech', 'modernizacao tecnologica', 'transformacao digital',
      'ecossistema de inovacao', 'hub tecnologico', 'semicondutor', 'chip',
      'biotecnologia', 'farmaceutico', 'aeroespacial', 'defesa'
    ]
  },
  {
    name: 'desenvolvimento_regional',
    label: 'Desenvolvimento Regional',
    content: DESENVOLVIMENTO,
    keywords: [
      'desenvolvimento regional', 'regional', 'regiao', 'regioes', 'territorio',
      'interior', 'municipio', 'desigualdade', 'polo', 'polo regional',
      'economia local', 'economia municipal', 'pib municipal', 'base economica',
      'multiplicador', 'descentralizacao', 'interiorizacao', 'rmsp', 'metropole',
      'grande sao paulo', 'ra ', 'regiao administrativa', 'regiao metropolitana',
      'impacto local', 'impacto regional', 'desenvolvimento economico'
    ]
  },
  {
    name: 'cadeias_produtivas',
    label: 'Cadeias Produtivas',
    content: CADEIAS,
    keywords: [
      'cadeia produtiva', 'cadeias produtivas', 'fornecedor', 'fornecedores',
      'cadeia de valor', 'insumo', 'componente', 'polo industrial', 'cluster',
      'adensamento', 'integracao vertical', 'substituicao de importacao',
      'encadeamento', 'aglomeracao', 'ecossistema produtivo', 'ancoras',
      'ancora industrial', 'subcontratacao', 'terceiristas', 'elo da cadeia',
      'autopecas', 'montadora', 'industria de base', 'conteudo local',
      'forward linkage', 'backward linkage', 'industria de transformacao'
    ]
  },
  {
    name: 'transicao_energetica',
    label: 'Transição Energética e Sustentabilidade',
    content: TRANSICAO,
    keywords: [
      'transicao energetica', 'sustentabilidade', 'sustentavel', 'carbono',
      'emissao', 'emissoes', 'verde', 'renovavel', 'renovaveis', 'solar',
      'eolico', 'biocombustivel', 'biodiesel', 'etanol', 'esg', 'ambiental',
      'energia limpa', 'descarbonizacao', 'impacto ambiental', 'bioma',
      'manancial', 'hidrico', 'aquifero', 'pegada de carbono', 'gases estufa',
      'net zero', 'neutro em carbono', 'stranded asset', 'ativo encalhado',
      'energia eletrica renovavel', 'fotovoltaico', 'geracao distribuida',
      'mata ciliar', 'area de protecao', 'unidade de conservacao'
    ]
  },
  {
    name: 'comercio_exterior',
    label: 'Comércio Exterior e Exportações',
    content: COMERCIO,
    keywords: [
      'exportacao', 'exportacoes', 'exportar', 'importacao', 'importacoes',
      'importar', 'comercio exterior', 'cambio', 'dolar', 'mercado externo',
      'mercado global', 'mercado internacional', 'porto de santos', 'santos',
      'acordo comercial', 'mercosul', 'balanca comercial', 'pauta exportadora',
      'competitividade exportadora', 'cadeia global', 'multinacional',
      'capital estrangeiro', 'ide', 'investimento estrangeiro', 'tarifa',
      'barreira tarifaria', 'anti-dumping', 'complexidade economica',
      'commodities', 'valor agregado', 'taxa de cambio'
    ]
  },
  {
    name: 'inteligencia_empresarial',
    label: 'Inteligência Empresarial',
    content: EMPRESA,
    // Keywords ativam quando o usuário pergunta sobre a EMPRESA EM SI — não sobre o investimento
    keywords: [
      // Perguntas diretas sobre a empresa
      'o que e', 'o que sao', 'quem e', 'quem sao', 'me fale sobre', 'me conte sobre',
      'me explique', 'pode me falar', 'pode me contar', 'saiba mais',
      // Tipos de entidade
      'consorcio', 'consorcios', 'holding', 'controladora', 'subsidiaria',
      'grupo empresarial', 'grupo economico', 'spe', 'joint venture',
      // Origem e estrutura de capital
      'origem de capital', 'capital nacional', 'capital brasileiro',
      'empresa estrangeira', 'empresa nacional', 'empresa brasileira',
      'porte da empresa', 'tamanho da empresa', 'sede', 'matriz',
      // Histórico e controle
      'historia da empresa', 'fundacao', 'quando foi fundada', 'desde quando',
      'quem controla', 'quem e o dono', 'acionista', 'socio',
      // Finanças corporativas
      'faturamento', 'receita', 'bolsa de valores', 'capital aberto',
      'private equity', 'fundo de investimento'
    ]
  }
];

// Normaliza texto removendo acentos e convertendo para minúsculas
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Detecta qual skill é relevante para a mensagem do usuário.
 * Retorna o conteúdo da skill (texto markdown) ou null se nenhuma for relevante.
 */
export function detectSkill(userMessage: string): { name: string; label: string; content: string } | null {
  const textoNormalizado = normalizar(userMessage);

  let melhorSkill: SkillConfig | null = null;
  let melhorScore = 0;

  for (const skill of SKILLS) {
    const score = skill.keywords.filter(kw => textoNormalizado.includes(normalizar(kw))).length;
    if (score > melhorScore) {
      melhorScore = score;
      melhorSkill = skill;
    }
  }

  if (melhorScore === 0 || !melhorSkill) {
    return null; // Nenhuma skill relevante — Nadia responde como analista geral
  }

  console.log(`🎯 Skill detectada: "${melhorSkill.label}" (score: ${melhorScore})`);
  return { name: melhorSkill.name, label: melhorSkill.label, content: melhorSkill.content };
}

/**
 * Retorna a skill pelo nome exato (para seleção manual pelo usuário).
 */
export function getSkillByName(name: string): { name: string; label: string; content: string } | null {
  const skill = SKILLS.find(s => s.name === name);
  if (!skill) return null;
  return { name: skill.name, label: skill.label, content: skill.content };
}

/**
 * Injeta uma skill escolhida manualmente no system instruction base.
 * Não faz detecção por palavras-chave — usa o nome diretamente.
 */
export function buildSystemInstructionWithSkillByName(
  baseInstruction: string,
  skillName: string
): string {
  const skill = getSkillByName(skillName);
  if (!skill) return baseInstruction;

  return `${baseInstruction}

---
## LENTE ANALÍTICA ATIVADA: ${skill.label.toUpperCase()}

Para esta resposta, analise os dados da PIESP aplicando a perspectiva especializada descrita abaixo. Integre naturalmente essa visão especializada à sua resposta — sem mencionar explicitamente que está usando uma "skill" ou "lente". Apenas demonstre o conhecimento especializado na forma como você interpreta e apresenta os dados.

${skill.content}`;
}

/**
 * Injeta o conteúdo da skill detectada no system instruction base.
 * Retorna o system instruction enriquecido com a lente especializada.
 */
export function buildSystemInstructionWithSkill(
  baseInstruction: string,
  userMessage: string
): string {
  const skill = detectSkill(userMessage);
  if (!skill) return baseInstruction;

  // A skill de inteligencia empresarial usa framing diferente:
  // o usuário está perguntando sobre a empresa EM SI, não sobre os dados PIESP.
  // Portanto autorizamos explicitamente o uso do conhecimento geral do modelo.
  const instrucaoContexto = skill.name === 'inteligencia_empresarial'
    ? `Para esta resposta, o usuário quer saber sobre a própria empresa ou grupo econômico — não apenas sobre seus investimentos na PIESP. USE seu conhecimento geral público sobre a empresa, grupo, origem de capital e estrutura corportiva. Não se limite ao banco de dados PIESP nem recuse responder alegando falta de acesso. Se o usuário quiser também ver os investimentos registrados, ofereça consultar a base após contextualizar quem é a empresa.`
    : `Para esta resposta, analise os dados da PIESP aplicando a perspectiva especializada descrita abaixo. Integre naturalmente essa visão especializada à sua resposta — sem mencionar explicitamente que está usando uma "skill" ou "lente". Apenas demonstre o conhecimento especializado na forma como você interpreta e apresenta os dados.`;

  return `${baseInstruction}

---
## LENTE ANALÍTICA ATIVADA: ${skill.label.toUpperCase()}

${instrucaoContexto}

${skill.content}`;
}
