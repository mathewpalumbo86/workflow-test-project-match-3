# Workflow Test Project (Match 3): design spec

Copy of the spec signed off on 27 November 2026. The Notion page is the source of truth for design and status; update it first, then this copy.

## Concept

- Match-3 lite, built to test the workflow
- Swap tiles to make lines of 3 or more
- Beat the target score within the move limit

## Core rules

- Grid of tiles, each one of several types
- A swap is two orthogonally adjacent tiles
- A swap is valid only if it makes a horizontal or vertical line of 3 or more
- An invalid swap reverts and uses no move
- A valid swap uses one move, clears the matched tiles and scores per tile
- Cleared cells refill in place with tiles that form no new line (no gravity, no cascades)
- The start board has no lines and at least one valid swap
- If no valid swap exists, the board reshuffles

## Controls

- Tap a tile to select it, tap an adjacent tile to swap
- Tap the selected tile again to deselect

## Win and lose conditions

- The game ends when moves reach zero
- Win: score at or above target
- Lose: score below target
- Tap to restart

## Screen layout

- Portrait, single screen
- Top: score, target, moves left
- Middle: grid
- Bottom: build number
- End overlay: result and restart

## First-playable scope

- Everything above, with placeholder shapes
- Deployed to a URL that opens on a phone
- Build number on screen
- Unit tests passing before deploy

## Out of scope

- Gravity, cascades and special tiles
- Animation beyond a simple swap and clear
- Audio
- Levels, menus, saves

## Engine and language

- Phaser 4, TypeScript, Vite, Vitest
- Phone limits: no browser console, so errors show on screen
- Phone limits: no local build, so every test goes through a deploy

## Config values

- Grid columns: 6
- Grid rows: 6
- Tile types: 5
- Minimum line length: 3
- Move limit: 30
- Target score: 1000
- Points per tile: 10

## Data files

- Tile types: id, colour, shape

## Unit tests

- Finds horizontal and vertical lines
- Rejects an invalid swap and uses no move
- Applies a valid swap: clears, scores, uses one move
- Refill creates no lines
- Start board has no lines and at least one valid swap
- Reshuffles when no valid swap exists
- Ends at zero moves with the correct win or lose result

## Assets

- None to supply
- Placeholder coloured shapes, one shape per tile type
