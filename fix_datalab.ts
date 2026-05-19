import fs from 'fs';
let content = fs.readFileSync('components/DataLabView.tsx', 'utf8');
content = content.replace(/const _metadadosDataLab = getMetadados\(\);/g, 'let _metadadosDataLab: any = { setores: [], regioes: [], anos: [], tipos: [] };\ngetMetadados().then(m => _metadadosDataLab = m).catch(console.error);');
content = content.replace(/const summary = filtrarParaRelatorio\(filtrosPiesp\);/g, 'const [summary, setSummary] = useState<any>(null);\n  useEffect(() => {\n    filtrarParaRelatorio(filtrosPiesp).then(setSummary).catch(console.error);\n  }, [JSON.stringify(filtrosPiesp)]);\n  if (!summary) return <div>Carregando...</div>;');
content = content.replace(/const summary = filtrarParaRelatorio\(f\);/g, 'const [summary, setSummary] = useState<any>(null);\n  useEffect(() => {\n    filtrarParaRelatorio(f).then(setSummary).catch(console.error);\n  }, [JSON.stringify(f)]);\n  if (!summary) return <div>Carregando...</div>;');
fs.writeFileSync('components/DataLabView.tsx', content);
