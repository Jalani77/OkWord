# Ultimate Frisbee 2D

A browser-based 2D Ultimate Frisbee game built with **Phaser.js v3** featuring real-world mechanics: 7v7 teams, pivot-only disc handling, stall counts, turnovers, and end zone scoring.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Controls

| Input | Action |
|---|---|
| WASD / Arrow Keys | Move player |
| Mouse | Aim throw direction |
| Click & Hold | Charge throw power |
| Release Click | Throw disc |
| TAB | Switch controlled player |
| SPACE | Call for pass (AI teammate throws) |

## Rules

- **No running with the disc** — the handler must pivot in place after catching
- **Stall count** — a 10-second timer starts when a defender marks the handler
- **Turnovers** occur on: dropped disc, interception, out-of-bounds, or stall-out
- **Score** by catching the disc in the opponent's end zone
- First team to **15 points** wins
- After each score, teams swap offense/defense and switch field direction

## Architecture

```
src/
  scenes/        BootScene, MenuScene, GameScene
  entities/      Player, Disc, Team, Field
  managers/      GameStateManager, PossessionManager, StallManager, ScoreManager
  systems/       InputController, DiscPhysicsEngine, CollisionSystem, AIController
  utils/         Constants, MathHelpers
```

## Build

```bash
npm run build    # Production build → dist/
npm run preview  # Preview production build
```
