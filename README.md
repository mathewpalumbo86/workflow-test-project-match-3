# Workflow Test Project (Match 3)

Technical notes only. Design and status live on the Notion page; the signed-off spec is copied to [docs/spec.md](docs/spec.md).

## Concept

- Match-3 lite, built to test the phone game dev workflow
- Tap a tile, then tap a neighbour, to swap them and make a line of 3 or more
- Beat the target score within the move limit

## Current state

- First playable: one screen, placeholder shapes, no audio
- No gravity, cascades or special tiles (see "Out of scope" in the spec)
- Runs per session only: no saved data, accounts or backend

## Play

- URL: https://mathewpalumbo86.github.io/workflow-test-project-match-3/
- The build number is shown at the bottom of the screen. If it has not gone up after a deploy, the browser is showing a cached copy: reload the page.

## How to run

```
npm install
npm test        # rules unit tests
npm run dev     # local dev server
npm run build   # type-check and build to dist/
```

## Deploy

- Every push to `main` runs `.github/workflows/deploy.yml`
- Steps: install, unit tests, build, publish to GitHub Pages
- A failing test stops the deploy
- One-off setup: repo Settings → Pages → Source → "GitHub Actions"

## Structure

| Path | Purpose |
| --- | --- |
| `src/config.ts` | Every tunable value (grid size, move limit, target score, sizes, timings) |
| `src/data/tiles.json` | Tile types: id, colour, shape |
| `src/rules/` | Game rules. Pure TypeScript, no Phaser, no input |
| `src/scenes/GameScene.ts` | Rendering and touch input. No rules |
| `src/main.ts` | Boots Phaser and shows errors on screen |
| `tests/rules.test.ts` | Unit tests, one block per test listed in the spec |
| `docs/spec.md` | Copy of the signed-off design spec |

## Stack

- Phaser 4, TypeScript, Vite, Vitest

## Known issues

- None yet
