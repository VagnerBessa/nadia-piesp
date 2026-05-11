// Analytics engine — all pure functions, no React

export type NodeRole = 'concentrador' | 'ponte' | 'intermediário' | 'periférico';

export interface NodeMetrics {
  degree: number;
  weightedDegree: number;
  betweenness: number;   // 0–1 normalized
  community: number;     // sequential 0,1,2,...
  role: NodeRole;
  roleLabel: string;
  roleDesc: string;
}

export interface RankedNode {
  id: string;
  label: string;
  group: string;
  value: number;
}

export interface GraphMetrics {
  byNode: Record<string, NodeMetrics>;
  communityCount: number;
  density: number;
  components: number;
  isConnected: boolean;
  topByDegree: RankedNode[];
  topByBetweenness: RankedNode[];
  topByVal: RankedNode[];
  bridges: string[];             // high betweenness, low-to-median degree
  peripheralHighValue: string[]; // degree ≤ 2 but val in top 30%
  medianDegree: number;
  maxDegree: number;
  totalNodes: number;
  totalLinks: number;
  synthesis: string;
  territorialConcentration: string;
  communityNames: Record<number, string>;  // communityId → "Label A · Label B"
  communitySize: Record<number, number>;   // communityId → node count
}

interface NodeIn { id: string; label: string; group: string; val: number; }
interface LinkIn { source: any; target: any; weight: number; }

function toId(x: any): string {
  return typeof x === 'object' && x !== null ? x.id : String(x);
}

function buildAdj(nodes: NodeIn[], links: LinkIn[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const l of links) {
    const s = toId(l.source), t = toId(l.target);
    if (s !== t) { adj.get(s)?.push(t); adj.get(t)?.push(s); }
  }
  return adj;
}

function computeDegree(nodes: NodeIn[], adj: Map<string, string[]>): Record<string, number> {
  const d: Record<string, number> = {};
  for (const n of nodes) d[n.id] = adj.get(n.id)?.length ?? 0;
  return d;
}

function computeWeightedDegree(nodes: NodeIn[], links: LinkIn[]): Record<string, number> {
  const wd: Record<string, number> = {};
  for (const n of nodes) wd[n.id] = 0;
  for (const l of links) {
    const s = toId(l.source), t = toId(l.target);
    wd[s] = (wd[s] ?? 0) + l.weight;
    wd[t] = (wd[t] ?? 0) + l.weight;
  }
  return wd;
}

// Brandes exact betweenness — O(VE), fine for ≤500 nodes
function computeBetweenness(nodes: NodeIn[], adj: Map<string, string[]>): Record<string, number> {
  const ids = nodes.map(n => n.id);
  const n = ids.length;
  const CB: Record<string, number> = {};
  for (const id of ids) CB[id] = 0;

  for (const s of ids) {
    const S: string[] = [];
    const P: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const dist: Record<string, number> = {};
    for (const id of ids) { P[id] = []; sigma[id] = 0; dist[id] = -1; }
    sigma[s] = 1; dist[s] = 0;

    const Q: string[] = [s];
    while (Q.length) {
      const v = Q.shift()!;
      S.push(v);
      for (const w of (adj.get(v) ?? [])) {
        if (dist[w] < 0) { Q.push(w); dist[w] = dist[v] + 1; }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
      }
    }

    const delta: Record<string, number> = {};
    for (const id of ids) delta[id] = 0;
    while (S.length) {
      const w = S.pop()!;
      for (const v of P[w]) delta[v] += (sigma[v] / (sigma[w] || 1)) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }

  const scale = n > 2 ? 2 / ((n - 1) * (n - 2)) : 0;
  for (const id of ids) CB[id] = Math.min(1, CB[id] * scale);
  return CB;
}

// Label-propagation community detection
function detectCommunities(nodes: NodeIn[], adj: Map<string, string[]>): Record<string, number> {
  const lbl: Record<string, number> = {};
  nodes.forEach((n, i) => { lbl[n.id] = i; });

  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    const order = [...nodes].sort(() => Math.random() - 0.5);
    for (const nd of order) {
      const nbs = adj.get(nd.id) ?? [];
      if (!nbs.length) continue;
      const freq: Record<number, number> = {};
      for (const nb of nbs) { const l = lbl[nb]; freq[l] = (freq[l] ?? 0) + 1; }
      let maxF = 0, best = lbl[nd.id];
      for (const [l, c] of Object.entries(freq)) if (c > maxF) { maxF = c; best = +l; }
      if (best !== lbl[nd.id]) { lbl[nd.id] = best; changed = true; }
    }
    if (!changed) break;
  }

  const map = new Map<number, number>(); let next = 0;
  const out: Record<string, number> = {};
  for (const nd of nodes) {
    if (!map.has(lbl[nd.id])) map.set(lbl[nd.id], next++);
    out[nd.id] = map.get(lbl[nd.id])!;
  }
  return out;
}

