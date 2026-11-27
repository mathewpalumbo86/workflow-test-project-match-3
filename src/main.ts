/**
 * Entry point: on-screen error reporting, then boot Phaser.
 */

import * as Phaser from 'phaser';
import { VIEW } from './config';
import { GameScene } from './scenes/GameScene';

/**
 * Show an error in the red box at the bottom of the page.
 * A phone browser has no console, so this is how bugs get reported.
 */
function showError(message: string): void {
  const box = document.getElementById('error');
  if (!box) return;
  box.style.display = 'block';
  box.textContent += `[build ${__BUILD_NUMBER__}] ${message}\n`;
}

window.addEventListener('error', (event) => {
  showError(`${event.message} (${event.filename}:${event.lineno})`);
});
window.addEventListener('unhandledrejection', (event) => {
  showError(`Unhandled promise rejection: ${String(event.reason)}`);
});

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: VIEW.backgroundColour,
  scale: {
    // Scale the fixed portrait design to fit any phone, keeping its shape.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
