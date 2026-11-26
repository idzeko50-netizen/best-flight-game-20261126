# Ridge Runner

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/idzeko50-netizen/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/idzeko50-netizen/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-plane valley run. Take the Kestrel out of Alder Field at golden hour, thread the amber rings down the river valley, and bring her home before the tanks run dry. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

Three sorties: **Ring Run** (take off, fly all 10 amber rings, land back), **Landing Challenge** (one final approach, scored on softness, centreline and alignment) and **Valley Tour** (free flight until the fuel gauge says otherwise). Fuel drains with throttle, hard landings and terrain hits cost damage, and a slow wing stalls.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network — every file the game loads lives under `game/`.

## Controls

- **W / S** — throttle up / down
- **↑ / ↓** — pitch
- **← / →** — bank
- **A / D** — rudder
- **C** — chase / cockpit view
- **Drag mouse** — look around
- **R** — restart the sortie, **M** — sound on/off

## How it is built

Vanilla JavaScript + vendored three.js (0.160.0, minified build under `game/vendor/`), no build step. The game's own source is split by job under `game/src/`: `terrain.js` (procedural valley, river, town, runway), `aircraft.js` (the Kestrel), `flight.js` (flight model, fuel, damage), `rings.js` (the ring course), `missions.js` (sorties and scoring), `hud.js` (HUD and lit instruments), `input.js`, `camera.js`, `audio.js` (synthesised engine sound), `shots.js` (deterministic screenshot scenes) and `main.js` (bootstrap and game loop).

---

<sub>Entered on [make.fun](https://make.fun/?ref=ad0wkz82&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
