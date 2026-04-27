/**
 * DuckDB WASM Service — Singleton para consultas no browser
 * 
 * Inicializa o DuckDB-WASM e registra o arquivo Parquet como tabela virtual.
 * Usa lazy initialization: só carrega quando a primeira consulta é feita.
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  // Seleciona o bundle adequado ao browser
  const DUCKDB_BUNDLES = duckdb.getJsDelivrBundles();

  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  conn = await db.connect();

  // Registra o Parquet como tabela virtual — HTTP range requests automáticos
  const parquetUrl = new URL('/piesp.parquet', window.location.origin).href;
  await db.registerFileURL('piesp.parquet', parquetUrl, duckdb.DuckDBDataProtocol.HTTP, false);

  // Cria uma VIEW para facilitar as queries
  await conn.query(`CREATE VIEW piesp AS SELECT * FROM 'piesp.parquet'`);

  console.log('🦆 DuckDB WASM inicializado com sucesso');
  return conn;
}

/**
 * Retorna uma conexão pronta para queries.
 * Na primeira chamada, inicializa o DuckDB. Nas seguintes, retorna o cache.
 */
export async function getDbConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  if (!initPromise) {
    initPromise = initDuckDB();
  }
  return initPromise;
}
