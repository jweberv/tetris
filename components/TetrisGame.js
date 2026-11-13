'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './TetrisGame.module.css';
import { ACCENTS, COMMIT_TYPES, SHAPES, drawCubes, drawMini, prep, rgba } from './render3d';
import { GitDrawer, GitRail } from './GitLog';
import DesignPanel from './DesignPanel';

const COLS = 10;
const ROWS = 20;
const S = 30;
const DX = 16;
const DY = -12;
const OX = 20;
const TOP = 52;
const W = 356;
const H = 672;
const LINE_SCORES = [0, 100, 300, 500, 800];
const CLEAR_MS = 120;
const KEYS = Object.keys(SHAPES);

const pad = (n, w = 2) => String(n).padStart(w, '0');
const clock = (ms) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms % 1000), 3)}`;
const fmtScore = (n) => pad(n, 6).replace(/(\d{3})(?=\d{3}$)/, '$1,');
const rotateCW = (m) => m[0].map((_, c) => m.map((row) => row[c]).reverse());
const rotateCCW = (m) => m[0].map((_, c) => m.map((row) => row[row.length - 1 - c]));

function freshState() {
  return {
    grid: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),
    bag: [],
    queue: [],
    piece: null,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    pieces: 0,
    releases: 0,
    actions: 0,
    elapsed: 0,
    dropTimer: 0,
    clearing: null,
    trail: null,
    hit: null,
    lastMove: null,
  };
}

export default function TetrisGame({ commits = [] }) {
  const boardRef = useRef(null);
  const holdRef = useRef(null);
  const nextRefs = [useRef(null), useRef(null), useRef(null)];
  const g = useRef(freshState());
  const mode = useRef('idle'); // idle | running | paused | over
  const accentRef = useRef(ACCENTS[0]);
  const eventsRef = useRef([]);

  const [ui, setUi] = useState({ mode: 'idle', score: 0, lines: 0, level: 1, combo: -1, pieces: 0, releases: 0 });
  const [events, setEvents] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState('events');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [preview, setPreview] = useState(null); // null | 'log' | 'over'
  const [best, setBest] = useState(0);
  const [perf, setPerf] = useState({ fps: 60, apm: 0, uptime: 0 });

  const drawerRef = useRef(false);
  drawerRef.current = drawer;
  const previewRef = useRef(null);
  previewRef.current = preview;

  // ---------- persistence ----------
  useEffect(() => {
    try {
      const a = localStorage.getItem('gridlock.accent');
      if (a && ACCENTS.includes(a)) setAccent(a);
      setBest(Number(localStorage.getItem('gridlock.best')) || 0);
    } catch {}
  }, []);
  useEffect(() => {
    accentRef.current = accent;
    try { localStorage.setItem('gridlock.accent', accent); } catch {}
  }, [accent]);

  // ---------- helpers ----------
  const sync = useCallback(() => {
    const s = g.current;
    setUi({ mode: mode.current, score: s.score, lines: s.lines, level: s.level, combo: s.combo, pieces: s.pieces, releases: s.releases });
  }, []);

  const log = useCallback((kind, msg, pts = '') => {
    const s = g.current;
    const list = eventsRef.current;
    if (kind === 'move' && list[0]?.kind === 'move' && s.lastMove === s.pieces) {
      list[0] = { ...list[0], t: clock(s.elapsed), msg };
    } else {
      list.unshift({ id: Math.random().toString(36).slice(2), t: clock(s.elapsed), kind, msg, pts });
      if (list.length > 60) list.length = 60;
    }
    s.lastMove = kind === 'move' ? s.pieces : null;
    setEvents([...list]);
  }, []);

  const valid = (shape, x, y) => {
    const grid = g.current.grid;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = x + c;
        const ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && grid[ny][nx]) return false;
      }
    }
    return true;
  };

  const pull = () => {
    const s = g.current;
    while (s.queue.length < 4) {
      if (!s.bag.length) {
        s.bag = [...KEYS];
        for (let i = s.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
        }
      }
      s.queue.push(s.bag.pop());
    }
    return s.queue.shift();
  };

  const pieceCells = (p, yOverride) => {
    const cells = [];
    const y = yOverride ?? p.y;
    p.shape.forEach((row, r) => row.forEach((v, c) => v && cells.push([p.x + c, y + r])));
    return cells;
  };

  const endGame = useCallback((hitPiece) => {
    const s = g.current;
    mode.current = 'over';
    s.hit = hitPiece ? pieceCells(hitPiece).filter(([, r]) => r >= 0) : [];
    log('fail', `spawn ${hitPiece?.k ?? '?'} — collision`, '');
    try {
      const prev = Number(localStorage.getItem('gridlock.best')) || 0;
      if (s.score > prev) localStorage.setItem('gridlock.best', String(s.score));
      setBest(Math.max(prev, s.score));
    } catch {}
    sync();
  }, [log, sync]);

  const spawn = useCallback((k) => {
    const s = g.current;
    const shape = SHAPES[k];
    const p = { k, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
    s.piece = p;
    s.holdUsed = false;
    s.pieces++;
    if (!valid(shape, p.x, p.y)) {
      endGame(p);
      return;
    }
    log('spawn', `${k} ${COMMIT_TYPES[k]} @ (${p.x},${ROWS - 1})`);
  }, [endGame, log]);

  const lock = useCallback(() => {
    const s = g.current;
    const p = s.piece;
    let above = false;
    pieceCells(p).forEach(([c, r]) => {
      if (r < 0) above = true;
      else s.grid[r][c] = 1;
    });
    log('lock', `${p.k} @ (${p.x},${ROWS - 1 - (p.y + p.shape.length - 1)})`);
    if (above) {
      endGame(p);
      return;
    }
    const full = [];
    s.grid.forEach((row, r) => row.every(Boolean) && full.push(r));
    if (full.length) {
      s.clearing = { rows: full, until: s.elapsed + CLEAR_MS };
      s.combo++;
      const pts = LINE_SCORES[full.length] * s.level + (s.combo > 0 ? 50 * s.combo * s.level : 0);
      s.score += pts;
      if (full.length === 4) s.releases++;
      log('clear', `rows [${full.map((r) => ROWS - 1 - r).join(',')}]${s.combo > 0 ? ` · combo ×${s.combo + 1}` : ''}`, `+${pts}`);
      if (full.length === 4) log('release', '4 rows · tetris shipped', '');
    } else {
      s.combo = -1;
      spawn(pull());
    }
    sync();
  }, [endGame, log, spawn, sync]);

  const finishClear = useCallback(() => {
    const s = g.current;
    const rows = s.clearing.rows;
    s.grid = s.grid.filter((_, r) => !rows.includes(r));
    while (s.grid.length < ROWS) s.grid.unshift(new Array(COLS).fill(0));
    s.lines += rows.length;
    const lvl = Math.floor(s.lines / 10) + 1;
    if (lvl !== s.level) {
      log('level', `${pad(s.level)} → ${pad(lvl)}`);
      s.level = lvl;
      log('gravity', `interval → ${gravity(lvl)}ms`);
    }
    s.clearing = null;
    spawn(pull());
    sync();
  }, [log, spawn, sync]);

  // ---------- actions ----------
  const start = useCallback(() => {
    g.current = freshState();
    eventsRef.current = [];
    setEvents([]);
    setPreview(null);
    mode.current = 'running';
    log('start', `session ${Math.random().toString(16).slice(2, 8)} · gravity ${gravity(1)}ms`);
    spawn(pull());
    sync();
  }, [log, spawn, sync]);

  const setPaused = useCallback((p) => {
    if (p && mode.current === 'running') {
      mode.current = 'paused';
      log('pause', 'game paused');
    } else if (!p && mode.current === 'paused') {
      mode.current = 'running';
      log('resume', 'game resumed');
    }
    sync();
  }, [log, sync]);

  const toggleDrawer = useCallback((force) => {
    const next = typeof force === 'boolean' ? force : !drawerRef.current;
    setDrawer(next);
    if (next) setPaused(true);
  }, [setPaused]);

  const input = useCallback((action) => {
    const s = g.current;
    if (mode.current !== 'running' || s.clearing || !s.piece) return;
    const p = s.piece;
    s.actions++;
    switch (action) {
      case 'left':
      case 'right': {
        const d = action === 'left' ? -1 : 1;
        if (valid(p.shape, p.x + d, p.y)) {
          p.x += d;
          log('move', `${p.k}  ${d < 0 ? '←' : '→'}  x=${p.x}`);
        }
        break;
      }
      case 'down':
        if (valid(p.shape, p.x, p.y + 1)) {
          p.y++;
          s.score++;
          s.dropTimer = 0;
          sync();
        } else lock();
        break;
      case 'cw':
      case 'ccw': {
        const r = action === 'cw' ? rotateCW(p.shape) : rotateCCW(p.shape);
        for (const k of [0, -1, 1, -2, 2]) {
          if (valid(r, p.x + k, p.y)) {
            p.shape = r;
            p.x += k;
            log('rotate', `${p.k}  ${action}${k ? `  kick ${k > 0 ? '+' : ''}${k}` : ''}`);
            break;
          }
        }
        break;
      }
      case 'hard': {
        const y0 = p.y;
        while (valid(p.shape, p.x, p.y + 1)) p.y++;
        const n = p.y - y0;
        s.score += n * 2;
        s.trail = { x0: p.x, x1: p.x + p.shape[0].length, from: y0, to: p.y, until: s.elapsed + 220 };
        log('drop', `hard · ${n} cells`, n ? `+${n * 2}` : '');
        lock();
        break;
      }
      case 'hold': {
        if (s.holdUsed) return;
        const prev = s.hold;
        s.hold = p.k;
        log('hold', prev ? `${prev} ⇄ ${p.k}` : `${p.k} → hold`);
        if (prev) spawn(prev);
        else spawn(pull());
        s.pieces--;
        s.holdUsed = true;
        sync();
        break;
      }
      default:
    }
  }, [lock, log, spawn, sync]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key;
      if (k === 'l' || k === 'L') return toggleDrawer();
      if (k === 'Escape') {
        if (drawerRef.current) return toggleDrawer(false);
        return setPreview(null);
      }
      if (k === 'Enter' && (mode.current === 'idle' || mode.current === 'over' || previewRef.current === 'over')) {
        e.preventDefault();
        return start();
      }
      if (k === 'p' || k === 'P') {
        if (drawerRef.current) return;
        return setPaused(mode.current === 'running');
      }
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'cw', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw', ' ': 'hard', c: 'hold', C: 'hold', Shift: 'hold' };
      if (map[k] && mode.current === 'running') {
        e.preventDefault();
        input(map[k]);
      }
    };
    const onBlur = () => setPaused(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [input, setPaused, start, toggleDrawer]);

  // ---------- loop + render ----------
  useEffect(() => {
    let raf;
    let last = performance.now();
    let frames = 0;
    let fpsT = last;
    let uptime0 = last;

    const frame = (now) => {
      const dt = Math.min(100, now - last);
      last = now;
      const s = g.current;

      if (mode.current === 'running') {
        s.elapsed += dt;
        if (s.clearing) {
          if (s.elapsed >= s.clearing.until) finishClear();
        } else if (s.piece) {
          s.dropTimer += dt;
          if (s.dropTimer >= gravity(s.level)) {
            s.dropTimer = 0;
            if (valid(s.piece.shape, s.piece.x, s.piece.y + 1)) s.piece.y++;
            else lock();
          }
        }
      }

      render(now);

      frames++;
      if (now - fpsT > 1000) {
        const mins = s.elapsed / 60000;
        setPerf({ fps: Math.round((frames * 1000) / (now - fpsT)), apm: mins > 0.05 ? Math.round(s.actions / mins) : 0, uptime: now - uptime0 });
        frames = 0;
        fpsT = now;
      }
      raf = requestAnimationFrame(frame);
    };

    const render = (now) => {
      const canvas = boardRef.current;
      if (!canvas) return;
      const ctx = prep(canvas, W, H);
      const a = accentRef.current;
      const s = g.current;
      const over = mode.current === 'over';
      const bottom = TOP + ROWS * S;
      const tone = over ? '#FF9F1C' : a;

      // floor
      ctx.beginPath();
      ctx.moveTo(OX, bottom);
      ctx.lineTo(OX + COLS * S, bottom);
      ctx.lineTo(OX + COLS * S + DX, bottom + DY);
      ctx.lineTo(OX + DX, bottom + DY);
      ctx.closePath();
      ctx.fillStyle = rgba(tone, 0.07);
      ctx.fill();
      ctx.strokeStyle = rgba(tone, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();

      // back plane grid
      ctx.strokeStyle = rgba(tone, 0.1);
      ctx.beginPath();
      for (let c = 0; c <= COLS; c++) {
        ctx.moveTo(OX + c * S + DX + 0.5, TOP + DY);
        ctx.lineTo(OX + c * S + DX + 0.5, bottom + DY);
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.moveTo(OX + DX, TOP + r * S + DY + 0.5);
        ctx.lineTo(OX + COLS * S + DX, TOP + r * S + DY + 0.5);
      }
      ctx.stroke();

      // depth edges
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(tone, 0.35);
      ctx.beginPath();
      for (const [x, y] of [[OX, bottom], [OX + COLS * S, bottom], [OX, TOP], [OX + COLS * S, TOP]]) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + DX, y + DY);
      }
      ctx.stroke();
      // spawn line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(255,159,28,0.35)';
      ctx.beginPath();
      ctx.moveTo(OX, TOP + 2 * S);
      ctx.lineTo(OX + COLS * S, TOP + 2 * S);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#B57322';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('spawn', OX + COLS * S + 2, TOP + 2 * S - 4);

      const geo = { s: S, dx: DX, dy: DY, ox: OX, top: TOP };
      const stack = [];
      const clearing = [];
      s.grid.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return;
        (s.clearing?.rows.includes(r) ? clearing : stack).push([c, r]);
      }));
      drawCubes(ctx, stack, over ? 'dead' : 'live', a, geo);
      if (clearing.length) drawCubes(ctx, clearing, 'clear', a, geo);

      if (over) {
        if (s.hit?.length) drawCubes(ctx, s.hit, 'hit', a, geo);
      } else if (s.piece && !s.clearing && mode.current !== 'idle') {
        const p = s.piece;
        let gy = p.y;
        while (valid(p.shape, p.x, gy + 1)) gy++;
        if (gy !== p.y) drawCubes(ctx, pieceCells(p, gy).filter(([, r]) => r >= 0), 'ghost', a, geo);
        if (s.trail && s.elapsed < s.trail.until) {
          const t = (s.trail.until - s.elapsed) / 220;
          ctx.fillStyle = `rgba(255,159,28,${0.22 * t})`;
          ctx.fillRect(OX + s.trail.x0 * S, TOP + Math.max(0, s.trail.from) * S, (s.trail.x1 - s.trail.x0) * S, (s.trail.to - s.trail.from) * S);
        }
        drawCubes(ctx, pieceCells(p).filter(([, r]) => r >= 0), 'active', a, geo);
      }

      // front frame
      ctx.save();
      ctx.strokeStyle = over ? 'rgba(255,159,28,0.6)' : a;
      ctx.lineWidth = 2;
      ctx.shadowColor = tone;
      ctx.shadowBlur = over ? 0 : 6;
      ctx.beginPath();
      ctx.moveTo(OX, TOP);
      ctx.lineTo(OX, bottom);
      ctx.lineTo(OX + COLS * S, bottom);
      ctx.lineTo(OX + COLS * S, TOP);
      ctx.stroke();
      ctx.restore();

      // side previews
      if (holdRef.current) {
        const hctx = prep(holdRef.current, 178, 96);
        if (s.hold) drawMini(hctx, SHAPES[s.hold], s.holdUsed ? 'dim' : 'live', a, 178, 96, 22);
      }
      nextRefs.forEach((ref, i) => {
        if (!ref.current) return;
        const nctx = prep(ref.current, 150, 84);
        const k = s.queue[i];
        if (k && mode.current !== 'idle') drawMini(nctx, SHAPES[k], i === 0 ? 'live' : 'dim', a, 150, 84, i === 0 ? 22 : 18);
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishClear, lock]);

  // ---------- view ----------
  const s = g.current;
  const showOver = ui.mode === 'over' || preview === 'over';
  const drawerOpen = drawer || preview === 'log';
  const statusText = { idle: 'idle', running: 'running', paused: 'paused', over: 'failed' }[ui.mode];
  const head = commits[0]?.hash ?? 'no-git';
  const nextQueue = s.queue.slice(0, 3);
  const levelProgress = (ui.lines % 10) * 10;

  const onPreview = (id) => {
    setPreview(id);
    if (id) setPaused(true);
    if (id !== 'log') setDrawer(false);
  };
  const closeDrawer = () => {
    setDrawer(false);
    if (preview === 'log') setPreview(null);
  };

  return (
    <div className={styles.app} style={{ '--accent': accent, '--accent-12': rgba(accent, 0.12), '--accent-35': rgba(accent, 0.35) }}>
      <header className={styles.topbar}>
        <div className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <path d="M11 2 L20 7 L20 15 L11 20 L2 15 L2 7 Z M2 7 L11 12 L20 7 M11 12 L11 20" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          </svg>
        </div>
        <span className={styles.brand}>gridlock</span>
        <span className={styles.tag}>v0.3.0-beta</span>
        <span className={styles.crumb}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="3" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="4" cy="13" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M4 4.8 V11.2 M12 6.8 C12 9 8 9 4.6 11.4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          main <span className={styles.sep}>/</span> <b>components/TetrisGame.js</b>
        </span>
        <span className={styles.grow} />
        <span className={styles.pill} data-mode={ui.mode}>
          <span className={styles.pillDot} />
          {statusText} · lvl {pad(ui.level)}
        </span>
        <span className={styles.hints}>
          <kbd>P</kbd>pause <kbd>L</kbd>log
        </span>
        <button type="button" className={styles.iconBtn} onClick={() => setAccent(ACCENTS[(ACCENTS.indexOf(accent) + 1) % ACCENTS.length])} aria-label="Cycle accent color" title="Cycle accent color">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4 H14 M2 8 H14 M2 12 H14" stroke="#8B98A9" strokeWidth="1.3" /><circle cx="5" cy="4" r="1.6" fill="#070A0F" stroke="var(--accent)" strokeWidth="1.3" /><circle cx="11" cy="8" r="1.6" fill="#070A0F" stroke="#C9D3DF" strokeWidth="1.3" /><circle cx="7" cy="12" r="1.6" fill="#070A0F" stroke="#C9D3DF" strokeWidth="1.3" /></svg>
        </button>
      </header>

      <div className={styles.body}>
        <GitRail commits={commits} open={drawerOpen} onToggle={() => (drawerOpen ? closeDrawer() : toggleDrawer(true))} />

        <main className={styles.stage}>
          <div className={styles.floor} aria-hidden="true" data-over={showOver} />
          <div className={styles.dotgrid} aria-hidden="true" />

          {showOver ? (
            <GameOver ui={ui} best={best} isPreview={ui.mode !== 'over'} onRetry={start} onBack={() => setPreview(null)} events={events} />
          ) : null}

          <div className={styles.sideCol} data-hidden={showOver}>
            <section className={styles.card}>
              <div className={styles.cardHead}><span>HOLD</span><span>C</span></div>
              <canvas ref={holdRef} style={{ width: 178, height: 96 }} role="img" aria-label={s.hold ? `Held piece: ${s.hold}` : 'Hold empty'} />
            </section>
            <section className={`${styles.card} ${styles.stats}`}>
              <div className={styles.stat}>
                <span>score</span>
                <span className={styles.score}>{fmtScore(ui.score)}</span>
              </div>
              <div className={styles.statGrid}>
                <div className={styles.stat}><span>lines</span><b>{ui.lines}</b></div>
                <div className={styles.stat}><span>level</span><b>{pad(ui.level)}</b></div>
                <div className={styles.stat}><span>combo</span><b className={styles.orange}>{ui.combo > 0 ? `×${ui.combo + 1}` : '—'}</b></div>
                <div className={styles.stat}><span>pieces</span><b>{ui.pieces}</b></div>
              </div>
              <div className={styles.progress}>
                <div className={styles.progressLabel}><span>next level</span><span>{ui.lines % 10}/10</span></div>
                <div className={styles.bar}><div style={{ width: `${levelProgress}%` }} /></div>
              </div>
            </section>
          </div>

          <div className={styles.wellCol}>
            <div className={styles.wellLabel}>
              <span>well[10×20]</span><span className={styles.sep}>·</span><span>gravity {gravity(ui.level)}ms</span>
              {s.piece && ui.mode === 'running' && (<><span className={styles.sep}>·</span><span className={styles.orange}>{s.piece.k} active</span></>)}
            </div>
            <div className={styles.wellWrap}>
              <canvas ref={boardRef} className={styles.well} style={{ width: W, height: H }} role="img" aria-label="Game well" />
              {ui.mode === 'idle' && (
                <div className={styles.overlay}>
                  <span className={styles.overlayKicker}>// a stacker for dev downtime</span>
                  <h1 className={styles.overlayTitle}>gridlock</h1>
                  <button type="button" className={styles.primary} onClick={start}>START GAME</button>
                  <span className={styles.dim}>or press ↵</span>
                </div>
              )}
              {ui.mode === 'paused' && !drawerOpen && !showOver && (
                <div className={styles.overlay}>
                  <span className={styles.overlayKicker}>// paused</span>
                  <button type="button" className={styles.primary} onClick={() => setPaused(false)}>RESUME</button>
                  <span className={styles.dim}>or press P</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.sideCol} data-hidden={showOver}>
            <section className={styles.card}>
              <div className={styles.cardHead}><span>NEXT</span><span>queue[3]</span></div>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.nextRow}>
                  <span className={styles.dim}>0{i + 1}</span>
                  <canvas ref={nextRefs[i]} style={{ width: 150, height: 84 }} role="img" aria-label={nextQueue[i] ? `Next piece ${i + 1}: ${nextQueue[i]}` : 'Empty'} />
                </div>
              ))}
            </section>
            <section className={styles.tip}>
              <span className={styles.tipHead}>// tip</span>
              <span>clear 4 rows at once to ship a <span className={styles.orange}>release</span></span>
            </section>
          </div>
        </main>

        <aside className={styles.console}>
          <div className={styles.consoleHead}>
            <span className={styles.consoleTitle}>gl-{head}</span>
            <span className={styles.pill} data-mode={ui.mode}><span className={styles.pillDot} />{statusText}</span>
          </div>
          <nav className={styles.tabs} aria-label="Console">
            {['events', 'keys', 'design'].map((t) => (
              <button key={t} type="button" className={styles.tab} data-on={tab === t} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          {tab === 'events' && (
            <ol className={styles.events}>
              {events.length === 0 && <li className={styles.empty}>no events yet — press ↵ to start</li>}
              {events.map((e) => (
                <li key={e.id} className={styles.event}>
                  <span className={styles.dim}>{e.t}</span>
                  <span data-kind={e.kind}>{e.kind}</span>
                  <span className={styles.eventMsg}>{e.msg}</span>
                  <span className={styles.pts}>{e.pts}</span>
                </li>
              ))}
            </ol>
          )}
          {tab === 'keys' && (
            <dl className={styles.keys}>
              {[['← →', 'move'], ['↑ / X', 'rotate cw'], ['Z', 'rotate ccw'], ['↓', 'soft drop'], ['space', 'hard drop'], ['C / shift', 'hold'], ['P', 'pause'], ['L', 'git log'], ['esc', 'close drawer / preview'], ['↵', 'start / re-run']].map(([k, v]) => (
                <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          {tab === 'design' && <DesignPanel accent={accent} preview={preview} onPreview={onPreview} />}
          <div className={styles.legend}>
            <span><kbd>← →</kbd>move</span>
            <span><kbd>↑</kbd>rotate</span>
            <span><kbd>space</kbd>hard drop</span>
            <span><kbd>C</kbd>hold</span>
          </div>
        </aside>

        {drawerOpen && <GitDrawer commits={commits} onClose={closeDrawer} />}
      </div>

      <footer className={styles.statusbar}>
        <span className={styles.accentText}>● main</span>
        <span>{head}</span>
        <span>✓ 0 errors</span>
        <span className={styles.grow} />
        <span>{perf.fps} fps</span>
        <span>apm {perf.apm}</span>
        <span>uptime {clock(perf.uptime).slice(0, 5)}</span>
        <span>best {fmtScore(best)}</span>
      </footer>
    </div>
  );
}

function gravity(level) {
  return Math.max(80, 800 - (level - 1) * 60);
}

function GameOver({ ui, best, isPreview, onRetry, onBack, events }) {
  const failed = events.find((e) => e.kind === 'fail');
  const steps = [
    ['ok', 'spawn queue · 7-bag shuffled', ''],
    ['ok', `levels 01 → ${pad(ui.level)}`, ''],
    ['ok', `release × ${ui.releases} (4-row clears)`, ''],
    ['fail', failed ? failed.msg : 'spawn Z @ (3,19) — collision', failed?.t.slice(0, 5) ?? '04:31'],
    ['skip', 'submit score to leaderboard', 'skipped'],
  ];
  return (
    <section className={styles.over} aria-label="Game over">
      <div className={styles.overBadge}>
        <span>✕ failed</span>
        <span className={styles.muted}>job play#{ui.pieces} · exit code 1{isPreview ? ' · design preview' : ''}</span>
      </div>
      <h1 className={styles.overTitle}>Stack overflow.</h1>
      <p className={styles.overLede}>A piece spawned into an occupied cell at the top of the well. Break&apos;s over — or run it again.</p>
      <div className={styles.steps}>
        {steps.map(([st, name, t]) => (
          <div key={name} className={styles.step} data-st={st}>
            <span>{st === 'ok' ? '✓' : st === 'fail' ? '✕' : '○'}</span>
            <span>{name}</span>
            <span className={styles.dim}>{t}</span>
          </div>
        ))}
      </div>
      <div className={styles.overStats}>
        <div><span>score</span><b>{fmtScore(ui.score)}</b></div>
        <div><span>lines</span><b>{ui.lines}</b></div>
        <div><span>releases</span><b className={styles.orange}>{ui.releases}</b></div>
        <div><span>best</span><b className={styles.muted}>{fmtScore(best)}</b></div>
      </div>
      <div className={styles.overActions}>
        <button type="button" className={styles.primary} onClick={onRetry}>Re-run job <span>↵</span></button>
        {isPreview && <button type="button" className={styles.secondary} onClick={onBack}>Back to game</button>}
        <span className={styles.dim}>esc closes · auto-pauses on focus loss</span>
      </div>
    </section>
  );
}
