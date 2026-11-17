'use client';

import { useEffect, useRef } from 'react';
import styles from './TetrisGame.module.css';
import { SHAPES, COMMIT_TYPES, ORANGE, drawMini, prep } from './render3d';

export function CubeCanvas({ shape, kind, accent, w, h, s, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = prep(ref.current, w, h);
    drawMini(ctx, shape, kind, accent, w, h, s);
  }, [shape, kind, accent, w, h, s]);
  return <canvas ref={ref} style={{ width: w, height: h }} role="img" aria-label={label} />;
}

const STATES = [
  ['locked', 'live', 'fill 12% · top 30% · edge 1.2px + inset trace'],
  ['active', 'active', 'orange core · double glow · trail streak'],
  ['ghost', 'ghost', 'front only · dashed 4/3 · no fill'],
  ['clearing', 'clear', 'white flash 120ms → row collapses'],
];

const SCREENS = [
  ['play', 'Play — log rail collapsed', 'The default view: well, hold, queue, event console.'],
  ['log', 'Play — git log drawer open', 'Rail slides out to a 420px drawer; game auto-pauses.'],
  ['over', 'Game over — build failed', '“Stack overflow.” styled as a failed CI job.'],
  ['pieces', 'Pieces, cube states & tokens', 'This tab.'],
];

/** Design-process reference: everything on the Gridlock 3D canvas, rendered live. */
export default function DesignPanel({ accent, preview, onPreview }) {
  const swatches = [
    ['void', '#05070B'], ['panel', '#0A0E14'], ['line', '#1A2230'], ['text', '#E6EDF3'],
    ['grid', accent], ['active', ORANGE], ['add', '#4ADE80'], ['del', '#F87171'],
  ];
  return (
    <div className={styles.design}>
      <p className={styles.designIntro}>
        Design notes from the <span className={styles.accentText}>Gridlock 3D</span> canvas — four artboards, shown here as reference.
      </p>

      <h3 className={styles.h3}>screens</h3>
      <ol className={styles.screenList}>
        {SCREENS.map(([id, title, desc], i) => {
          const live = id === 'pieces' || preview === id || (id === 'play' && !preview);
          return (
            <li key={id} className={styles.screen}>
              <span className={styles.dim}>0{i + 1}</span>
              <span className={styles.screenText}>
                <span>{title}</span>
                <span className={styles.dim}>{desc}</span>
              </span>
              {id !== 'pieces' && (
                <button type="button" className={styles.chip} data-on={live} onClick={() => onPreview(id === 'play' ? null : id)}>
                  {live ? 'showing' : 'preview'}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <h3 className={styles.h3}>pieces = commit types</h3>
      <div className={styles.pieceGrid}>
        {Object.keys(SHAPES).map((k) => (
          <div key={k} className={styles.pieceCard}>
            <CubeCanvas shape={SHAPES[k]} kind={k === 'T' ? 'active' : 'live'} accent={accent} w={74} h={54} s={k === 'I' ? 13 : 15} label={`${k} piece`} />
            <span className={styles.pieceLabel}>
              <b>{k}</b>
              <span className={styles.accentText}>{COMMIT_TYPES[k]}</span>
            </span>
          </div>
        ))}
      </div>

      <h3 className={styles.h3}>cube states</h3>
      <div className={styles.stateGrid}>
        {STATES.map(([name, kind, spec]) => (
          <div key={name} className={styles.stateCard}>
            <CubeCanvas shape={[[1]]} kind={kind} accent={accent} w={64} h={60} s={30} label={`${name} cube`} />
            <span className={styles.screenText}>
              <span data-state={kind}>{name}</span>
              <span className={styles.dim}>{spec}</span>
            </span>
          </div>
        ))}
      </div>

      <h3 className={styles.h3}>tokens</h3>
      <div className={styles.swatches}>
        {swatches.map(([n, hex]) => (
          <div key={n} className={styles.swatch}>
            <span style={{ background: hex, boxShadow: n === 'grid' || n === 'active' ? `0 0 10px ${hex}` : 'none' }} />
            <span>{n}</span>
            <span className={styles.dim}>{hex}</span>
          </div>
        ))}
      </div>
      <div className={styles.typeSpec}>
        <div><span className={styles.display}>012,480</span><span className={styles.dim}>Space Grotesk 600 · numerals</span></div>
        <div><span>spawn T @ (4,19)</span><span className={styles.dim}>JetBrains Mono · UI + logs</span></div>
      </div>
    </div>
  );
}
