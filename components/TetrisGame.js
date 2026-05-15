'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './TetrisGame.module.css';

const COLS = 10, ROWS = 20, BLOCK = 30;
const COLORS = ['', '#ff4d4d', '#ff9900', '#ffdd00', '#66ff66', '#00ccff', '#3366ff', '#cc44ff'];
const PIECES = [
  null,
  [[1, 1, 1, 1]],
  [[2, 0], [2, 0], [2, 2]],
  [[0, 3], [0, 3], [3, 3]],
  [[4, 4], [4, 4]],
  [[0, 5, 5], [5, 5, 0]],
  [[6, 6, 0], [0, 6, 6]],
  [[0, 7, 0], [7, 7, 7]],
];
const SCORES = [0, 100, 300, 500, 800];

export default function TetrisGame() {
  const boardRef = useRef(null);
  const nextRef = useRef(null);
  const g = useRef({
    grid: null,
    piece: null,
    pieceX: 0,
    pieceY: 0,
    nextPiece: null,
    score: 0,
    level: 1,
    lines: 0,
    dropTimer: 0,
    lastTime: 0,
    dropInterval: 1000,
    paused: false,
    gameOver: true,
    animFrame: null,
    startGame: null,
  });

  const [stats, setStats] = useState({ score: 0, level: 1, lines: 0 });
  const [overlay, setOverlay] = useState({ show: true, title: 'TETRIS', scoreText: '', btnText: 'START GAME' });

  useEffect(() => {
    const board = boardRef.current;
    const ctx = board.getContext('2d');
    const nextCanvas = nextRef.current;
    const nctx = nextCanvas.getContext('2d');
    const s = g.current;

    function newGrid() {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    function randomPiece() {
      return PIECES[Math.floor(Math.random() * (PIECES.length - 1)) + 1];
    }

    function drawBlock(context, x, y, color, size) {
      size = size || BLOCK;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.fillStyle = 'rgba(0,0,0,0.2)';
      context.fillRect(x * size + 1, y * size + size - 5, size - 2, 4);
    }

    function drawGrid() {
      ctx.clearRect(0, 0, board.width, board.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
          if (s.grid[r][c]) drawBlock(ctx, c, r, COLORS[s.grid[r][c]]);
        }
      }
    }

    function drawPiece(p, px, py, context, size) {
      context = context || ctx;
      size = size || BLOCK;
      p.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) drawBlock(context, px + c, py + r, COLORS[val], size);
        });
      });
    }

    function drawGhost() {
      let gy = s.pieceY;
      while (valid(s.piece, s.pieceX, gy + 1)) gy++;
      if (gy === s.pieceY) return;
      s.piece.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect((s.pieceX + c) * BLOCK + 1, (gy + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
          }
        });
      });
    }

    function drawNext() {
      nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      if (!s.nextPiece) return;
      const size = 20;
      const cols = s.nextPiece[0].length;
      const rows = s.nextPiece.length;
      const ox = Math.floor((6 - cols) / 2);
      const oy = Math.floor((4 - rows) / 2);
      s.nextPiece.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) drawBlock(nctx, ox + c, oy + r, COLORS[val], size);
        });
      });
    }

    function valid(p, px, py) {
      return p.every((row, r) =>
        row.every((val, c) => {
          if (!val) return true;
          const nx = px + c, ny = py + r;
          return nx >= 0 && nx < COLS && ny < ROWS && (ny < 0 || !s.grid[ny][nx]);
        })
      );
    }

    function syncStats() {
      setStats({ score: s.score, level: s.level, lines: s.lines });
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (s.grid[r].every(c => c)) {
          s.grid.splice(r, 1);
          s.grid.unshift(new Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        s.lines += cleared;
        s.score += SCORES[cleared] * s.level;
        s.level = Math.floor(s.lines / 10) + 1;
        s.dropInterval = Math.max(100, 1000 - (s.level - 1) * 90);
        syncStats();
      }
    }

    function rotate(p) {
      return p[0].map((_, c) => p.map(row => row[c]).reverse());
    }

    function lock() {
      s.piece.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val && s.pieceY + r >= 0) s.grid[s.pieceY + r][s.pieceX + c] = val;
        });
      });
      clearLines();
      s.piece = s.nextPiece;
      s.nextPiece = randomPiece();
      s.pieceX = Math.floor(COLS / 2) - Math.floor(s.piece[0].length / 2);
      s.pieceY = -s.piece.length + 1;
      drawNext();
      if (!valid(s.piece, s.pieceX, s.pieceY)) endGame();
    }

    function drop() {
      if (valid(s.piece, s.pieceX, s.pieceY + 1)) {
        s.pieceY++;
      } else {
        lock();
      }
    }

    function hardDrop() {
      while (valid(s.piece, s.pieceX, s.pieceY + 1)) {
        s.pieceY++;
        s.score += 2;
      }
      lock();
      syncStats();
    }

    function gameLoop(ts) {
      if (s.gameOver || s.paused) return;
      const delta = ts - s.lastTime;
      s.dropTimer += delta;
      s.lastTime = ts;
      if (s.dropTimer >= s.dropInterval) {
        drop();
        s.dropTimer = 0;
      }
      drawGrid();
      drawGhost();
      drawPiece(s.piece, s.pieceX, s.pieceY);
      s.animFrame = requestAnimationFrame(gameLoop);
    }

    function startGame() {
      if (s.animFrame) cancelAnimationFrame(s.animFrame);
      s.grid = newGrid();
      s.score = 0; s.level = 1; s.lines = 0; s.dropInterval = 1000;
      s.nextPiece = randomPiece();
      s.piece = randomPiece();
      s.pieceX = Math.floor(COLS / 2) - Math.floor(s.piece[0].length / 2);
      s.pieceY = 0;
      drawNext();
      s.paused = false; s.gameOver = false; s.dropTimer = 0; s.lastTime = performance.now();
      syncStats();
      setOverlay(prev => ({ ...prev, show: false }));
      s.animFrame = requestAnimationFrame(gameLoop);
    }

    function endGame() {
      s.gameOver = true;
      setOverlay({ show: true, title: 'GAME OVER', scoreText: `Score: ${s.score}`, btnText: 'PLAY AGAIN' });
    }

    s.startGame = startGame;

    function handleKey(e) {
      if (s.gameOver) return;
      if (e.key === 'p' || e.key === 'P') {
        s.paused = !s.paused;
        if (!s.paused) {
          s.lastTime = performance.now();
          s.animFrame = requestAnimationFrame(gameLoop);
        }
        return;
      }
      if (s.paused) return;
      switch (e.key) {
        case 'ArrowLeft':
          if (valid(s.piece, s.pieceX - 1, s.pieceY)) s.pieceX--;
          break;
        case 'ArrowRight':
          if (valid(s.piece, s.pieceX + 1, s.pieceY)) s.pieceX++;
          break;
        case 'ArrowDown':
          drop();
          s.score += 1;
          s.dropTimer = 0;
          syncStats();
          break;
        case 'ArrowUp': {
          const r = rotate(s.piece);
          if (valid(r, s.pieceX, s.pieceY)) s.piece = r;
          else if (valid(r, s.pieceX + 1, s.pieceY)) { s.piece = r; s.pieceX++; }
          else if (valid(r, s.pieceX - 1, s.pieceY)) { s.piece = r; s.pieceX--; }
          break;
        }
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      if (s.animFrame) cancelAnimationFrame(s.animFrame);
    };
  }, []);

  function handleStart() {
    g.current.startGame?.();
  }

  return (
    <div>
      {overlay.show && (
        <div className={styles.overlay}>
          <h1>{overlay.title}</h1>
          {overlay.scoreText && <p className={styles.scoreDisplay}>{overlay.scoreText}</p>}
          <button onClick={handleStart}>{overlay.btnText}</button>
        </div>
      )}
      <div className={styles.gameContainer}>
        <canvas ref={boardRef} width={300} height={600} className={styles.canvas} />
        <div className={styles.sidebar}>
          <div className={styles.panel}>
            <h3>Score</h3>
            <div className={styles.value}>{stats.score}</div>
          </div>
          <div className={styles.panel}>
            <h3>Level</h3>
            <div className={styles.value}>{stats.level}</div>
          </div>
          <div className={styles.panel}>
            <h3>Lines</h3>
            <div className={styles.value}>{stats.lines}</div>
          </div>
          <div className={styles.panel}>
            <h3>Next</h3>
            <canvas ref={nextRef} width={120} height={80} className={styles.nextCanvas} />
          </div>
          <div className={`${styles.panel} ${styles.controls}`}>
            <span>← →</span> Move<br />
            <span>↑</span> Rotate<br />
            <span>↓</span> Soft drop<br />
            <span>Space</span> Hard drop<br />
            <span>P</span> Pause
          </div>
        </div>
      </div>
    </div>
  );
}
