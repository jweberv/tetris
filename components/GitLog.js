'use client';

import { useState } from 'react';
import styles from './TetrisGame.module.css';

const fmt = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });

/** The mostly-concealed left rail. Clicking it toggles the drawer. */
export function GitRail({ commits, open, onToggle }) {
  const dots = commits.slice(0, 40);
  return (
    <button type="button" className={styles.rail} onClick={onToggle} aria-label={open ? 'Close git log' : 'Open git log'} aria-expanded={open}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M9 1 V5.8 M9 12.2 V17" stroke="var(--accent)" strokeWidth="1.5" />
      </svg>
      <span className={styles.railCount}>{commits.length}</span>
      <span className={styles.railLabel}>git log</span>
      <span className={styles.railTrack}>
        {dots.map((c, i) => (
          <span key={c.hash} className={styles.railDot} data-kind={c.game ? 'game' : i === 0 ? 'head' : 'other'} title={`${c.hash} ${c.subject}`} />
        ))}
      </span>
      <span className={styles.railKey}>L</span>
      <span className={styles.railEdge} />
    </button>
  );
}

export function GitDrawer({ commits, onClose }) {
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(commits[0]?.hash ?? null);
  const gameCount = commits.filter((c) => c.game).length;
  const shown = filter === 'game' ? commits.filter((c) => c.game) : commits;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <aside className={styles.drawer} aria-label="Git log">
        <div className={styles.drawerHead}>
          <span className={styles.drawerTitle}>git log</span>
          <span className={styles.muted}>main · {commits.length} commits</span>
          <span className={styles.grow} />
          <button type="button" className={styles.iconBtnSm} onClick={onClose} aria-label="Close git log">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M8 2 L4 6 L8 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <div className={styles.chips}>
          <button type="button" className={styles.chip} data-on={filter === 'all'} onClick={() => setFilter('all')}>
            all files · {commits.length}
          </button>
          <button type="button" className={styles.chip} data-on={filter === 'game'} data-tone="game" onClick={() => setFilter('game')}>
            game files · {gameCount}
          </button>
          <span className={styles.grow} />
          <span className={styles.dim}>--stat</span>
        </div>

        {commits.length === 0 ? (
          <p className={styles.empty}>No git history available in this build.</p>
        ) : (
          <ol className={styles.commitList}>
            {shown.map((c) => {
              const on = sel === c.hash;
              return (
                <li key={c.hash} className={styles.commit} data-on={on}>
                  <button type="button" className={styles.commitRow} onClick={() => setSel(on ? null : c.hash)} aria-expanded={on}>
                    <span className={styles.commitDot} data-game={c.game} />
                    <span className={styles.hash} data-game={c.game}>{c.hash}</span>
                    <span className={styles.subject}>{c.subject}</span>
                    <span className={styles.dim}>{fmt(c.date)}</span>
                  </button>
                  {on && (
                    <div className={styles.commitBody}>
                      <div className={styles.commitMeta}>
                        <span>{c.author}</span>
                        <span className={styles.add}>+{c.add}</span>
                        <span className={styles.del}>−{c.del}</span>
                        <span>{c.files.length} files</span>
                      </div>
                      {c.files.length > 0 && (
                        <div className={styles.fileBox}>
                          {c.files.slice(0, 12).map((f) => {
                            const total = f.add + f.del;
                            const n = f.bin ? 0 : Math.max(1, Math.min(5, Math.ceil(total / 70)));
                            const greens = total ? Math.round((n * f.add) / total) : 0;
                            return (
                              <div key={f.path} className={styles.fileRow}>
                                <span className={styles.filePath}>{f.path}</span>
                                <span className={styles.add}>{f.bin ? 'bin' : `+${f.add}`}</span>
                                {!f.bin && f.del > 0 && <span className={styles.del}>−{f.del}</span>}
                                <span className={styles.bars} aria-hidden="true">
                                  {[0, 1, 2, 3, 4].map((k) => (
                                    <span key={k} data-b={k < greens ? 'add' : k < n ? 'del' : 'off'} />
                                  ))}
                                </span>
                              </div>
                            );
                          })}
                          {c.files.length > 12 && <div className={styles.fileRow}><span className={styles.dim}>… {c.files.length - 12} more</span></div>}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div className={styles.drawerFoot}>
          <span className={styles.liveDot} />
          snapshot of HEAD at build time · game paused while open
        </div>
      </aside>
    </>
  );
}
