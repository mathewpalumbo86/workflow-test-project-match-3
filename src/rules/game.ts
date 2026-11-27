/**
 * Game rules: score, moves and win or lose, built on the board rules.
 *
 * Like board.ts, this file is pure. The scene calls trySwap and then draws
 * whatever the result says happened.
 */

import type { RulesConfig } from '../config';
import {
  createBoard,
  findLines,
  hasValidSwap,
  inBounds,
  isAdjacent,
  refillCells,
  reshuffleBoard,
  swapCells,
  type Board,
  type Cell,
} from './board';
import type { Rng } from './rng';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  board: Board;
  score: number;
  movesLeft: number;
  status: GameStatus;
}

/** What a swap attempt did. The scene uses this to pick its animations. */
export interface SwapResult {
  /** The state after the attempt. Unchanged if the swap was not valid. */
  state: GameState;
  /** True if the swap made a line and was applied. */
  valid: boolean;
  /** Cells that were cleared and refilled. Empty if not valid. */
  cleared: Cell[];
  /** Points scored by this swap. */
  points: number;
  /** True if the board had no swaps left afterwards and was reshuffled. */
  reshuffled: boolean;
}

/** Start a new game. */
export function newGame(config: RulesConfig, rng: Rng): GameState {
  return {
    board: createBoard(config, rng),
    score: 0,
    movesLeft: config.moveLimit,
    status: 'playing',
  };
}

/**
 * Try to swap two tiles.
 *
 * - Not valid (game over, off the board, not adjacent, or no line made):
 *   the state comes back unchanged and no move is used.
 * - Valid: one move is used, the lines are cleared and scored, the cleared
 *   cells refill in place, and the game ends if that was the last move.
 */
export function trySwap(
  state: GameState,
  a: Cell,
  b: Cell,
  config: RulesConfig,
  rng: Rng,
): SwapResult {
  const rejected: SwapResult = {
    state,
    valid: false,
    cleared: [],
    points: 0,
    reshuffled: false,
  };

  if (state.status !== 'playing') return rejected;
  if (!inBounds(state.board, a) || !inBounds(state.board, b)) return rejected;
  if (!isAdjacent(a, b)) return rejected;

  const swapped = swapCells(state.board, a, b);
  const cleared = findLines(swapped, config.minLine);
  if (cleared.length === 0) return rejected;

  const points = cleared.length * config.pointsPerTile;
  const score = state.score + points;
  const movesLeft = state.movesLeft - 1;
  let board = refillCells(swapped, cleared, config, rng);

  // Out of moves: the result depends only on the score.
  let status: GameStatus = 'playing';
  if (movesLeft <= 0) {
    status = score >= config.targetScore ? 'won' : 'lost';
  }

  // Still playing but stuck: rearrange the board so play can go on.
  let reshuffled = false;
  if (status === 'playing' && !hasValidSwap(board, config.minLine)) {
    board = reshuffleBoard(board, config, rng);
    reshuffled = true;
  }

  return {
    state: { board, score, movesLeft, status },
    valid: true,
    cleared,
    points,
    reshuffled,
  };
}
