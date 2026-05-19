import { getDbConnection } from './services/duckdbService.ts';
import { filtrarParaRelatorio } from './services/piespDataService.ts';

async function run() {
  console.log("Searching for TI...");
  const res = await filtrarParaRelatorio({ termo_busca: "TI" });
  console.log(`Found ${res.total_projetos} projects, total value: ${res.total_investimentos}`);
  console.log("Top 5:", res.projetos.slice(0, 5).map(p => p.empresa));
}
run().catch(console.error);
