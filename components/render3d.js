// Oblique-projection cube renderer for the Tron well. Each cell is drawn as a
// cube: front face, plus top/right faces when no neighbour hides them.

export const ACCENTS = ['#22D3EE', '#A78BFA', '#4ADE80'];
export const ORANGE = '#FF9F1C';

export const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[1, 1, 1], [0, 1, 0]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

// Each piece doubles as a commit type (from the design canvas).
export const COMMIT_TYPES = { I: 'release', O: 'chore', T: 'feat', S: 'fix', Z: 'refactor', J: 'docs', L: 'test' };

export function rgba(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export function styleFor(kind, accent) {
  switch (kind) {
    case 'active':
      return { front: 'rgba(255,159,28,0.28)', top: 'rgba(255,190,90,0.55)', right: 'rgba(255,140,10,0.18)', stroke: '#FFB454', w: 1.6, glow: ORANGE, blur: 12, inset: 'rgba(255,220,170,0.7)' };
    case 'ghost':
      return { front: rgba(accent, 0.03), top: null, right: null, stroke: rgba(accent, 0.55), w: 1, dash: [4, 3] };
    case 'clear':
      return { front: 'rgba(255,255,255,0.75)', top: 'rgba(255,255,255,0.9)', right: 'rgba(255,255,255,0.5)', stroke: '#FFFFFF', w: 1.6, glow: '#FFFFFF', blur: 14 };
    case 'dim':
      return { front: rgba(accent, 0.06), top: rgba(accent, 0.14), right: rgba(accent, 0.03), stroke: rgba(accent, 0.5), w: 1 };
    case 'dead':
      return { front: 'rgba(148,163,184,0.06)', top: 'rgba(148,163,184,0.16)', right: 'rgba(148,163,184,0.03)', stroke: 'rgba(148,163,184,0.45)', w: 1 };
    case 'hit':
      return { front: 'rgba(248,113,113,0.30)', top: 'rgba(252,165,165,0.55)', right: 'rgba(248,113,113,0.18)', stroke: '#FCA5A5', w: 1.6, glow: '#F87171', blur: 10 };
    default:
      return { front: rgba(accent, 0.12), top: rgba(accent, 0.3), right: rgba(accent, 0.06), stroke: accent, w: 1.2, glow: accent, blur: 6, inset: rgba(accent, 0.35) };
  }
}

function poly(ctx, pts, fill, st) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
}

/**
 * cells: array of [col, row] with row 0 at the TOP of the area.
 * geo: { s, dx, dy, ox, top } – front face of (c,r) is at (ox + c*s, top + r*s).
 */
export function drawCubes(ctx, cells, kind, accent, geo) {
  if (!cells.length) return;
  const st = styleFor(kind, accent);
  const { s, dx, dy, ox, top } = geo;
  const set = new Set(cells.map(([c, r]) => c + ',' + r));
  const sorted = [...cells].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = st.w;
  ctx.strokeStyle = st.stroke;
  ctx.setLineDash(st.dash || []);
  if (st.glow) {
    ctx.shadowColor = st.glow;
    ctx.shadowBlur = st.blur;
  }
  for (const [c, r] of sorted) {
    const x = ox + c * s;
    const y = top + r * s;
    if (st.right && !set.has(c + 1 + ',' + r)) poly(ctx, [x + s, y, x + s + dx, y + dy, x + s + dx, y + s + dy, x + s, y + s], st.right, st);
    if (st.top && !set.has(c + ',' + (r - 1))) poly(ctx, [x, y, x + s, y, x + s + dx, y + dy, x + dx, y + dy], st.top, st);
    poly(ctx, [x, y, x + s, y, x + s, y + s, x, y + s], st.front, st);
  }
  if (st.inset) {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = st.inset;
    const i = Math.round(s * 0.22);
    for (const [c, r] of sorted) {
      const x = ox + c * s;
      const y = top + r * s;
      ctx.strokeRect(x + i, y + i, s - 2 * i, s - 2 * i);
    }
  }
  ctx.restore();
}

export function shapeCells(shape) {
  const cells = [];
  shape.forEach((row, r) => row.forEach((v, c) => v && cells.push([c, r])));
  return cells;
}

/** Draw a piece centred in a W×H box. */
export function drawMini(ctx, shape, kind, accent, W, H, s) {
  const dx = Math.round(s * 0.55);
  const dy = -Math.round(s * 0.45);
  const w = shape[0].length;
  const h = shape.length;
  const ox = Math.round((W - (w * s + dx)) / 2);
  const top = Math.round((H - (h * s - dy)) / 2) - dy;
  drawCubes(ctx, shapeCells(shape), kind, accent, { s, dx, dy, ox, top });
}

/** Size a canvas for the device pixel ratio and return a ready 2D context. */
export function prep(canvas, W, H) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return ctx;
}
