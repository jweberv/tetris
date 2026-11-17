import { execFileSync } from 'node:child_process';

// Files that make up the game itself; commits touching these get flagged.
export const GAME_FILES = ['components/TetrisGame.js', 'components/TetrisGame.module.css', 'components/render3d.js', 'components/GitLog.js', 'tetris.html'];

const RS = '\x1e';
const US = '\x1f';

/**
 * Reads the repo history at build/render time. Returns [] when git or the
 * .git directory is unavailable (e.g. inside a slim container image).
 */
export function readGitLog(limit = 200) {
  let out;
  try {
    out = execFileSync(
      'git',
      ['log', `-n${limit}`, '--numstat', `--pretty=format:${RS}%h${US}%an${US}%aI${US}%s`],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 },
    );
  } catch {
    return [];
  }

  return out
    .split(RS)
    .filter(Boolean)
    .map((chunk) => {
      const [head, ...lines] = chunk.split('\n');
      const [hash, author, date, subject] = head.split(US);
      const files = lines
        .filter((l) => l.trim())
        .map((l) => {
          const [a, d, ...p] = l.split('\t');
          const bin = a === '-';
          return { path: p.join('\t'), add: bin ? 0 : Number(a), del: bin ? 0 : Number(d), bin };
        });
      const add = files.reduce((n, f) => n + f.add, 0);
      const del = files.reduce((n, f) => n + f.del, 0);
      const game = files.some((f) => GAME_FILES.includes(f.path));
      return { hash, author, date, subject, files, add, del, game };
    });
}
