/**
 * empreendedorismoDashboardData.ts
 * Serviço de agregação para o dashboard Empreendedorismo.
 * (Os dados locais em CSV foram removidos; o dashboard agora dependerá exclusivamente
 * do MCP ou exibirá dados zerados até a integração de visualização.)
 */

// --- Tipos ---
export interface EmpreendedorismoRecord {
  ano: string;
  mes: string;
  empresa: string;
  investidora: string;
  reais_milhoes: number;
  municipio: string;
  regiao: string;
  setor: string;
  cnae2: string;
  tipo: string;
  descricao: string;
}

export interface AggItem {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

export interface DashboardData {
  totalBilhoes: string;
  totalProjetos: number;
  totalEmpresas: number;
  totalMunicipios: number;
  porAno: AggItem[];
  porMes?: AggItem[];
  porSetor: AggItem[];
  porMunicipio: AggItem[];
  porRegiao: AggItem[];
  porEmpresa: AggItem[];
  porTipo: AggItem[];
  rmspVsInterior: { rmsp: number; interior: number };
}

const emptyDashboardData: DashboardData = {
  totalBilhoes: '0,0',
  totalProjetos: 0,
  totalEmpresas: 0,
  totalMunicipios: 0,
  porAno: [],
  porMes: [],
  porSetor: [],
  porMunicipio: [],
  porRegiao: [],
  porEmpresa: [],
  porTipo: [],
  rmspVsInterior: { rmsp: 0, interior: 0 },
};

export function getAvailableYears(): string[] {
  return [];
}

export function getDashboardData(): DashboardData {
  return emptyDashboardData;
}

export function getDashboardDataByYear(ano: string): DashboardData {
  return emptyDashboardData;
}

/**
 * Gera um resumo textual dos dados para injeção no system instruction da Nadia (modo voz contextualizado).
 */
export function getDashboardContext(): string {
  return `
DADOS AGREGADOS DO DASHBOARD DE EMPREENDEDORISMO:
- Base conectada dinamicamente via MCP (mcp.seade.gov.br).
- Use as ferramentas do servidor MCP para obter números reais.
  `.trim();
}