function countComponents(nodes: NodeIn[], adj: Map<string, string[]>): number {
  const vis = new Set<string>(); let c = 0;
  for (const start of nodes) {
    if (vis.has(start.id)) continue; c++;
    const q = [start.id];
    while (q.length) {
      const node = q.shift()!;
      if (vis.has(node)) continue; vis.add(node);
      for (const nb of (adj.get(node) ?? [])) if (!vis.has(nb)) q.push(nb);
    }
  }
  return c;
}

function pct(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = (p / 100) * (s.length - 1);
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
}

function classifyRole(
  degree: number, betweenness: number,
  p75deg: number, medDeg: number, p75btw: number
): Pick<NodeMetrics, 'role' | 'roleLabel' | 'roleDesc'> {
  if (degree >= p75deg && betweenness >= p75btw)
    return { role: 'concentrador', roleLabel: 'Concentrador',
      roleDesc: 'Alta centralidade e forte intermediação — articula múltiplos agrupamentos.' };
  if (degree <= medDeg && betweenness >= p75btw && p75btw > 0)
    return { role: 'ponte', roleLabel: 'Ponte',
      roleDesc: 'Poucas conexões, mas posição estratégica entre agrupamentos distintos.' };
  if (degree >= p75deg)
    return { role: 'intermediário', roleLabel: 'Intermediário',
      roleDesc: 'Bem conectado dentro de seu agrupamento, com menor papel de intermediação global.' };
  return { role: 'periférico', roleLabel: 'Periférico',
    roleDesc: 'Poucas conexões no recorte atual.' };
}

function top5(nodes: NodeIn[], values: Record<string, number>): RankedNode[] {
  return [...nodes]
    .sort((a, b) => (values[b.id] ?? 0) - (values[a.id] ?? 0))
    .slice(0, 5)
    .map(n => ({ id: n.id, label: n.label, group: n.group, value: values[n.id] ?? 0 }));
}

function buildSynthesis(
  nodes: NodeIn[], links: LinkIn[],
  deg: Record<string, number>, btw: Record<string, number>,
  commCount: number, density: number, components: number,
  medDeg: number, bridges: string[], peripheral: string[]
): string {
  const n = nodes.length, e = links.length;
  if (!n) return 'Nenhum dado disponível para análise.';
  if (n < 3) return `Recorte com apenas ${n} nós — adicione mais dados para uma análise significativa.`;

  const parts: string[] = [];

  const connText = components === 1
    ? 'formando uma rede única interligada'
    : `fragmentada em ${components} sub-redes independentes`;
  parts.push(`O recorte atual contém ${n} nós e ${e} conexões, ${connText}.`);

  const topDeg = [...nodes].sort((a, b) => (deg[b.id] ?? 0) - (deg[a.id] ?? 0)).slice(0, 3);
  if (topDeg.length) {
    const names = topDeg.map(nd => `${nd.label} (${deg[nd.id] ?? 0})`);
    parts.push(names.length === 1
      ? `${names[0]} é o nó mais conectado no recorte.`
      : `Os nós com mais conexões são: ${names.join(', ')}.`);
  }

  if (bridges.length) {
    const bNames = bridges.slice(0, 2).map(id => nodes.find(nd => nd.id === id)?.label ?? id);
    parts.push(`${bNames.join(' e ')} ${bridges.length > 1 ? 'funcionam' : 'funciona'} como ponte entre agrupamentos distintos.`);
  }

  if (commCount > 1) parts.push(`Foram identificados ${commCount} agrupamentos estruturais no recorte.`);

  const dLabel = density > 0.4 ? 'densa' : density > 0.15 ? 'moderadamente conectada' : 'esparsa';
  parts.push(`A rede é ${dLabel} (${(density * 100).toFixed(0)}% das conexões possíveis realizadas).`);

  if (peripheral.length) {
    const pNames = peripheral.slice(0, 2).map(id => nodes.find(nd => nd.id === id)?.label ?? id).join(' e ');
    parts.push(`${pNames} ${peripheral.length > 1 ? 'aparecem' : 'aparece'} com poucas conexões, mas valor de investimento relevante.`);
  }

  if (n < 10) parts.push('Atenção: recorte pequeno — métricas de centralidade têm validade limitada com poucos elementos.');

  return parts.join(' ');
}

