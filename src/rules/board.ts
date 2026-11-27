/**
 * Board rules: pure functions over a grid of tile type ids.
 *
 * Nothing in this file knows about Phaser, the screen or touch input.
 * Functions never change the board they are given; they return a new one.
 */

import type { RulesConfig } from '../config';
import { randomInt, type Rng } from './rng';

/** A grid position. Row 0 is the top row, column 0 is the left column. */
export interface Cell {
  row: number;
  col: number;
}

/** board[row][col] holds a tile type id, or EMPTY while a cell is cleared. */
export type Board = number[][];

/** Marker for a cleared cell that is waiting for a refill. */
export const EMPTY = -1;

/** Copy a board so the original is left untouched. */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

/** True if the two cells share an edge (diagonals do not count). */
export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/** True if the cell is inside the board. */
export function inBounds(board: Board, cell: Cell): boolean {
  return (
    cell.row >= 0 &&
    cell.row < board.length &&
    cell.col >= 0 &&
    cell.col < board[0].length
  );
}

/** Return a new board with the tiles at a and b exchanged. */
export function swapCells(board: Board, a: Cell, b: Cell): Board {
  const next = cloneBoard(board);
  next[a.row][a.col] = board[b.row][b.col];
  next[b.row][b.col] = board[a.row][a.col];
  return next;
}

/**
 * Find every cell that is part of a horizontal or vertical line of
 * minLine or more matching tiles. A cell in two lines is returned once.
 */
export function findLines(board: Board, minLine: number): Cell[] {
  const rows = board.length;
  const cols = board[0].length;
  // Flags so a cell shared by a row line and a column line is counted once.
  const hit: boolean[][] = board.map((row) => row.map(() => false));

  // Scan each row for runs of the same type.
  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= cols; c++) {
      const runEnded = c === cols || board[r][c] !== board[r][runStart];
      if (runEnded) {
        if (board[r][runStart] !== EMPTY && c - runStart >= minLine) {
          for (let k = runStart; k < c; k++) hit[r][k] = true;
        }
        runStart = c;
      }
    }
  }

  // Scan each column the same way.
  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= rows; r++) {
      const runEnded = r === rows || board[r][c] !== board[runStart][c];
      if (runEnded) {
        if (board[runStart][c] !== EMPTY && r - runStart >= minLine) {
          for (let k = runStart; k < r; k++) hit[k][c] = true;
        }
        runStart = r;
      }
    }
  }

  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (hit[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/**
 * Length of the unbroken run of `type` through `cell` along one axis,
 * counting the cell itself. (dRow, dCol) is the axis direction.
 */
function runLength(
  board: Board,
  cell: Cell,
  type: number,
  dRow: number,
  dCol: number,
): number {
  let length = 1;
  // Walk both ways along the axis.
  for (const sign of [1, -1]) {
    let r = cell.row + dRow * sign;
    let c = cell.col + dCol * sign;
    while (inBounds(board, { row: r, col: c }) && board[r][c] === type) {
      length++;
      r += dRow * sign;
      c += dCol * sign;
    }
  }
  return length;
}

/** Would putting `type` at `cell` make a line through that cell? */
export function wouldFormLine(
  board: Board,
  cell: Cell,
  type: number,
  minLine: number,
): boolean {
  return (
    runLength(board, cell, type, 0, 1) >= minLine ||
    runLength(board, cell, type, 1, 0) >= minLine
  );
}

/**
 * Pick a random type for `cell` that forms no line with the tiles already
 * on the board.
 *
 * With minLine 3, the tiles beside a cell can rule out at most two types
 * across and two types down, so five or more types always leaves a safe
 * pick. If a config breaks that, fall back to any type rather than hang.
 */
function pickSafeType(
  board: Board,
  cell: Cell,
  config: RulesConfig,
  rng: Rng,
): number {
  const safe: number[] = [];
  for (let type = 0; type < config.tileTypes; type++) {
    if (!wouldFormLine(board, cell, type, config.minLine)) safe.push(type);
  }
  if (safe.length === 0) return randomInt(rng, config.tileTypes);
  return safe[randomInt(rng, safe.length)];
}

/**
 * Refill the given cells in place (no gravity) with tiles that form no
 * new line, so a clear never cascades. Returns a new board.
 */
export function refillCells(
  board: Board,
  cells: Cell[],
  config: RulesConfig,
  rng: Rng,
): Board {
  const next = cloneBoard(board);
  // Empty every target first so old tiles cannot affect the picks.
  for (const cell of cells) next[cell.row][cell.col] = EMPTY;
  // Fill one at a time; each pick sees the tiles placed before it.
  for (const cell of cells) {
    next[cell.row][cell.col] = pickSafeType(next, cell, config, rng);
  }
  return next;
}

/** Every pair of adjacent cells, as [cell, right neighbour or lower neighbour]. */
function adjacentPairs(board: Board): [Cell, Cell][] {
  const pairs: [Cell, Cell][] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      if (c + 1 < board[0].length) {
        pairs.push([
          { row: r, col: c },
          { row: r, col: c + 1 },
        ]);
      }
      if (r + 1 < board.length) {
        pairs.push([
          { row: r, col: c },
          { row: r + 1, col: c },
        ]);
      }
    }
  }
  return pairs;
}

/** All swaps that would make at least one line. */
export function findValidSwaps(board: Board, minLine: number): [Cell, Cell][] {
  return adjacentPairs(board).filter(
    ([a, b]) => findLines(swapCells(board, a, b), minLine).length > 0,
  );
}

/** True if the player has at least one swap that makes a line. */
export function hasValidSwap(board: Board, minLine: number): boolean {
  return findValidSwaps(board, minLine).length > 0;
}

/**
 * Build a start board: no lines already on it, and at least one valid swap.
 */
export function createBoard(config: RulesConfig, rng: Rng): Board {
  // A board with no valid swap is rare, so retrying is cheap. The attempt
  // cap only guards against a config that can never produce a valid board.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const empty: Board = Array.from({ length: config.rows }, () =>
      Array.from({ length: config.cols }, () => EMPTY),
    );
    const allCells: Cell[] = [];
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) allCells.push({ row: r, col: c });
    }
    const board = refillCells(empty, allCells, config, rng);
    if (
      findLines(board, config.minLine).length === 0 &&
      hasValidSwap(board, config.minLine)
    ) {
      return board;
    }
  }
  throw new Error('Could not build a start board. Check the rules config.');
}

/**
 * Rearrange the tiles already on the board until there are no lines and
 * at least one valid swap. Used when the player has run out of swaps.
 */
export function reshuffleBoard(
  board: Board,
  config: RulesConfig,
  rng: Rng,
): Board {
  const tiles = board.flat();
  for (let attempt = 0; attempt < 200; attempt++) {
    // Fisher-Yates shuffle of the existing tiles.
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = randomInt(rng, i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const next: Board = [];
    for (let r = 0; r < config.rows; r++) {
      next.push(tiles.slice(r * config.cols, (r + 1) * config.cols));
    }
    if (
      findLines(next, config.minLine).length === 0 &&
      hasValidSwap(next, config.minLine)
    ) {
      return next;
    }
  }
  // The same tiles cannot be arranged into a playable board: deal a new one.
  return createBoard(config, rng);
}
