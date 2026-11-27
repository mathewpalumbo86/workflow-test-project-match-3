/**
 * All tunable values for the game live here.
 * Change a number, push, and the next deploy picks it up.
 */

/** Values the game rules need. Kept free of any rendering concerns. */
export interface RulesConfig {
  /** Number of columns in the grid. */
  cols: number;
  /** Number of rows in the grid. */
  rows: number;
  /**
   * How many tile types are in play. Must be 5 or more so a refill can
   * always find a type that forms no line (see refillCells in rules/board.ts),
   * and no more than the number of entries in data/tiles.json.
   */
  tileTypes: number;
  /** Shortest line that counts as a match. */
  minLine: number;
  /** Valid swaps the player gets per game. */
  moveLimit: number;
  /** Score needed to win. */
  targetScore: number;
  /** Points scored for each cleared tile. */
  pointsPerTile: number;
}

export const RULES: RulesConfig = {
  cols: 6,
  rows: 6,
  tileTypes: 5,
  minLine: 3,
  moveLimit: 30,
  targetScore: 1000,
  pointsPerTile: 10,
};

/** Values only the screen cares about (sizes in game pixels, times in ms). */
export const VIEW = {
  /** Design resolution. Portrait. Phaser scales this to fit the phone. */
  width: 720,
  height: 1280,
  /** Gap between the grid and the left and right screen edges. */
  gridMargin: 30,
  /** Y position of the top of the grid. */
  gridTop: 300,
  /** Fraction of a cell that the tile shape fills. */
  tileFill: 0.8,
  /** Duration of the swap animation. */
  swapMs: 140,
  /** Duration of the clear and refill animations. */
  clearMs: 160,
  backgroundColour: 0x1b1f2a,
  cellColour: 0x2a3040,
  selectColour: 0xffffff,
  textColour: '#f2f2f2',
};