export function computeGraphMetrics(nodes: NodeIn[], links: LinkIn[]): GraphMetrics {
  const empty: GraphMetrics = {
    byNode: {}, communityCount: 0, density: 0, components: 0, isConnected: true,
    topByDegree: [], topByBetweenness: [], topByVal: [],
    bridges: [], peripheralHighValue: [], medianDegree: 0, maxDegree: 0,
    totalNodes: 0, totalLinks: 0, synthesis: '', territorialConcentration: '',
    communityNames: {}, communitySize: {},
  };
  if (!nodes.length) return empty;

  const adj = buildAdj(nodes, links);
  const deg = computeDegree(nodes, adj);
  const wd  = computeWeightedDegree(nodes, links);
  const btw = nodes.length <= 500 ? computeBetweenness(nodes, adj)
    : Object.fromEntries(nodes.map(n => [n.id, 0]));
  const comm    = detectCommunities(nodes, adj);
  const commCount = new Set(Object.values(comm)).size;
  const comps   = countComponents(nodes, adj);

  const uniqueEdges = new Set(links.map(l => {
    const [s, t] = [toId(l.source), toId(l.target)].sort();
    return `${s}|${t}`;
  })).size;
  const n = nodes.length;
  const density = n > 1 ? uniqueEdges / (n * (n - 1) / 2) : 0;

  const degVals = nodes.map(nd => deg[nd.id] ?? 0);
  const medDeg  = pct(degVals, 50);
  const p75deg  = pct(degVals, 75);
  const maxDeg  = Math.max(0, ...degVals);
  const p75btw  = pct(nodes.map(nd => btw[nd.id] ?? 0), 75);
  const p70val  = pct(nodes.map(nd => nd.val), 70);

  const bridges = nodes
    .filter(nd => (btw[nd.id] ?? 0) >= p75btw && p75btw > 0 && (deg[nd.id] ?? 0) <= medDeg + 1)
    .sort((a, b) => (btw[b.id] ?? 0) - (btw[a.id] ?? 0))
    .slice(0, 5).map(nd => nd.id);

  const peripheralHighValue = nodes
    .filter(nd => (deg[nd.id] ?? 0) <= 2 && nd.val >= p70val && nd.val > 1)
    .sort((a, b) => b.val - a.val)
    .slice(0, 4).map(nd => nd.id);

  const byNode: Record<string, NodeMetrics> = {};
  for (const nd of nodes) {
    byNode[nd.id] = {
      degree: deg[nd.id] ?? 0,
      weightedDegree: wd[nd.id] ?? 0,
      betweenness: btw[nd.id] ?? 0,
      community: comm[nd.id] ?? 0,
      ...classifyRole(deg[nd.id] ?? 0, btw[nd.id] ?? 0, p75deg, medDeg, p75btw),
    };
  }

  // Territorial concentration
  const muniNodes = nodes.filter(nd => nd.group === 'municipio');
  let terrConc = '';
  if (muniNodes.length >= 3) {
    const sorted = [...muniNodes].sort((a, b) => (deg[b.id] ?? 0) - (deg[a.id] ?? 0));
    const top3Sum = sorted.slice(0, 3).reduce((s, nd) => s + (deg[nd.id] ?? 0), 0);
    const allSum  = muniNodes.reduce((s, nd) => s + (deg[nd.id] ?? 0), 0);
    if (allSum > 0) {
      const pct = Math.round((top3Sum / allSum) * 100);
      terrConc = `${pct}% das conexões municipais concentram-se em ${sorted.slice(0,3).map(nd=>nd.label).join(', ')}.`;
    }
  }

  const valMap: Record<string, number> = {};
  for (const nd of nodes) valMap[nd.id] = nd.val;

  // Community names: top-2 nodes by degree within each community
  const commBuckets: Record<number, NodeIn[]> = {};
  for (const nd of nodes) {
    const c = comm[nd.id] ?? 0;
    if (!commBuckets[c]) commBuckets[c] = [];
    commBuckets[c].push(nd);
  }
  const communityNames: Record<number, string> = {};
  const communitySize: Record<number, number>  = {};
  for (const [cStr, members] of Object.entries(commBuckets)) {
    const c = +cStr;
    communitySize[c] = members.length;
    const top = [...members]
      .sort((a, b) => (deg[b.id] ?? 0) - (deg[a.id] ?? 0))
      .slice(0, 2);
    communityNames[c] = top.map(nd => nd.label).join(' · ');
  }

  return {
    byNode, communityCount: commCount, density, components: comps,
    isConnected: comps === 1,
    topByDegree: top5(nodes, deg),
    topByBetweenness: top5(nodes, btw),
    topByVal: top5(nodes, valMap),
    bridges, peripheralHighValue, medianDegree: medDeg, maxDegree: maxDeg,
    totalNodes: n, totalLinks: uniqueEdges,
    synthesis: buildSynthesis(nodes, links, deg, btw, commCount, density, comps, medDeg, bridges, peripheralHighValue),
    territorialConcentration: terrConc,
    communityNames, communitySize,
  };
}

export const COMMUNITY_PALETTE = [
  '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c',
  '#facc15', '#22d3ee', '#4ade80', '#f87171', '#818cf8',
  '#bef264', '#67e8f9', '#c4b5fd', '#fcd34d', '#6ee7b7',
];
