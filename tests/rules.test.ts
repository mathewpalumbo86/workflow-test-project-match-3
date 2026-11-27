/**
 * Unit tests for the game rules. One describe block per line of the
 * "Unit tests" section in docs/spec.md. Run with: npm test
 */

import { describe, expect, it } from 'vitest';
import { RULES, type RulesConfig } from '../src/config';
import tiles from '../src/data/tiles.json';
import {
  createBoard,
  findLines,
  findValidSwaps,
  hasValidSwap,
  refillCells,
  reshuffleBoard,
  type Board,
  type Cell,
} from '../src/rules/board';
import { newGame, trySwap, type GameState } from '../src/rules/game';
import { createRng } from '../src/rules/rng';

/** Small fixed config so hand-written boards are easy to read. */
const CONFIG: RulesConfig = {
  cols: 4,
  rows: 4,
  tileTypes: 5,
  minLine: 3,
  moveLimit: 2,
  targetScore: 30,
  pointsPerTile: 10,
};

/**
 * A 4x4 board with no lines. Swapping (0,2) with (1,2) brings the 0 up
 * to complete a line of three 0s along the top row.
 */
const BOARD: Board = [
  [0, 0, 1, 2],
  [3, 4, 0, 1],
  [1, 2, 3, 4],
  [4, 3, 2, 1],
];
const VALID_A: Cell = { row: 0, col: 2 };
const VALID_B: Cell = { row: 1, col: 2 };

/** Wrap a board in a fresh game state. */
function stateFor(board: Board, movesLeft = CONFIG.moveLimit): GameState {
  return { board, score: 0, movesLeft, status: 'playing' };
}

