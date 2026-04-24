import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../knowledge_base/piesp.duckdb');
const PARQUET_PATH = path.join(__dirname, '../knowledge_base/piesp.parquet');
const KB_PATH = path.join(__dirname, '../knowledge_base');

// Inicializa o DuckDB diretamente no arquivo (ou remove o arquivo antigo se existir)
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const db = new duckdb.Database(DB_PATH); 

async function runQuery(query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

async function prepareData() {
  console.log('🎬 Iniciando processamento de dados PIESP...');

  try {
    // 1. Criar tabelas temporárias a partir dos CSVs
    // Nota: O DuckDB lê CSVs com ';' e trata decimais com ',' via parâmetros
    
    console.log('📊 Lendo arquivos CSV...');
    
    // Tabela: Investimentos com Valor
    await runQuery(`
      CREATE TABLE piesp_com_valor AS 
      SELECT * FROM read_csv_auto('${path.join(KB_PATH, 'piesp_confirmados_com_valor.csv')}', 
        delim=';', 
        decimal_separator=',',
        header=True)
    `);

    // Tabela: Investimentos sem Valor
    await runQuery(`
      CREATE TABLE piesp_sem_valor AS 
      SELECT * FROM read_csv_auto('${path.join(KB_PATH, 'piesp_confirmados_sem_valor.csv')}', 
        delim=';', 
        header=True)
    `);

    console.log('🧹 Limpando e unificando dados...');

    // 2. Unificar tabelas em uma visão consolidada (Master Table)
    // Aplicando transformações de limpeza e segmentação de colunas
    await runQuery(`
      CREATE TABLE piesp_master AS
      SELECT 
        anuncio_data,
        CAST(anuncio_ano AS INTEGER) as anuncio_ano,
        CAST(anuncio_mes AS INTEGER) as anuncio_mes,
        empresa_alvo,
        investidora_s,
        COALESCE(TRY_CAST(REPLACE(REPLACE(reais_milhoes, '.', ''), ',', '.') AS DOUBLE), 0.0) as reais_milhoes,
        COALESCE(TRY_CAST(REPLACE(REPLACE(dolares_milhoes, '.', ''), ',', '.') AS DOUBLE), 0.0) as dolares_milhoes,
        municipio,
        regiao,
        descr_investimento,
        setor_desc,
        cnae_inv_2_desc,

        -- Segmentação CNAE Investimento
        split_part(cnae_inv_5_cod_desc, ' - ', 1) as cnae_inv_codigo,
        split_part(cnae_inv_5_cod_desc, ' - ', 2) as cnae_inv_descricao,

        -- Segmentação CNAE Empresa
        split_part(cnae_empresa_5_cod_desc, ' - ', 1) as cnae_empresa_codigo,
        split_part(cnae_empresa_5_cod_desc, ' - ', 2) as cnae_empresa_descricao,

        tipo,

        -- Segmentação de Período (Data de Início e Fim)
        TRY_CAST(trim(split_part(periodo, '-', 1)) AS INTEGER) as investimento_ano_inicio,
        TRY_CAST(trim(split_part(periodo, '-', 2)) AS INTEGER) as investimento_ano_fim,

        periodo as periodo_original,
        'COM_VALOR' as fonte
      FROM piesp_com_valor
      UNION ALL
      SELECT 
        anuncio_data,
        CAST(anuncio_ano AS INTEGER) as anuncio_ano,
        CAST(anuncio_mes AS INTEGER) as anuncio_mes,
        empresa_alvo,
        investidora_s,
        0.0 as reais_milhoes,
        0.0 as dolares_milhoes,
        municipio,
        regiao,
        descr_investimento,
        setor_desc,
        cnae_inv_2_desc,

        -- Segmentação CNAE Investimento
        split_part(cnae_inv_5_cod_desc, ' - ', 1) as cnae_inv_codigo,
        split_part(cnae_inv_5_cod_desc, ' - ', 2) as cnae_inv_descricao,

        -- Segmentação CNAE Empresa
        split_part(cnae_empresa_5_cod_desc, ' - ', 1) as cnae_empresa_codigo,
        split_part(cnae_empresa_5_cod_desc, ' - ', 2) as cnae_empresa_descricao,

        tipo,

        -- Segmentação de Período
        TRY_CAST(trim(split_part(periodo, '-', 1)) AS INTEGER) as investimento_ano_inicio,
        TRY_CAST(trim(split_part(periodo, '-', 2)) AS INTEGER) as investimento_ano_fim,

        periodo as periodo_original,
        'SEM_VALOR' as fonte
      FROM piesp_sem_valor
    `);

    // 3. Exportar para Parquet (Alta performance)
    console.log(`💾 Exportando para Parquet em: ${PARQUET_PATH}`);
    await runQuery(`COPY piesp_master TO '${PARQUET_PATH}' (FORMAT PARQUET)`);

    const stats = await runQuery('SELECT count(*) as total, sum(reais_milhoes) as total_reais FROM piesp_master');
    console.log(`✅ Sucesso!`);
    console.log(`📊 Total de registros: ${stats[0].total}`);
    console.log(`💰 Volume total capturado: R$ ${stats[0].total_reais.toLocaleString('pt-BR')} milhões`);

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
  }
}

prepareData();
