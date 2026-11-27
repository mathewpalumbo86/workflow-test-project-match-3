/**
 * The one screen of the game: draws the board and HUD, and turns taps
 * into swap attempts.
 *
 * This file holds no game rules. It asks rules/game.ts what a swap did
 * (trySwap) and then animates the result.
 */

import * as Phaser from 'phaser';
import { RULES, VIEW } from '../config';
import tileData from '../data/tiles.json';
import { isAdjacent, type Cell } from '../rules/board';
import { newGame, trySwap, type GameState } from '../rules/game';
import { createRng, type Rng } from '../rules/rng';

/** One entry of data/tiles.json. */
interface TileDef {
  id: number;
  colour: string;
  shape: string;
}

const TILES = tileData as TileDef[];

export class GameScene extends Phaser.Scene {
  /** Current rules state. Replaced after every valid swap. */
  private state!: GameState;
  private rng!: Rng;

  /** tiles[row][col] is the drawn shape for that cell. */
  private tiles: Phaser.GameObjects.Graphics[][] = [];
  /** White outline around the selected tile. */
  private selectMarker!: Phaser.GameObjects.Graphics;
  private selected: Cell | null = null;

  /** True while an animation is running; taps are ignored until it ends. */
  private busy = false;

  private scoreText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  /** Everything in the end-of-game overlay, so it can be removed in one go. */
  private overlay: Phaser.GameObjects.GameObject[] = [];

  /** Size of one grid cell in game pixels, worked out from the config. */
  private cellSize = 0;

  constructor() {
    super('game');
  }

