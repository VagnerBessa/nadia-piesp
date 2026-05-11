import React, {
  useRef, useState, useCallback, useMemo, useEffect,
} from 'react';
// @ts-ignore
import ForceGraph3D from 'react-force-graph-3d';
// @ts-ignore
import SpriteText from 'three-spritetext';
import { GraphData, GraphNode } from '../services/piespGraphService';
import { computeGraphMetrics, GraphMetrics, COMMUNITY_PALETTE } from '../utils/graphAnalytics';
import { AnalyticsDrawer } from './AnalyticsDrawer';

export const GROUP_COLORS: Record<string, string> = {
  investidora:  '#f43f5e',
  empresa_alvo: '#38bdf8',
  municipio:    '#34d399',
  setor:        '#a78bfa',
};
const GROUP_LABELS: Record<string, string> = {
  investidora:  'Investidora',
  empresa_alvo: 'Empresa alvo',
  municipio:    'Município',
  setor:        'Setor',
};


function hexAlpha(hex: string, a: number) {
  const m = hex.replace('#', '').match(/.{2}/g)!;
  return `rgba(${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)},${a})`;
}
function nodeId(n: any): string {
  return typeof n === 'object' && n !== null ? n.id : n;
}

function Slider({ label, value, min, max, step = 1, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  fmt?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[9px] text-slate-500">
        <span>{label}</span>
        <span className="text-slate-400">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-rose-500 cursor-pointer" />
    </div>
  );
}

interface GraphCanvasProps {
  data: GraphData;
  onNodeSelect?: (node: GraphNode | null) => void;
  onMetricsReady?: (m: GraphMetrics) => void;
}

