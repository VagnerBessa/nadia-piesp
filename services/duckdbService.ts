/**
 * DuckDB WASM Service — Singleton para consultas no browser
 *
 * Usa os bundles do jsDelivr CDN para os workers WASM.
 * O truque para evitar "Can't find variable: require" é NÃO importar
 * os workers via import estático — em vez disso, usamos a URL do CDN
 * diretamente no construtor do Worker.
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  // Seleciona o bundle mais adequado ao browser atual
  const BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(BUNDLES);

  // Cria o worker a partir de um Blob URL para evitar que o Vite
  // tente fazer bundle do worker e introduza require() no browser.
  // O worker script é baixado do CDN e executado isoladamente.
  const workerUrl = bundle.mainWorker!;
  const workerResponse = await fetch(workerUrl);
  const workerBlob = await workerResponse.blob();
  const workerBlobUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerBlobUrl);

  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  conn = await db.connect();

  // Registra o Parquet via HTTP — só baixa os chunks que as queries precisam
  const parquetUrl = new URL('/piesp.parquet', window.location.origin).href;
  await db.registerFileURL('piesp.parquet', parquetUrl, duckdb.DuckDBDataProtocol.HTTP, false);

  await conn.query(`CREATE VIEW piesp AS SELECT * FROM 'piesp.parquet'`);

  URL.revokeObjectURL(workerBlobUrl);

  console.log('🦆 DuckDB WASM inicializado com sucesso');
  return conn;
}

/**
 * Retorna uma conexão pronta para queries.
 * Lazy: inicializa apenas na primeira chamada.
 */
export async function getDbConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  if (!initPromise) {
    initPromise = initDuckDB().catch(e => {
      initPromise = null; // permite retry em caso de erro
      throw e;
    });
  }
  return initPromise;
}