/** Sort cells into a stable order so they can be compared. */
function sorted(cells: Cell[]): Cell[] {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe('finds horizontal and vertical lines', () => {
  it('finds a horizontal line', () => {
    const board: Board = [
      [0, 0, 0, 1],
      [1, 2, 3, 4],
      [2, 3, 4, 0],
      [3, 4, 0, 1],
    ];
    expect(sorted(findLines(board, 3))).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it('finds a vertical line', () => {
    const board: Board = [
      [0, 1, 2, 3],
      [0, 2, 3, 4],
      [0, 3, 4, 1],
      [1, 4, 0, 2],
    ];
    expect(sorted(findLines(board, 3))).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);
  });

  it('counts a cell shared by two lines once', () => {
    const board: Board = [
      [0, 0, 0, 1],
      [0, 2, 3, 4],
      [0, 3, 4, 1],
      [1, 4, 2, 2],
    ];
    expect(findLines(board, 3)).toHaveLength(5);
  });

  it('finds a line of four', () => {
    const board: Board = [
      [1, 1, 1, 1],
      [0, 2, 3, 4],
      [2, 3, 4, 0],
      [3, 4, 0, 2],
    ];
    expect(findLines(board, 3)).toHaveLength(4);
  });

  it('finds nothing on a board with no lines', () => {
    expect(findLines(BOARD, 3)).toEqual([]);
  });
});

describe('rejects an invalid swap and uses no move', () => {
  it('rejects a swap that makes no line', () => {
    const state = stateFor(BOARD);
    const result = trySwap(
      state,
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      CONFIG,
      createRng(1),
    );
    expect(result.valid).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.movesLeft).toBe(CONFIG.moveLimit);
    expect(result.state.score).toBe(0);
  });

  it('rejects tiles that are not adjacent', () => {
    const state = stateFor(BOARD);
    const diagonal = trySwap(
      state,
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      CONFIG,
      createRng(1),
    );
    const apart = trySwap(
      state,
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      CONFIG,
      createRng(1),
    );
    expect(diagonal.valid).toBe(false);
    expect(apart.valid).toBe(false);
  });

  it('rejects a cell that is off the board', () => {
    const result = trySwap(
      stateFor(BOARD),
      { row: 0, col: 0 },
      { row: -1, col: 0 },
      CONFIG,
      createRng(1),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects any swap once the game is over', () => {
    const state: GameState = { ...stateFor(BOARD), status: 'lost' };
    const result = trySwap(state, VALID_A, VALID_B, CONFIG, createRng(1));
    expect(result.valid).toBe(false);
    expect(result.state).toBe(state);
  });
});

describe('applies a valid swap: clears, scores, uses one move', () => {
  const result = trySwap(stateFor(BOARD), VALID_A, VALID_B, CONFIG, createRng(1));

  it('accepts the swap', () => {
    expect(result.valid).toBe(true);
  });

  it('clears the three tiles in the line', () => {
    expect(sorted(result.cleared)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it('scores points per cleared tile', () => {
    expect(result.points).toBe(30);
    expect(result.state.score).toBe(30);
  });

  it('uses exactly one move', () => {
    expect(result.state.movesLeft).toBe(CONFIG.moveLimit - 1);
  });

  it('moves the swapped tile and leaves the rest alone', () => {
    // On a board this small a refill can leave no swaps and trigger a
    // reshuffle, which moves everything. Use a seed where that did not happen.
    let seed = 0;
    let quiet = trySwap(stateFor(BOARD), VALID_A, VALID_B, CONFIG, createRng(seed));
    while (quiet.reshuffled) {
      seed++;
      quiet = trySwap(stateFor(BOARD), VALID_A, VALID_B, CONFIG, createRng(seed));
    }
    // The 1 from (0,2) went down to (1,2).
    expect(quiet.state.board[1][2]).toBe(1);
    // Rows 2 and 3 were not involved.
    expect(quiet.state.board[2]).toEqual(BOARD[2]);
    expect(quiet.state.board[3]).toEqual(BOARD[3]);
  });

  it('does not change the board it was given', () => {
    expect(BOARD[0]).toEqual([0, 0, 1, 2]);
  });
});

describe('refill creates no lines', () => {
  it('leaves no lines after a valid swap', () => {
    for (let seed = 0; seed < 200; seed++) {
      const result = trySwap(
        stateFor(BOARD),
        VALID_A,
        VALID_B,
        CONFIG,
        createRng(seed),
      );
      expect(findLines(result.state.board, CONFIG.minLine)).toEqual([]);
    }
  });

  it('fills every cleared cell with a real tile type', () => {
    const cells: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    const board = refillCells(BOARD, cells, CONFIG, createRng(7));
    for (const cell of cells) {
      const type = board[cell.row][cell.col];
      expect(type).toBeGreaterThanOrEqual(0);
      expect(type).toBeLessThan(CONFIG.tileTypes);
    }
  });

  it('stays line-free through whole games played at random', () => {
    // Play full games with the real config, always taking a valid swap.
    for (let seed = 0; seed < 25; seed++) {
      const rng = createRng(seed);
      let state = newGame(RULES, rng);
      while (state.status === 'playing') {
        const swaps = findValidSwaps(state.board, RULES.minLine);
        const [a, b] = swaps[Math.floor(rng() * swaps.length)];
        state = trySwap(state, a, b, RULES, rng).state;
        expect(findLines(state.board, RULES.minLine)).toEqual([]);
      }
    }
  });
});

describe('start board has no lines and at least one valid swap', () => {
  it('holds for many seeds with the real config', () => {
    for (let seed = 0; seed < 200; seed++) {
      const board = createBoard(RULES, createRng(seed));
      expect(board).toHaveLength(RULES.rows);
      expect(board[0]).toHaveLength(RULES.cols);
      expect(findLines(board, RULES.minLine)).toEqual([]);
      expect(hasValidSwap(board, RULES.minLine)).toBe(true);
    }
  });

  it('gives the same board for the same seed', () => {
    expect(createBoard(RULES, createRng(42))).toEqual(
      createBoard(RULES, createRng(42)),
    );
  });

  it('starts a game with zero score and the full move limit', () => {
    const state = newGame(RULES, createRng(1));
    expect(state.score).toBe(0);
    expect(state.movesLeft).toBe(RULES.moveLimit);
    expect(state.status).toBe('playing');
  });
});

describe('reshuffles when no valid swap exists', () => {
  /** Same tile counts as a playable board, but arranged with no swaps. */
  const STUCK: Board = [
    [0, 1, 2, 3],
    [2, 3, 0, 1],
    [0, 1, 2, 3],
    [2, 3, 0, 1],
  ];

  it('recognises a board with no valid swap', () => {
    expect(findLines(STUCK, 3)).toEqual([]);
    expect(hasValidSwap(STUCK, 3)).toBe(false);
  });

  it('reshuffles into a playable board with no lines', () => {
    for (let seed = 0; seed < 50; seed++) {
      const board = reshuffleBoard(STUCK, CONFIG, createRng(seed));
      expect(findLines(board, CONFIG.minLine)).toEqual([]);
      expect(hasValidSwap(board, CONFIG.minLine)).toBe(true);
    }
  });

  it('never leaves the player stuck during a game', () => {
    for (let seed = 0; seed < 25; seed++) {
      const rng = createRng(seed);
      let state = newGame(RULES, rng);
      while (state.status === 'playing') {
        const swaps = findValidSwaps(state.board, RULES.minLine);
        expect(swaps.length).toBeGreaterThan(0);
        state = trySwap(state, swaps[0][0], swaps[0][1], RULES, rng).state;
      }
    }
  });
});

describe('ends at zero moves with the correct win or lose result', () => {
  it('keeps playing while moves remain', () => {
    const result = trySwap(stateFor(BOARD, 2), VALID_A, VALID_B, CONFIG, createRng(1));
    expect(result.state.movesLeft).toBe(1);
    expect(result.state.status).toBe('playing');
  });

  it('wins when the last move reaches the target', () => {
    // One move left, target 30, the swap scores 30.
    const result = trySwap(stateFor(BOARD, 1), VALID_A, VALID_B, CONFIG, createRng(1));
    expect(result.state.movesLeft).toBe(0);
    expect(result.state.status).toBe('won');
  });

  it('loses when the last move falls short of the target', () => {
    const hard: RulesConfig = { ...CONFIG, targetScore: 31 };
    const result = trySwap(stateFor(BOARD, 1), VALID_A, VALID_B, hard, createRng(1));
    expect(result.state.movesLeft).toBe(0);
    expect(result.state.status).toBe('lost');
  });

  it('ends a full game after exactly the move limit', () => {
    const rng = createRng(3);
    let state = newGame(RULES, rng);
    let validSwaps = 0;
    while (state.status === 'playing') {
      const [a, b] = findValidSwaps(state.board, RULES.minLine)[0];
      state = trySwap(state, a, b, RULES, rng).state;
      validSwaps++;
    }
    expect(validSwaps).toBe(RULES.moveLimit);
    expect(state.movesLeft).toBe(0);
    expect(state.status).toBe(
      state.score >= RULES.targetScore ? 'won' : 'lost',
    );
  });
});

describe('config and data agree', () => {
  it('has a tile entry for every tile type in play', () => {
    expect(tiles.length).toBeGreaterThanOrEqual(RULES.tileTypes);
  });

  it('uses enough tile types for a refill to always be safe', () => {
    expect(RULES.tileTypes).toBeGreaterThanOrEqual(5);
  });
});