const GraphCanvas: React.FC<GraphCanvasProps> = ({ data, onNodeSelect, onMetricsReady }) => {
  const fgRef         = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const nodeSprites   = useRef(new WeakMap<object, any>());
  const hasZoomed     = useRef(false);
  // Always-current snapshot of graphData (force-graph mutates nodes in-place with x/y/z)
  const gd            = useRef<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [dims, setDims] = useState({ w: 800, h: 600 });

  // Selection
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [neighbors,   setNeighbors]   = useState<Set<string>>(new Set());

  // Filters / display
  const [visGroups,   setVisGroups]   = useState<Set<string>>(new Set());
  // Default to first 80 nodes; user can expand to full dataset via slider
  const [density,     setDensity]     = useState(Math.min(500, data.nodes.length));
  const [minDegree,   setMinDegree]   = useState(0);
  const [minWeight,   setMinWeight]   = useState(0.5);
  const [communityMode, setCommunityMode] = useState(false);

  // Analytics
  const [showDrawer,  setShowDrawer]  = useState(false);
  const [queried,     setQueried]     = useState<Set<string> | null>(null);

  // Physics
  const [alphaDec,    setAlphaDec]    = useState(0.016);
  const [veloDec,     setVeloDec]     = useState(0.28);
  const [showAdv,     setShowAdv]     = useState(false);

  // UI
  const [search,      setSearch]      = useState('');
  const [searchRes,   setSearchRes]   = useState<any[]>([]);
  const [paused,      setPaused]      = useState(false);
  const [panMode,     setPanMode]     = useState(false);
  const [showCtrl,    setShowCtrl]    = useState(false);
  const [showLegend,  setShowLegend]  = useState(false);

  useEffect(() => {
    setDensity(Math.min(500, data.nodes.length)); setMinDegree(0); setPanMode(false);
    hasZoomed.current = false;
  }, [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDims({ w: el.clientWidth || 800, h: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;
    paused ? fgRef.current.pauseAnimation() : fgRef.current.resumeAnimation();
  }, [paused]);

  const applyPanMode = useCallback((active: boolean) => {
    const controls = fgRef.current?.controls?.();
    if (!controls) return;
    // THREE.MOUSE: ROTATE=0, DOLLY=1, PAN=2
    controls.mouseButtons = { LEFT: active ? 2 : 0, MIDDLE: 1, RIGHT: active ? 0 : 2 };
  }, []);

  useEffect(() => { applyPanMode(panMode); }, [panMode, applyPanMode]);

  // ── Graph data pipeline ─────────────────────────────────────────────────

  // Step 1: base graph (density slice + type transform)
  const baseGraphData = useMemo(() => {
    const maxVal = Math.max(1, ...data.nodes.map(n => n.valor_total));
    const sorted = [...data.nodes].sort((a, b) => b.valor_total - a.valor_total || b.count - a.count);
    const slice  = sorted.slice(0, density);
    const ids    = new Set(slice.map(n => n.id));
    return {
      nodes: slice.map(n => ({
        id:    n.id,
        label: n.label ?? n.id,
        group: n.type,
        val:   n.valor_total > 0
          ? Math.max(1, Math.pow(n.valor_total / maxVal, 0.5) * 8)
          : 0.5,
      })),
      links: data.edges
        .filter(e => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
        .map(e => ({
          source: e.source, target: e.target,
          weight: e.weight > 0 ? Math.max(0.5, Math.min(4, 0.5 + Math.log1p(e.weight) * 0.28)) : 0.5,
        })),
    };
  }, [data, density]);

  // Step 2: metrics on base (for degree-filter threshold)
  const baseMetrics = useMemo(
    () => computeGraphMetrics(baseGraphData.nodes, baseGraphData.links),
    [baseGraphData]
  );

  // Step 3: apply analytical filters
  const graphData = useMemo(() => {
    if (minDegree <= 0 && minWeight <= 0.5) return baseGraphData;
    const keep = baseGraphData.nodes.filter(n =>
      (baseMetrics.byNode[n.id]?.degree ?? 0) >= minDegree
    );
    const ids = new Set(keep.map(n => n.id));
    return {
      nodes: keep,
      links: baseGraphData.links.filter(l =>
        ids.has(l.source as string) && ids.has(l.target as string) && l.weight >= minWeight
      ),
    };
  }, [baseGraphData, baseMetrics, minDegree, minWeight]);

  // Step 4: metrics on visible graph
  const metrics = useMemo(
    () => computeGraphMetrics(graphData.nodes, graphData.links),
    [graphData]
  );

  useEffect(() => { onMetricsReady?.(metrics); }, [metrics, onMetricsReady]);
  // Keep ref in sync so callbacks/effects can read live data without calling fgRef.graphData()
  useEffect(() => { gd.current = graphData; }, [graphData]);

  // Prevent isolated clusters from drifting far from the main group.
  // Adds a gentle centering force (pulls every node toward origin) and caps
  // the repulsion range so distant lone nodes don't keep accelerating away.
  useEffect(() => {
    const t = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      const k = 0.04; // centering strength — small enough not to collapse clusters
      fg.d3Force('attract', (alpha: number) => {
        (gd.current.nodes as any[]).forEach(n => {
          n.vx -= k * (n.x ?? 0) * alpha;
          n.vy -= k * (n.y ?? 0) * alpha;
          if (n.vz !== undefined) n.vz -= k * (n.z ?? 0) * alpha;
        });
      });
      fg.d3Force('charge')?.distanceMax?.(350);
      fg.d3ReheatSimulation?.();
    }, 200);
    return () => clearTimeout(t);
  }, [graphData]);

  // ── Interaction ─────────────────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    setSelectedId(null); setNeighbors(new Set()); setQueried(null); onNodeSelect?.(null);
  }, [onNodeSelect]);

  const zoomToNeighborhood = useCallback((nbrs: Set<string>) => {
    setTimeout(() => {
      const nbrNodes = gd.current.nodes.filter((n: any) => nbrs.has(n.id) && n.x != null);
      if (!nbrNodes.length) return;

      if (nbrs.size <= 4) {
        // Small neighborhood: fixed camera distance from centroid — predictable, no over-zoom
        const cx = nbrNodes.reduce((s: number, n: any) => s + n.x, 0) / nbrNodes.length;
        const cy = nbrNodes.reduce((s: number, n: any) => s + n.y, 0) / nbrNodes.length;
        const cz = nbrNodes.reduce((s: number, n: any) => s + (n.z ?? 0), 0) / nbrNodes.length;
        fgRef.current?.cameraPosition(
          { x: cx, y: cy, z: cz + 280 },
          { x: cx, y: cy, z: cz },
          700,
        );
      } else {
        fgRef.current?.zoomToFit(700, 80, (n: any) => nbrs.has(n.id));
      }
    }, 50);
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    if (!node) { clearSelection(); return; }
    if (selectedId === node.id) { clearSelection(); return; }
    const nbrs = new Set<string>([node.id]);
    gd.current.links.forEach((l: any) => {
      const s = nodeId(l.source), t = nodeId(l.target);
      if (s === node.id) nbrs.add(t);
      if (t === node.id) nbrs.add(s);
    });
    setSelectedId(node.id);
    setNeighbors(nbrs);
    onNodeSelect?.(data.nodes.find(n => n.id === node.id) ?? null);
    zoomToNeighborhood(nbrs);
  }, [selectedId, data.nodes, onNodeSelect, zoomToNeighborhood]);

  // ── Color functions (depend on state → re-evaluate when selection changes) ──

  const nodeColorBase = useCallback((node: any): string => {
    if (communityMode) {
      const comm = metrics.byNode[node.id]?.community ?? 0;
      return COMMUNITY_PALETTE[comm % COMMUNITY_PALETTE.length];
    }
    return GROUP_COLORS[node.group] ?? '#94a3b8';
  }, [communityMode, metrics]);

  const nodeColor = useCallback((node: any): string => {
    if (visGroups.size > 0 && !visGroups.has(node.group)) return 'rgba(0,0,0,0)';
    const base = nodeColorBase(node);
    // External query highlight
    if (queried && queried.size > 0) return queried.has(node.id) ? base : hexAlpha(base, 0.06);
    // Selection highlight
    if (selectedId && !neighbors.has(node.id)) return hexAlpha(base, 0.08);
    return base;
  }, [selectedId, neighbors, visGroups, queried, nodeColorBase]);

  const linkColor = useCallback((link: any): string => {
    const s = nodeId(link.source), t = nodeId(link.target);
    if (queried && queried.size > 0 && (!queried.has(s) || !queried.has(t)))
      return 'rgba(71,85,105,0.04)';
    if (selectedId && (!neighbors.has(s) || !neighbors.has(t)))
      return 'rgba(71,85,105,0.05)';
    const c = GROUP_COLORS[(link.source as any)?.group ?? ''] ?? '#94a3b8';
    return selectedId ? hexAlpha(c, 0.95) : hexAlpha(c, 0.45);
  }, [selectedId, neighbors, queried]);

  const linkWidth = useCallback((link: any): number => {
    const s = nodeId(link.source), t = nodeId(link.target);
    const w = link.weight ?? 1;
    if (selectedId || (queried && queried.size > 0)) {
      const active = selectedId ? neighbors.has(s) && neighbors.has(t)
        : (queried!.has(s) && queried!.has(t));
      return active ? w * 5 : w * 0.4;
    }
    return w * 2;
  }, [selectedId, neighbors, queried]);

  const nodeVisibility = useCallback((node: any) =>
    visGroups.size === 0 || visGroups.has(node.group), [visGroups]);

  const linkVisibility = useCallback((link: any) => {
    if (visGroups.size === 0) return true;
    const sg = (link.source as any)?.group, tg = (link.target as any)?.group;
    return !!(sg && tg && visGroups.has(sg) && visGroups.has(tg));
  }, [visGroups]);

  // SpriteText labels — recreated when communityMode or metrics change
  const nodeThreeObject = useCallback((node: any) => {
    try {
      let color: string;
      if (communityMode) {
        const comm = metrics.byNode[node.id]?.community ?? 0;
        color = COMMUNITY_PALETTE[comm % COMMUNITY_PALETTE.length];
      } else {
        color = GROUP_COLORS[node.group] ?? '#94a3b8';
      }
      const sprite = new SpriteText(node.label ?? node.id);
      sprite.color = color;
      sprite.textHeight = Math.max(2, Math.min(5, Math.cbrt(node.val ?? 1) * 2.0));
      sprite.backgroundColor = 'rgba(4,13,24,0.72)';
      sprite.padding = 1.2;
      sprite.borderRadius = 2;
      // @ts-ignore
      (sprite as any).position.set(0, Math.cbrt(node.val ?? 1) * 3 + 3, 0);
      nodeSprites.current.set(node, sprite);
      return sprite;
    } catch { return undefined; }
  }, [communityMode, metrics]);

  // Dim non-highlighted node sprites imperatively when queried/selected changes
  useEffect(() => {
    const activeSet = queried ?? (selectedId ? neighbors : null);
    for (const n of gd.current.nodes) {
      const sprite = nodeSprites.current.get(n);
      if (!sprite) continue;
      (sprite as any).visible = !activeSet || activeSet.has(n.id);
    }
  }, [queried, selectedId, neighbors]);

  const linkParticleCount = useCallback((link: any): number => {
    if (!selectedId) return 0;
    const s = nodeId(link.source), t = nodeId(link.target);
    return neighbors.has(s) && neighbors.has(t) ? 2 : 0;
  }, [selectedId, neighbors]);

  const linkParticleWidth = useCallback((_link: any): number => 2, []);

  const linkParticleColor = useCallback((link: any): string =>
    GROUP_COLORS[(link.source as any)?.group ?? ''] ?? '#94a3b8',
  []);

  // ── Search ──────────────────────────────────────────────────────────────

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchRes([]); return; }
    const lq = q.toLowerCase();
    // Use useMemo nodes directly — always have correct label, no risk of undefined
    setSearchRes(
      graphData.nodes
        .filter((n) => (n.label ?? '').toLowerCase().includes(lq))
        .slice(0, 8)
    );
  }, [graphData.nodes]);

  const focusNode = useCallback((node: any) => {
    setSearch(''); setSearchRes([]);
    // gd.current.nodes are the same objects force-graph mutated with x/y/z
    const live = gd.current.nodes.find((n: any) => n.id === node.id) ?? node;

    const nbrs = new Set<string>([live.id]);
    for (const l of gd.current.links) {
      const s = nodeId(l.source), t = nodeId(l.target);
      if (s === live.id) nbrs.add(t);
      if (t === live.id) nbrs.add(s);
    }

    setSelectedId(live.id);
    setNeighbors(nbrs);
    setQueried(nbrs);
    onNodeSelect?.(data.nodes.find(n => n.id === live.id) ?? null);
    zoomToNeighborhood(nbrs);
  }, [data.nodes, onNodeSelect, zoomToNeighborhood]);

  // ── Analytics physics commands ──────────────────────────────────────────

  const cmdReorganize = useCallback(() => {
    fgRef.current?.d3Force('charge')?.strength(-250);
    fgRef.current?.d3Force('link')?.distance(60);
    fgRef.current?.d3ReheatSimulation?.();
  }, []);

  const cmdStabilize = useCallback(() => {
    setAlphaDec(0.04); setVeloDec(0.6);
    fgRef.current?.d3ReheatSimulation?.();
  }, []);

  const cmdExpand = useCallback(() => {
    fgRef.current?.d3Force('charge')?.strength(-500);
    fgRef.current?.d3Force('link')?.distance(120);
    fgRef.current?.d3ReheatSimulation?.();
  }, []);

  const cmdCompact = useCallback(() => {
    fgRef.current?.d3Force('charge')?.strength(-80);
    fgRef.current?.d3Force('link')?.distance(25);
    fgRef.current?.d3ReheatSimulation?.();
  }, []);

  const cmdHighlightBridges = useCallback(() => {
    setQueried(q => {
      const isSame = q && metrics.bridges.every(id => q.has(id)) && q.size === metrics.bridges.length;
      return isSame ? null : new Set(metrics.bridges);
    });
  }, [metrics.bridges]);

  const toggleGroup = useCallback((g: string) => {
    setVisGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  }, []);

  const exportPng = useCallback(() => {
    const cv = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!cv) return;
    const a = document.createElement('a'); a.href = cv.toDataURL('image/png');
    a.download = 'rede-piesp-3d.png'; a.click();
  }, []);

  const drawerNodes = useMemo(
    () => graphData.nodes.map(n => ({ id: n.id, label: n.label, group: n.group })),
    [graphData.nodes]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const drawerW = showDrawer ? 288 : 0;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#040d18]">
      <style>{`
        .fg3d-wrap > div { position: absolute; inset: 0; }
        .fg3d-wrap > div > .scene-container { width: 100% !important; height: 100% !important; }
      `}</style>

      {/* Analytics drawer — left panel, absolute */}
      {showDrawer && (
        <div className="absolute left-0 top-0 bottom-0 w-72 z-20 overflow-hidden">
          <AnalyticsDrawer
            metrics={metrics}
            nodes={drawerNodes}
            onHighlight={setQueried}
            onClose={() => { setShowDrawer(false); setQueried(null); }}
          />
        </div>
      )}

      {/* Graph — offset right when drawer open */}
      <div className="fg3d-wrap absolute top-0 bottom-0 right-0"
        style={{ left: `${drawerW}px` }}>
        <ForceGraph3D
          ref={fgRef}
          width={Math.max(100, dims.w - drawerW)}
          height={dims.h}
          graphData={graphData}
          backgroundColor="#040d18"
          showNavInfo={false}
          nodeColor={nodeColor}
          nodeVal="val"
          nodeRelSize={3}
          nodeOpacity={0.92}
          nodeResolution={16}
          nodeVisibility={nodeVisibility}
          nodeLabel=""
          nodeThreeObjectExtend={true}
          nodeThreeObject={nodeThreeObject}
          onNodeClick={handleNodeClick}
          onBackgroundClick={clearSelection}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={0.75}
          linkVisibility={linkVisibility}
          linkDirectionalParticles={linkParticleCount}
          linkDirectionalParticleWidth={linkParticleWidth}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleColor={linkParticleColor}
          d3AlphaDecay={alphaDec}
          d3VelocityDecay={veloDec}
          onEngineStop={() => {
            applyPanMode(panMode);
            if (!hasZoomed.current) {
              fgRef.current?.zoomToFit(600, 80);
              hasZoomed.current = true;
            }
          }}
        />
      </div>

      {/* ── Top-left stats */}
      <div className="absolute top-3 flex flex-wrap gap-2 pointer-events-none z-10"
        style={{ left: `${drawerW + 12}px` }}>
        <span className="text-[10px] bg-slate-900/80 border border-slate-700/30 px-2 py-1 rounded-full text-slate-400">
          {data.meta.total_projetos} projetos
        </span>
        {data.meta.total_valor_milhoes > 0 && (
          <span className="text-[10px] bg-slate-900/80 border border-rose-700/30 px-2 py-1 rounded-full text-rose-400">
            {data.meta.total_valor_milhoes >= 1000
              ? `R$ ${(data.meta.total_valor_milhoes / 1000).toFixed(1).replace('.', ',')} bi`
              : `R$ ${data.meta.total_valor_milhoes.toFixed(0)} mi`}
          </span>
        )}
        {data.meta.total_nos_disponiveis > graphData.nodes.length && (
          <span className="text-[10px] bg-amber-900/40 border border-amber-700/40 px-2 py-1 rounded-full text-amber-400/80">
            {graphData.nodes.length} de {data.meta.total_nos_disponiveis} nós
          </span>
        )}
        {queried && queried.size > 0 && (
          <button onClick={() => setQueried(null)}
            className="text-[10px] bg-rose-900/40 border border-rose-700/40 px-2 py-1 rounded-full text-rose-400/80 hover:text-rose-300 transition-colors">
            {queried.size} nós destacados ✕
          </button>
        )}
      </div>

      {/* ── Bottom-left legend (collapsible) */}
      <div className="absolute bottom-10 z-10 flex flex-col items-start gap-1"
        style={{ left: `${drawerW + 12}px` }}>

        {/* Expanded panel — appears above the toggle button */}
        {showLegend && (
          <div className="bg-slate-900/95 border border-slate-700/40 rounded-xl p-2 shadow-xl
            flex flex-col gap-1 max-h-52 overflow-y-auto w-52 backdrop-blur-sm">
            {communityMode ? (
              Object.entries(metrics.communityNames)
                .sort(([a], [b]) => +a - +b)
                .map(([cStr, name]) => {
                  const c = +cStr;
                  const color = COMMUNITY_PALETTE[c % COMMUNITY_PALETTE.length];
                  const size  = metrics.communitySize[c] ?? 0;
                  return (
                    <div key={c} className="flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="truncate flex-1" title={name}>{name}</span>
                      <span className="text-slate-600 text-[9px] flex-shrink-0">({size})</span>
                    </div>
                  );
                })
            ) : (
              <>
                {Object.keys(GROUP_COLORS).map(g => {
                  const active = visGroups.has(g);
                  return (
                    <button key={g} onClick={() => toggleGroup(g)}
                      className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded transition-all text-left ${
                        active ? 'bg-slate-700/80 text-white'
                        : visGroups.size > 0 ? 'text-slate-600 hover:text-slate-400'
                        : 'text-slate-400 hover:text-white'
                      }`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: active || visGroups.size === 0 ? GROUP_COLORS[g] : '#334155' }} />
                      {GROUP_LABELS[g]}
                    </button>
                  );
                })}
                {visGroups.size > 0 && (
                  <button onClick={() => setVisGroups(new Set())}
                    className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors px-1.5 py-0.5 text-left mt-0.5 border-t border-slate-700/30 pt-1">
                    ✕ Limpar filtro
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Toggle button */}
        <button onClick={() => setShowLegend(v => !v)}
          className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-all ${
            showLegend
              ? 'bg-slate-700/80 border-slate-500/50 text-slate-300'
              : 'bg-slate-900/80 border-slate-700/30 text-slate-500 hover:text-slate-300'
          }`}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: communityMode ? COMMUNITY_PALETTE[0] : GROUP_COLORS.investidora }} />
          Legenda {showLegend ? '▾' : '▸'}
          {!communityMode && visGroups.size > 0 && (
            <span className="text-rose-400 text-[9px]">({visGroups.size})</span>
          )}
        </button>
      </div>

      <div className="absolute bottom-3 text-[10px] text-slate-700 pointer-events-none select-none z-10"
        style={{ left: `${drawerW + 12}px` }}>
        {panMode
          ? 'Drag = mover · Scroll = zoom · Click = detalhe'
          : 'Drag = rotar · Scroll = zoom · Click = detalhe · ↕↔ = mover'}
      </div>

      {/* ── Top-right controls */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-20">

        {/* Search */}
        <div className="relative">
          <input value={search} onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && searchRes.length > 0) focusNode(searchRes[0]); }}
            placeholder="Buscar nó…"
            className="w-52 bg-slate-900/90 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500/70"
          />
          {searchRes.length > 0 && (
            <div className="absolute top-full mt-1 right-0 w-64 max-h-52 overflow-y-auto bg-slate-900 border border-slate-700/50 rounded-lg shadow-xl z-30">
              {searchRes.map((n: any) => (
                <button key={n.id} onClick={() => focusNode(n)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/80 text-left transition-colors group">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: GROUP_COLORS[n.group] ?? '#94a3b8' }} />
                  <span className="text-[11px] text-slate-300 group-hover:text-white truncate flex-1">{n.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex gap-2">
          <button onClick={() => { setShowDrawer(v => !v); if (!showDrawer) setQueried(null); }}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              showDrawer ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              : 'bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-rose-300'}`}>
            ◎ Analisar
          </button>
          <button onClick={() => setPanMode(v => !v)}
            title={panMode ? 'Modo mover ativo — clique para voltar a rotar' : 'Mover grafo (pan)'}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              panMode ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
              : 'bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-white'}`}>
            ↕↔
          </button>
          <button onClick={() => setPaused(p => !p)}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              paused ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-white'}`}>
            {paused ? '▶' : '⏸'}
          </button>
          <button onClick={() => fgRef.current?.zoomToFit(600, 100)}
            className="text-[10px] px-3 py-1.5 rounded-lg border bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-white transition-all">⊞</button>
          <button onClick={() => setShowCtrl(v => !v)}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              showCtrl ? 'bg-slate-700/80 border-slate-500/50 text-white'
              : 'bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-white'}`}>⚙</button>
          <button onClick={exportPng}
            className="text-[10px] px-3 py-1.5 rounded-lg border bg-slate-900/80 border-slate-700/30 text-slate-400 hover:text-white transition-all">↓</button>
        </div>

        {/* Control panel */}
        {showCtrl && (
          <div className="bg-slate-900/97 border border-slate-700/40 rounded-xl p-4 w-64 shadow-xl flex flex-col gap-4 backdrop-blur-sm">

            {/* Filtros de rede */}
            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Filtros de rede</p>
              <Slider label="Conexões mínimas"
                value={minDegree} min={0} max={Math.max(1, baseMetrics.maxDegree)}
                fmt={v => v === 0 ? 'todos' : `≥ ${v}`}
                onChange={setMinDegree} />
              <Slider label="Força mínima da aresta"
                value={minWeight} min={0.5} max={4} step={0.5}
                fmt={v => v <= 0.5 ? 'todas' : `≥ ${v.toFixed(1)}`}
                onChange={setMinWeight} />
              {data.nodes.length > 20 && (
                <Slider label="Nós visíveis" value={density}
                  min={Math.min(10, data.nodes.length)} max={data.nodes.length}
                  fmt={v => `${v}`} onChange={setDensity} />
              )}
            </div>

            {/* Visualização */}
            <div className="border-t border-slate-700/40 pt-3 flex flex-col gap-2">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Visualização</p>
              <div className="flex gap-1">
                <button onClick={() => setCommunityMode(false)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-all ${
                    !communityMode ? 'bg-slate-700/80 border-slate-500/50 text-white' : 'bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-slate-300'}`}>
                  Por tipo
                </button>
                <button onClick={() => setCommunityMode(true)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-all ${
                    communityMode ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-slate-300'}`}>
                  Por comunidade
                </button>
              </div>
              <button onClick={cmdHighlightBridges}
                className={`py-1.5 rounded-lg text-[10px] border transition-all ${
                  queried && metrics.bridges.length && metrics.bridges.every(id => queried.has(id))
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-slate-300'}`}>
                {queried && metrics.bridges.length && metrics.bridges.every(id => queried?.has(id))
                  ? '✕ Desativar nós ponte' : '⟐ Destacar nós ponte'}
              </button>
            </div>

            {/* Layout / comandos */}
            <div className="border-t border-slate-700/40 pt-3 flex flex-col gap-2">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Layout</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Reorganizar', fn: cmdReorganize },
                  { label: 'Estabilizar', fn: cmdStabilize },
                  { label: '+ Espaçado',  fn: cmdExpand    },
                  { label: '− Compacto',  fn: cmdCompact   },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="py-1.5 rounded-lg text-[10px] bg-slate-800/60 border border-slate-700/30 text-slate-400 hover:text-white hover:border-slate-500/50 transition-all">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Avançado */}
            <div className="border-t border-slate-700/40 pt-2">
              <button onClick={() => setShowAdv(v => !v)}
                className="w-full text-left text-[9px] text-slate-600 uppercase tracking-wider hover:text-slate-400 transition-colors py-1">
                Avançado {showAdv ? '▲' : '▾'}
              </button>
              {showAdv && (
                <div className="mt-2 flex flex-col gap-3">
                  <Slider label="Resfriamento" value={alphaDec}
                    min={0.005} max={0.05} step={0.005}
                    fmt={v => v.toFixed(3)} onChange={setAlphaDec} />
                  <Slider label="Atrito" value={veloDec}
                    min={0.05} max={0.95} step={0.05}
                    fmt={v => v.toFixed(2)} onChange={setVeloDec} />
                  <div className="flex gap-2">
                    <button onClick={() => { setAlphaDec(0.016); setVeloDec(0.28); }}
                      className="flex-1 py-1.5 rounded-lg text-[10px] bg-slate-800/60 border border-slate-600/30 text-slate-400 hover:text-white transition-colors">
                      ↺ Padrão
                    </button>
                    <button onClick={() => fgRef.current?.d3ReheatSimulation?.()}
                      className="flex-1 py-1.5 rounded-lg text-[10px] bg-slate-800/60 border border-slate-600/30 text-slate-400 hover:text-white transition-colors">
                      ♨ Reaquece
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default GraphCanvas;
