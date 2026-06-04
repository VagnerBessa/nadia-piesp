import EMPRESA from '../skills/inteligencia_empresarial.md?raw';

interface SkillConfig {
  name: string;
  label: string;
  content: string;
  keywords: string[];
}

const SKILLS: SkillConfig[] = [
  {
    name: 'analise_territorial',
    label: 'Análise Territorial',
    content: 'Priorize rankings por município e região, concentração territorial, interiorização, comparação entre municípios e diferenças entre capital, regiões metropolitanas e interior. Use a base cadastral para quantificar empresas abertas, ativas ou fechadas no recorte pedido.',
    keywords: ['municipio', 'municipios', 'cidade', 'cidades', 'regiao', 'regional', 'territorio', 'ranking', 'interior', 'capital'],
  },
  {
    name: 'analise_setorial',
    label: 'Análise Setorial',
    content: 'Priorize setor de atividade econômica e atividade econômica detalhada. Diferencie setor amplo de segmento CNAE. Para temas como tecnologia, saúde, comércio ou alimentação, use termo de atividade econômica em vez de inventar um setor inexistente.',
    keywords: ['setor', 'setores', 'atividade', 'segmento', 'cnae', 'tecnologia', 'saude', 'comercio', 'servicos', 'industria'],
  },
  {
    name: 'mei_formalizacao',
    label: 'MEI e Formalização',
    content: 'Analise MEI usando exclusivamente Opção MEI = Sim. Não use porte para identificar MEI. Explique Não se aplica ao MEI como campo cadastral fora do universo MEI. Não trate Não se aplica como gênero ou tipo de empreendedor.',
    keywords: ['mei', 'meis', 'microempreendedor', 'formalizacao', 'opcao mei', 'nao se aplica'],
  },
  {
    name: 'perfil_empreendedor',
    label: 'Perfil do Empreendedor',
    content: 'Use sexo/gênero somente quando o usuário pedir perfil de homens, mulheres ou gênero. Faça essa leitura preferencialmente dentro do universo MEI e evite generalizações sobre sócios ou controle societário.',
    keywords: ['mulher', 'mulheres', 'homem', 'homens', 'sexo', 'genero', 'perfil do empreendedor', 'empreendedora'],
  },
  {
    name: 'inova_simples',
    label: 'Inova Simples',
    content: 'Inova Simples deve ser tratado como Natureza jurídica = Empresa Simples de Inovação. Não é setor nem atividade econômica. Ao responder, explique que o recorte é jurídico-cadastral.',
    keywords: ['inova simples', 'inova-simples', 'empresa simples de inovacao', 'startup'],
  },
  {
    name: 'inteligencia_empresarial',
    label: 'Inteligência Empresarial',
    content: EMPRESA,
    keywords: [
      'o que e', 'o que sao', 'quem e', 'quem sao', 'me fale sobre', 'me conte sobre',
      'me explique', 'pode me falar', 'pode me contar', 'saiba mais',
      'consorcio', 'consorcios', 'holding', 'controladora', 'subsidiaria',
      'grupo empresarial', 'grupo economico', 'spe', 'joint venture',
      'origem de capital', 'capital nacional', 'capital brasileiro',
      'empresa estrangeira', 'empresa nacional', 'empresa brasileira',
      'porte da empresa', 'tamanho da empresa', 'sede', 'matriz',
      'historia da empresa', 'fundacao', 'quando foi fundada', 'desde quando',
      'quem controla', 'quem e o dono', 'acionista', 'socio',
      'faturamento', 'receita', 'bolsa de valores', 'capital aberto',
      'private equity', 'fundo',
    ],
  },
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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

  if (melhorScore === 0 || !melhorSkill) return null;
  return { name: melhorSkill.name, label: melhorSkill.label, content: melhorSkill.content };
}

export function getSkillByName(name: string): { name: string; label: string; content: string } | null {
  const skill = SKILLS.find(s => s.name === name);
  if (!skill) return null;
  return { name: skill.name, label: skill.label, content: skill.content };
}

export function buildSystemInstructionWithSkillByName(baseInstruction: string, skillName: string): string {
  const skill = getSkillByName(skillName);
  if (!skill) return baseInstruction;

  return `${baseInstruction}

---
## LENTE ANALÍTICA ATIVADA: ${skill.label.toUpperCase()}

Para esta resposta, use a perspectiva especializada descrita abaixo. Integre naturalmente essa visão à resposta, sem mencionar que está usando uma skill.

${skill.content}`;
}

export function buildSystemInstructionWithSkill(baseInstruction: string, userMessage: string): string {
  const skill = detectSkill(userMessage);
  if (!skill) return baseInstruction;

  return `${baseInstruction}

---
## LENTE ANALÍTICA ATIVADA: ${skill.label.toUpperCase()}

O usuário quer saber sobre a própria empresa ou grupo econômico. Use conhecimento público quando útil. Quando a pergunta envolver quantidade, abertura, fechamento, MEI, município, setor, porte ou natureza jurídica, consulte a base de empreendedorismo pelas ferramentas.

${skill.content}`;
}
