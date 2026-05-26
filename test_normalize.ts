const COLUNAS_MAP: Record<string, string> = {
  'data do inicio de atividade': 'Data do início de atividade',
  'nome do municipio': 'Nome do município',
  'municipio': 'Nome do município',
  'setor de atividade economica': 'Setor de atividade econômica',
  'setor': 'Setor de atividade econômica',
  'porte da empresa': 'Porte da empresa',
  'porte': 'Porte da empresa',
  'situacao cadastral': 'Situacao cadastral',
  'opcao mei': 'Opção MEI',
  'data da opcao mei': 'Data da opcao MEI',
  'regiao administrativa': 'Região Administrativa',
  'regiao': 'Região Administrativa',
  'atividade economica': 'Atividade econômica',
  'natureza juridica': 'Natureza jurídica',
  'sexo': 'Sexo',
  'cnpj': 'CNPJ'
};

const normalizeCol = (col: string) => {
  if (!col || col === '*') return 'CNPJ';
  let clean = col.toLowerCase().trim();
  // remove accents
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // replace underscores with spaces
  clean = clean.replace(/_/g, ' ');
  return COLUNAS_MAP[clean] || col;
};

console.log(normalizeCol('setor_de_atividade_economica'));
console.log(normalizeCol('setor_de_atividade_econômica'));
console.log(normalizeCol('Setor_de_atividade_economica'));
console.log(normalizeCol('Setor_de_Atividade_Econômica'));
console.log(normalizeCol('município'));
console.log(normalizeCol('Data_do_início_de_atividade'));
