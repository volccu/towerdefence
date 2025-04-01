# Tower Defense Game

A simple tube-like Tower Defense game with minimalist retrofuturistic style.

## How to Play

1. Open `index.html` in your browser to start the game
2. Click the "NEXT WAVE" button to start enemy waves
3. Place towers by selecting them from the left panel and clicking on the game grid (each tower takes up a 2x2 area)
4. Towers cost money and automatically fire at enemies
5. Killing enemies gives you money to build more towers
6. Create mazes with towers to slow down enemies
7. If 10 enemies reach the bottom, the game is over
8. Each wave gets progressively harder with more durable enemies

## Controls

- **Mouse Click**: Place selected tower, press buttons, or sell towers in sell mode
- **Mouse Drag**: Select multiple towers for selling (in sell mode)
- **D Key**: Toggle debug mode, showing tower ranges

## Features

- Separate UI panel for game controls
- Tower shop system
- Tower selling (get half the cost back)
- Health bars only appear when enemies are damaged
- Economy system that scales with wave difficulty
- Dynamic pathfinding (A* algorithm)
- Enemies find new paths when blocked by towers
- Wave-based progression system
- Lives and score system

## Technical Implementation

The game is built with vanilla JavaScript using HTML5 Canvas. Main components:

- **Grid**: Manages the grid and tower placement
- **Tower**: Tower functionality and enemy targeting
- **Creep**: Enemy movement and pathfinding
- **Pathfinding**: A* pathfinding algorithm implementation
- **Game**: Main game loop and state management 