  create(): void {
    this.cellSize = (VIEW.width - VIEW.gridMargin * 2) / RULES.cols;
    // A new seed each load, so every game deals a different board.
    this.rng = createRng(Date.now());

    this.drawHud();
    this.drawGridBackground();

    this.selectMarker = this.add.graphics();
    this.selectMarker.setDepth(5);
    this.selectMarker.setVisible(false);

    // One listener for the whole screen. The tapped cell is worked out
    // from the position, which keeps input simple and easy to change.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleTap(pointer.x, pointer.y);
    });

    this.startGame();
  }

  // ---------------------------------------------------------------------
  // Set-up
  // ---------------------------------------------------------------------

  /** Begin a fresh game and draw its board. */
  private startGame(): void {
    for (const item of this.overlay) item.destroy();
    this.overlay = [];

    this.state = newGame(RULES, this.rng);
    this.select(null);
    this.redrawAllTiles();
    this.updateHud();
    this.busy = false;
  }

  /** Top of screen: score, target and moves left. Bottom: build number. */
  private drawHud(): void {
    const style = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: VIEW.textColour,
    };
    const centreX = VIEW.width / 2;

    this.scoreText = this.add
      .text(centreX, 90, '', { ...style, fontSize: '72px', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add
      .text(centreX, 165, `Target ${RULES.targetScore}`, {
        ...style,
        fontSize: '34px',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
    this.movesText = this.add
      .text(centreX, 230, '', { ...style, fontSize: '40px' })
      .setOrigin(0.5);

    // Build number: if this does not change after a deploy, the phone is
    // showing a cached copy of the old build.
    this.add
      .text(centreX, VIEW.height - 40, `Build ${__BUILD_NUMBER__}`, {
        ...style,
        fontSize: '26px',
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
  }

  /** A dark rounded square behind every cell. Drawn once. */
  private drawGridBackground(): void {
    const background = this.add.graphics();
    background.fillStyle(VIEW.cellColour, 1);
    const pad = 4;
    for (let row = 0; row < RULES.rows; row++) {
      for (let col = 0; col < RULES.cols; col++) {
        const centre = this.cellCentre({ row, col });
        background.fillRoundedRect(
          centre.x - this.cellSize / 2 + pad,
          centre.y - this.cellSize / 2 + pad,
          this.cellSize - pad * 2,
          this.cellSize - pad * 2,
          12,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Layout helpers
  // ---------------------------------------------------------------------

  /** Screen position of the middle of a cell. */
  private cellCentre(cell: Cell): { x: number; y: number } {
    return {
      x: VIEW.gridMargin + cell.col * this.cellSize + this.cellSize / 2,
      y: VIEW.gridTop + cell.row * this.cellSize + this.cellSize / 2,
    };
  }

  /** The cell under a screen position, or null if outside the grid. */
  private cellAt(x: number, y: number): Cell | null {
    const col = Math.floor((x - VIEW.gridMargin) / this.cellSize);
    const row = Math.floor((y - VIEW.gridTop) / this.cellSize);
    if (row < 0 || row >= RULES.rows || col < 0 || col >= RULES.cols) {
      return null;
    }
    return { row, col };
  }

  // ---------------------------------------------------------------------
  // Drawing tiles
  // ---------------------------------------------------------------------

  /** Create the placeholder shape for a tile type, centred on a cell. */
  private makeTile(type: number, cell: Cell): Phaser.GameObjects.Graphics {
    const def = TILES[type];
    const colour = parseInt(def.colour.slice(1), 16);
    // Half the width of the shape.
    const r = (this.cellSize * VIEW.tileFill) / 2;

    const g = this.add.graphics();
    g.fillStyle(colour, 1);

    // Each shape is drawn around (0, 0) so the tile can be moved and
    // scaled about its own centre.
    switch (def.shape) {
      case 'circle':
        g.fillCircle(0, 0, r);
        break;
      case 'square':
        g.fillRoundedRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, 10);
        break;
      case 'triangle':
        g.fillTriangle(0, -r, r, r * 0.85, -r, r * 0.85);
        break;
      case 'diamond':
        g.fillPoints(this.polygon(4, r, -90), true);
        break;
      case 'hexagon':
        g.fillPoints(this.polygon(6, r, 0), true);
        break;
      default:
        // Unknown shape name in tiles.json: still draw something visible.
        g.fillRect(-r, -r, r * 2, r * 2);
    }

    const centre = this.cellCentre(cell);
    g.setPosition(centre.x, centre.y);
    return g;
  }

  /** Corner points of a regular polygon centred on (0, 0). */
  private polygon(
    sides: number,
    radius: number,
    startDegrees: number,
  ): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = Phaser.Math.DegToRad(startDegrees + (360 / sides) * i);
      points.push(
        new Phaser.Math.Vector2(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        ),
      );
    }
    return points;
  }

  /** Throw away every tile shape and draw the board from the state. */
  private redrawAllTiles(): void {
    for (const row of this.tiles) {
      for (const tile of row) tile.destroy();
    }
    this.tiles = this.state.board.map((rowTypes, row) =>
      rowTypes.map((type, col) => this.makeTile(type, { row, col })),
    );
  }

  /** Move the selection outline to a cell, or hide it with null. */
  private select(cell: Cell | null): void {
    this.selected = cell;
    if (!cell) {
      this.selectMarker.setVisible(false);
      return;
    }
    const centre = this.cellCentre(cell);
    const half = this.cellSize / 2 - 3;
    this.selectMarker.clear();
    this.selectMarker.lineStyle(6, VIEW.selectColour, 1);
    this.selectMarker.strokeRoundedRect(
      centre.x - half,
      centre.y - half,
      half * 2,
      half * 2,
      12,
    );
    this.selectMarker.setVisible(true);
  }

  private updateHud(): void {
    this.scoreText.setText(String(this.state.score));
    this.movesText.setText(`Moves left ${this.state.movesLeft}`);
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  /**
   * Controls from the spec:
   * - tap a tile to select it
   * - tap an adjacent tile to swap
   * - tap the selected tile again to deselect
   * - once the game is over, tap anywhere to restart
   */
  private handleTap(x: number, y: number): void {
    if (this.busy) return;

    if (this.state.status !== 'playing') {
      this.startGame();
      return;
    }

    const cell = this.cellAt(x, y);
    if (!cell) {
      this.select(null);
      return;
    }

    const current = this.selected;
    if (!current) {
      this.select(cell);
    } else if (current.row === cell.row && current.col === cell.col) {
      this.select(null);
    } else if (isAdjacent(current, cell)) {
      this.select(null);
      void this.playSwap(current, cell);
    } else {
      // Tapped a tile further away: treat it as a new selection.
      this.select(cell);
    }
  }

  // ---------------------------------------------------------------------
  // Swap and its animations
  // ---------------------------------------------------------------------

  /** Ask the rules what the swap does, then animate that result. */
  private async playSwap(a: Cell, b: Cell): Promise<void> {
    this.busy = true;

    const result = trySwap(this.state, a, b, RULES, this.rng);
    const tileA = this.tiles[a.row][a.col];
    const tileB = this.tiles[b.row][b.col];
    const posA = this.cellCentre(a);
    const posB = this.cellCentre(b);

    // Slide the two tiles into each other's cells.
    await Promise.all([
      this.tween(tileA, { x: posB.x, y: posB.y }, VIEW.swapMs),
      this.tween(tileB, { x: posA.x, y: posA.y }, VIEW.swapMs),
    ]);

    if (!result.valid) {
      // No line made: slide them back. No move was used.
      await Promise.all([
        this.tween(tileA, { x: posA.x, y: posA.y }, VIEW.swapMs),
        this.tween(tileB, { x: posB.x, y: posB.y }, VIEW.swapMs),
      ]);
      this.busy = false;
      return;
    }

    // The swap stands: keep the tile grid in step with the board.
    this.tiles[a.row][a.col] = tileB;
    this.tiles[b.row][b.col] = tileA;
    this.state = result.state;

    // Shrink the cleared tiles away.
    await Promise.all(
      result.cleared.map((cell) =>
        this.tween(this.tiles[cell.row][cell.col], { scale: 0 }, VIEW.clearMs),
      ),
    );
    this.updateHud();

    if (result.reshuffled) {
      // The rules rearranged the whole board, so draw all of it again.
      this.redrawAllTiles();
    } else {
      // Replace each cleared tile with its refill and grow it in.
      await Promise.all(
        result.cleared.map((cell) => {
          this.tiles[cell.row][cell.col].destroy();
          const type = this.state.board[cell.row][cell.col];
          const tile = this.makeTile(type, cell);
          tile.setScale(0);
          this.tiles[cell.row][cell.col] = tile;
          return this.tween(tile, { scale: 1 }, VIEW.clearMs);
        }),
      );
    }

    if (this.state.status !== 'playing') {
      this.showEndOverlay();
      // Short pause so a tap meant for the board does not restart at once.
      await new Promise<void>((resolve) => {
        this.time.delayedCall(500, () => resolve());
      });
    }
    this.busy = false;
  }

  /** Run one tween and resolve when it finishes. */
  private tween(
    target: Phaser.GameObjects.Graphics,
    props: Record<string, number>,
    duration: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        ...props,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  // ---------------------------------------------------------------------
  // End of game
  // ---------------------------------------------------------------------

  /** Dim the screen and show the result, score and restart prompt. */
  private showEndOverlay(): void {
    const won = this.state.status === 'won';
    const centreX = VIEW.width / 2;
    const centreY = VIEW.height / 2;
    const style = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: VIEW.textColour,
    };

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, VIEW.width, VIEW.height);
    dim.setDepth(10);

    const title = this.add
      .text(centreX, centreY - 110, won ? 'You win' : 'Out of moves', {
        ...style,
        fontSize: '84px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11);
    const score = this.add
      .text(
        centreX,
        centreY,
        `Score ${this.state.score} / ${RULES.targetScore}`,
        { ...style, fontSize: '44px' },
      )
      .setOrigin(0.5)
      .setDepth(11);
    const prompt = this.add
      .text(centreX, centreY + 110, 'Tap to restart', {
        ...style,
        fontSize: '40px',
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setAlpha(0.8);

    this.overlay = [dim, title, score, prompt];
  }
}
