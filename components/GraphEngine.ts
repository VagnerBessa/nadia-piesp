// GraphEngine.ts
// Force Atlas 2 physics + InfraNodus-style Canvas renderer.
// Zero external dependencies. Typed Arrays throughout.

export interface EngineNode {
  id: string;
  label: string;
  group: string;   // investidora / empresa_alvo / municipio / setor
  value: number;   // valor_total R$ mi
  pinned?: boolean;
}

export interface EngineLink {
  sourceId: string;
  targetId: string;
  weight: number;  // 1..5 normalised
}

export interface PhysicsParams {
  gravity: number;      // 0.01..0.3
  repulsion: number;    // 1000..150000
  friction: number;     // 0.70..0.99
  linkDistance: number; // 60..600
}

export const DEFAULT_PARAMS: PhysicsParams = {
  gravity: 0.05,
  repulsion: 8000,
  friction: 0.88,
  linkDistance: 120,
};

// Kept for GraphCanvas filter legend
export const GROUP_COLORS: Record<string, string> = {
  investidora:  '#f43f5e',
  empresa_alvo: '#38bdf8',
  municipio:    '#34d399',
  setor:        '#a78bfa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g)!;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ─── GraphEngine ──────────────────────────────────────────────────────────────

export class GraphEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private nodes: EngineNode[] = [];
  private links: EngineLink[] = [];

  // Simulation
  private x!:   Float32Array;
  private y!:   Float32Array;
  private vx!:  Float32Array;
  private vy!:  Float32Array;
  private rad!: Float32Array;
  private deg!: Int32Array;   // node degree (for hub repulsion)

  // Links
  private lSrc!: Int32Array;
  private lTgt!: Int32Array;
  private lStr!: Float32Array;

  // State
  private alpha      = 1.0;
  private alphaDecay = 0.020;
  private alphaMin   = 0.001;
  params: PhysicsParams;
  private running    = false;
  private rafId: number | null = null;

  // Camera
  private ox = 0;
  private oy = 0;
  private sc = 1;

  // Interaction
  private hovIdx:   number | null = null;
  selIdx:           number | null = null;
  private dragIdx:  number | null = null;
  private dragOffX  = 0;
  private dragOffY  = 0;
  private isPanning = false;
  private panSX = 0; private panSY = 0;
  private panOX = 0; private panOY = 0;

  private visibleGroups: Set<string> = new Set();

  onNodeClick?:  (node: EngineNode | null) => void;
  onNodeHover?:  (node: EngineNode | null) => void;
  onAlphaChange?: (alpha: number) => void;

  private ro: ResizeObserver;
  private _handlers!: Record<string, EventListener>;

  constructor(canvas: HTMLCanvasElement, params: PhysicsParams = DEFAULT_PARAMS) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.params = { ...params };
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.onResize();
    this.bindEvents();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  load(nodes: EngineNode[], links: EngineLink[]): void {
    this.nodes = nodes;
    this.links = links;
    this.alpha = 1;
    this.hovIdx = null;
    this.selIdx = null;
    this.dragIdx = null;

    const n = nodes.length;
    this.x   = new Float32Array(n);
    this.y   = new Float32Array(n);
    this.vx  = new Float32Array(n);
    this.vy  = new Float32Array(n);
    this.rad = new Float32Array(n);
    this.deg = new Int32Array(n);

    // Grid initialisation — avoids explosive scatter in tick 1
    const cx      = this.canvas.width  > 0 ? this.canvas.width  / 2 : 700;
    const cy      = this.canvas.height > 0 ? this.canvas.height / 2 : 450;
    const cols    = Math.ceil(Math.sqrt(n * 1.6));
    const spacing = 130;
    const offX    = cx - (cols - 1) * spacing / 2;
    const offY    = cy - (Math.ceil(n / cols) - 1) * spacing / 2;
    for (let i = 0; i < n; i++) {
      this.x[i] = offX + (i % cols) * spacing + (Math.random() - 0.5) * 55;
      this.y[i] = offY + Math.floor(i / cols) * spacing + (Math.random() - 0.5) * 55;
    }

    // Radii — power-scale on value + degree (computed after link resolution)
    const maxVal = Math.max(1, ...nodes.map(nd => nd.value));
    for (let i = 0; i < n; i++) {
      const norm = nodes[i].value > 0 ? Math.pow(nodes[i].value / maxVal, 0.35) : 0;
      this.rad[i] = 10 + norm * 34;  // 10..44 px — refined by degree below
    }

    // Resolve link indices
    const idx = new Map<string, number>(nodes.map((nd, i) => [nd.id, i]));
    const valid = links.filter(l => idx.has(l.sourceId) && idx.has(l.targetId));

    this.lSrc = new Int32Array(valid.length);
    this.lTgt = new Int32Array(valid.length);
    this.lStr = new Float32Array(valid.length);

    for (let k = 0; k < valid.length; k++) {
      const s = idx.get(valid[k].sourceId)!;
      const t = idx.get(valid[k].targetId)!;
      this.lSrc[k] = s;
      this.lTgt[k] = t;
      this.deg[s]++;
      this.deg[t]++;
    }

    // Refine radii to include degree (betweenness proxy)
    const maxDeg = Math.max(1, ...Array.from(this.deg));
    for (let i = 0; i < n; i++) {
      const dNorm = Math.pow(this.deg[i] / maxDeg, 0.4);
      this.rad[i] = Math.max(8, this.rad[i] * (0.65 + dNorm * 0.55));
    }

    // Spring strength = 1/min(degree) · weight · scale
    for (let k = 0; k < valid.length; k++) {
      const s = this.lSrc[k]; const t = this.lTgt[k];
      const minDeg = Math.max(1, Math.min(this.deg[s], this.deg[t]));
      this.lStr[k] = (1 / minDeg) * valid[k].weight * 0.38;
    }

    if (this.canvas.width > 0) this.fitToView();
    this.start();
  }

  setParams(p: Partial<PhysicsParams>): void {
    Object.assign(this.params, p);
    if (this.alpha < 0.25) this.reheat(0.35);
  }

  setVisibleGroups(groups: Set<string>): void {
    this.visibleGroups = groups;
    if (this.alpha < this.alphaMin) this.draw();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  reheat(a = 1): void { this.alpha = a; this.start(); }

  resetLayout(): void {
    const n  = this.nodes.length;
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    const r0 = Math.min(cx, cy) * 0.65;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      this.x[i]  = cx + r0 * Math.cos(a);
      this.y[i]  = cy + r0 * Math.sin(a);
      this.vx[i] = 0;
      this.vy[i] = 0;
    }
    this.reheat(1);
  }

  focusNode(id: string): void {
    const i = this.nodes.findIndex(n => n.id === id);
    if (i < 0) return;
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    this.ox = cx - this.x[i] * this.sc;
    this.oy = cy - this.y[i] * this.sc;
    this.selIdx = i;
    this.onNodeClick?.(this.nodes[i]);
    if (this.alpha < this.alphaMin) this.draw();
  }

  searchNodes(q: string): EngineNode[] {
    const lq = q.toLowerCase();
    return this.nodes.filter(n => n.label.toLowerCase().includes(lq));
  }

  exportImage(): string { return this.canvas.toDataURL('image/png'); }

  serializeLayout(): Array<{ id: string; x: number; y: number }> {
    return this.nodes.map((n, i) => ({ id: n.id, x: Math.round(this.x[i]), y: Math.round(this.y[i]) }));
  }

  getAlpha(): number   { return this.alpha; }
  isRunning(): boolean { return this.running; }

  destroy(): void {
    this.stop();
    this.ro.disconnect();
    this.unbindEvents();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Physics — Force Atlas 2 (hub-aware repulsion + linlog attraction)
  // ═══════════════════════════════════════════════════════════════════════════

  private tick(): void {
    const n = this.nodes.length;
    if (n === 0) return;

    const { gravity, repulsion, friction, linkDistance } = this.params;
    const a  = this.alpha;
    const cx = this.canvas.width  > 0 ? this.canvas.width  / 2 : 600;
    const cy = this.canvas.height > 0 ? this.canvas.height / 2 : 400;

    // 1. Gravity toward center (stronger for nodes far away)
    for (let i = 0; i < n; i++) {
      if (this.nodes[i].pinned) continue;
      this.vx[i] += (cx - this.x[i]) * gravity * a * 0.012;
      this.vy[i] += (cy - this.y[i]) * gravity * a * 0.012;
    }

    // 2. Hub-aware charge repulsion (Force Atlas 2 style)
    // More connected nodes push harder — creates natural cluster separation.
    const maxD  = Math.sqrt(repulsion) * 5;
    const maxD2 = maxD * maxD;
    for (let i = 0; i < n; i++) {
      const hi = 1 + this.deg[i] * 0.12;  // hub factor
      for (let j = i + 1; j < n; j++) {
        const dx = this.x[i] - this.x[j];
        const dy = this.y[i] - this.y[j];
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 > maxD2) continue;
        const d  = Math.sqrt(d2);
        const hj = 1 + this.deg[j] * 0.12;
        const f  = (repulsion * a * hi * hj) / (d2 * (1 + Math.log1p(d * 0.006)));
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!this.nodes[i].pinned) { this.vx[i] += fx; this.vy[i] += fy; }
        if (!this.nodes[j].pinned) { this.vx[j] -= fx; this.vy[j] -= fy; }
      }
    }

    // 3. Link spring forces (linlog: log of distance for smoother attraction)
    for (let k = 0; k < this.lSrc.length; k++) {
      const i = this.lSrc[k]; const j = this.lTgt[k];
      const dx = this.x[j] - this.x[i];
      const dy = this.y[j] - this.y[i];
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal   = linkDistance + this.rad[i] + this.rad[j];
      const stretch = (d - ideal) / d;
      const s       = this.lStr[k] * a * 0.9;
      const fx = dx * stretch * s;
      const fy = dy * stretch * s;
      if (!this.nodes[i].pinned) { this.vx[i] += fx; this.vy[i] += fy; }
      if (!this.nodes[j].pinned) { this.vx[j] -= fx; this.vy[j] -= fy; }
    }

    // 4. Collision avoidance
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const minD = this.rad[i] + this.rad[j] + 5;
        const dx = this.x[i] - this.x[j];
        const dy = this.y[i] - this.y[j];
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minD * minD) {
          const d  = Math.sqrt(d2);
          const ov = (minD - d) / d * 0.5;
          if (!this.nodes[i].pinned) { this.x[i] += dx * ov; this.y[i] += dy * ov; }
          if (!this.nodes[j].pinned) { this.x[j] -= dx * ov; this.y[j] -= dy * ov; }
        }
      }
    }

    // 5. Integrate
    const MAX_V = 22;
    for (let i = 0; i < n; i++) {
      if (this.nodes[i].pinned) continue;
      this.vx[i] *= friction;
      this.vy[i] *= friction;
      if (this.vx[i] >  MAX_V) this.vx[i] =  MAX_V;
      if (this.vx[i] < -MAX_V) this.vx[i] = -MAX_V;
      if (this.vy[i] >  MAX_V) this.vy[i] =  MAX_V;
      if (this.vy[i] < -MAX_V) this.vy[i] = -MAX_V;
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
    }

    this.alpha = Math.max(0, this.alpha - this.alphaDecay * this.alpha);
    this.onAlphaChange?.(this.alpha);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Canvas Rendering — InfraNodus aesthetic
  // ═══════════════════════════════════════════════════════════════════════════

  private draw(): void {
    const { canvas: cv, ctx } = this;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#040d18';
    ctx.fillRect(0, 0, cv.width, cv.height);

    if (this.nodes.length === 0) return;

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.sc, this.sc);

    const hasSel    = this.selIdx !== null;
    const hasVis    = this.visibleGroups.size > 0;
    const neighbors = hasSel ? this.getNeighbors(this.selIdx!) : null;

    // ── Edges ──────────────────────────────────────────────────────────────
    for (let k = 0; k < this.lSrc.length; k++) {
      const i = this.lSrc[k]; const j = this.lTgt[k];
      const visSrc = !hasVis || this.visibleGroups.has(this.nodes[i].group);
      const visTgt = !hasVis || this.visibleGroups.has(this.nodes[j].group);
      if (!visSrc && !visTgt) continue;

      const dimmed = hasSel
        ? (!neighbors!.has(i) || !neighbors!.has(j))
        : hasVis && (!visSrc || !visTgt);
      const hi = hasSel && neighbors!.has(i) && neighbors!.has(j);

      // Quadratic curve
      const mx = (this.x[i] + this.x[j]) / 2;
      const my = (this.y[i] + this.y[j]) / 2;
      const px = -(this.y[j] - this.y[i]) * 0.08;
      const py =  (this.x[j] - this.x[i]) * 0.08;

      // Color edge by source node group
      const srcColor = GROUP_COLORS[this.nodes[i].group] ?? '#94a3b8';
      const [r, g, b] = hexToRgb(srcColor);

      ctx.beginPath();
      ctx.moveTo(this.x[i], this.y[i]);
      ctx.quadraticCurveTo(mx + px, my + py, this.x[j], this.y[j]);

      if (dimmed) {
        ctx.lineWidth  = 0.8;
        ctx.strokeStyle = 'rgba(71,85,105,0.08)';
      } else if (hi) {
        ctx.lineWidth  = Math.max(2, this.lStr[k] * 6);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.90)`;
        ctx.shadowColor = srcColor;
        ctx.shadowBlur  = 6;
      } else {
        ctx.lineWidth  = Math.max(1.2, this.lStr[k] * 4);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.30)`;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur  = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── Nodes ──────────────────────────────────────────────────────────────
    for (let i = 0; i < this.nodes.length; i++) {
      const nd    = this.nodes[i];
      const color = GROUP_COLORS[nd.group] ?? '#94a3b8';
      const vis   = !hasVis || this.visibleGroups.has(nd.group);
      const dimmed = hasSel ? !neighbors!.has(i) : (hasVis && !vis);
      const isHov  = this.hovIdx === i;
      const isSel  = this.selIdx === i;
      const r      = this.rad[i];
      const [cr, cg, cb] = hexToRgb(color);

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.06 : 1;

      // Outer glow
      if (!dimmed) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = isSel ? 40 : isHov ? 26 : 16;
      }

      // Filled circle — radial gradient for 3D sphere effect
      const grad = ctx.createRadialGradient(
        this.x[i] - r * 0.32, this.y[i] - r * 0.32, r * 0.04,
        this.x[i],             this.y[i],             r,
      );
      grad.addColorStop(0,   `rgba(255,255,255,0.55)`);
      grad.addColorStop(0.3, color);
      grad.addColorStop(1,   `rgba(${Math.round(cr*0.35)},${Math.round(cg*0.35)},${Math.round(cb*0.35)},1)`);

      ctx.beginPath();
      ctx.arc(this.x[i], this.y[i], r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Selection / hover ring
      if (isSel || isHov) {
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = isSel ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth   = isSel ? 2.5 : 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // ── Label ──────────────────────────────────────────────────────────
      const showLabel = (this.sc > 0.28 || r > 20) && !dimmed;
      if (showLabel) {
        // Scale font slightly with node size
        const fs = r > 26 ? 12 : r > 18 ? 11 : 10;
        ctx.save();
        ctx.font          = `500 ${fs}px Inter, system-ui, sans-serif`;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'top';
        const ly   = this.y[i] + r + 4;
        const text = truncate(ctx, nd.label, 160);
        const tw   = ctx.measureText(text).width;
        const pad  = 3;

        // Subtle pill
        ctx.fillStyle = 'rgba(4,13,24,0.72)';
        ctx.beginPath();
        const pr = 3;
        const px2 = this.x[i] - tw / 2 - pad;
        const py2 = ly - 1;
        const pw  = tw + pad * 2;
        const ph  = fs + 4;
        ctx.moveTo(px2 + pr, py2);
        ctx.lineTo(px2 + pw - pr, py2);
        ctx.quadraticCurveTo(px2 + pw, py2, px2 + pw, py2 + pr);
        ctx.lineTo(px2 + pw, py2 + ph - pr);
        ctx.quadraticCurveTo(px2 + pw, py2 + ph, px2 + pw - pr, py2 + ph);
        ctx.lineTo(px2 + pr, py2 + ph);
        ctx.quadraticCurveTo(px2, py2 + ph, px2, py2 + ph - pr);
        ctx.lineTo(px2, py2 + pr);
        ctx.quadraticCurveTo(px2, py2, px2 + pr, py2);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = isSel
          ? '#ffffff'
          : r > 20
            ? `rgba(${cr},${cg},${cb},0.95)`
            : '#cbd5e1';
        ctx.fillText(text, this.x[i], ly);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Camera
  // ═══════════════════════════════════════════════════════════════════════════

  private fitToView(): void {
    const n = this.nodes.length;
    if (n === 0 || this.canvas.width === 0) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, this.x[i] - this.rad[i]);
      x1 = Math.max(x1, this.x[i] + this.rad[i]);
      y0 = Math.min(y0, this.y[i] - this.rad[i]);
      y1 = Math.max(y1, this.y[i] + this.rad[i]);
    }
    const pad = 80;
    const sc  = Math.min(
      this.canvas.width  / (x1 - x0 + pad * 2),
      this.canvas.height / (y1 - y0 + pad * 2),
      1.4,
    );
    this.sc = sc;
    this.ox = (this.canvas.width  - (x0 + x1) * sc) / 2;
    this.oy = (this.canvas.height - (y0 + y1) * sc) / 2;
  }

  private screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.ox) / this.sc, (sy - this.oy) / this.sc];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Hit detection
  // ═══════════════════════════════════════════════════════════════════════════

  private hitTest(sx: number, sy: number): number | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    let best: number | null = null; let bestD2 = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const dx = wx - this.x[i]; const dy = wy - this.y[i];
      const d2 = dx * dx + dy * dy;
      const rr = this.rad[i] + 8;
      if (d2 < rr * rr && d2 < bestD2) { bestD2 = d2; best = i; }
    }
    return best;
  }

  private getNeighbors(idx: number): Set<number> {
    const s = new Set<number>([idx]);
    for (let k = 0; k < this.lSrc.length; k++) {
      if (this.lSrc[k] === idx) s.add(this.lTgt[k]);
      if (this.lTgt[k] === idx) s.add(this.lSrc[k]);
    }
    return s;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event binding
  // ═══════════════════════════════════════════════════════════════════════════

  private getXY(e: MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private bindEvents(): void {
    const mm = (e: MouseEvent) => {
      const [sx, sy] = this.getXY(e);
      if (this.dragIdx !== null) {
        const [wx, wy] = this.screenToWorld(sx + this.dragOffX, sy + this.dragOffY);
        this.x[this.dragIdx] = wx; this.y[this.dragIdx] = wy;
        this.vx[this.dragIdx] = 0; this.vy[this.dragIdx] = 0;
        if (this.alpha < 0.2) this.reheat(0.25);
        return;
      }
      if (this.isPanning) {
        this.ox = this.panOX + sx - this.panSX;
        this.oy = this.panOY + sy - this.panSY;
        if (this.alpha < this.alphaMin) this.draw();
        return;
      }
      const prev = this.hovIdx;
      this.hovIdx = this.hitTest(sx, sy);
      this.canvas.style.cursor = this.hovIdx !== null ? 'pointer' : 'grab';
      if (this.hovIdx !== prev) {
        this.onNodeHover?.(this.hovIdx !== null ? this.nodes[this.hovIdx] : null);
        if (this.alpha < this.alphaMin) this.draw();
      }
    };
    const md = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const [sx, sy] = this.getXY(e);
      const hit = this.hitTest(sx, sy);
      if (hit !== null) {
        this.dragIdx  = hit;
        this.dragOffX = (this.x[hit] * this.sc + this.ox) - sx;
        this.dragOffY = (this.y[hit] * this.sc + this.oy) - sy;
        this.canvas.style.cursor = 'grabbing';
      } else {
        this.isPanning = true;
        this.panSX = sx; this.panSY = sy;
        this.panOX = this.ox; this.panOY = this.oy;
        this.canvas.style.cursor = 'grabbing';
      }
    };
    const mu = () => {
      this.dragIdx   = null;
      this.isPanning = false;
      this.canvas.style.cursor = this.hovIdx !== null ? 'pointer' : 'grab';
    };
    const cl = (e: MouseEvent) => {
      const [sx, sy] = this.getXY(e);
      const hit  = this.hitTest(sx, sy);
      const prev = this.selIdx;
      this.selIdx = hit !== null && hit !== prev ? hit : null;
      this.onNodeClick?.(this.selIdx !== null ? this.nodes[this.selIdx] : null);
      if (this.alpha < this.alphaMin) this.draw();
    };
    const wh = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = this.getXY(e);
      const f  = e.deltaY < 0 ? 1.13 : 0.88;
      const ns = Math.max(0.06, Math.min(12, this.sc * f));
      this.ox  = sx - (sx - this.ox) * (ns / this.sc);
      this.oy  = sy - (sy - this.oy) * (ns / this.sc);
      this.sc  = ns;
      if (this.alpha < this.alphaMin) this.draw();
    };
    this.canvas.addEventListener('mousemove', mm);
    this.canvas.addEventListener('mousedown', md);
    this.canvas.addEventListener('mouseup',   mu);
    this.canvas.addEventListener('click',     cl);
    this.canvas.addEventListener('wheel',     wh, { passive: false });
    this._handlers = { mm, md, mu, cl, wh } as any;
  }

  private unbindEvents(): void {
    const h = this._handlers;
    this.canvas.removeEventListener('mousemove', h.mm as EventListener);
    this.canvas.removeEventListener('mousedown', h.md as EventListener);
    this.canvas.removeEventListener('mouseup',   h.mu as EventListener);
    this.canvas.removeEventListener('click',     h.cl as EventListener);
    this.canvas.removeEventListener('wheel',     h.wh as EventListener);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main loop + resize
  // ═══════════════════════════════════════════════════════════════════════════

  private loop(): void {
    if (!this.running) return;
    if (this.alpha > this.alphaMin) this.tick();
    this.draw();
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private onResize(): void {
    const p = this.canvas.parentElement;
    if (!p || p.clientWidth === 0) return;
    this.canvas.width  = p.clientWidth;
    this.canvas.height = p.clientHeight;
    if (this.nodes.length > 0) this.fitToView();
    this.draw();
  }
}
