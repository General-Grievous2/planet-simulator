# 🌌 Planet Simulator

An N-body gravitational simulator that runs in the browser — no install required. Scientifically accurate, satisfying to tinker with, and packed with JoJo's Bizarre Adventure references.

## Features

- **Leapfrog (Störmer-Verlet) integrator** — symplectic, energy-conserving N-body physics
- **Configurable time step & sub-steps** — trade speed for accuracy
- **Gravitational softening** — prevents singularities at close encounters
- **Momentum-conserving collisions** — bigger body absorbs smaller; velocity vectors add correctly
- **Intuitive click-drag placement** — click to place, drag to aim velocity, see km/s live
- **Per-body engine forces** — apply a constant thrust vector (in Newtons) to any object
- **Impulse kicks** — instantly add ΔV to a selected body
- **Mass unit picker** — switch between kg, metric tons, Moon, Earth, Jupiter, or Solar masses; number converts automatically
- **Orbit trails**, labels, engine-arrow overlays
- **10 built-in presets** (see below)
- **JoJo's Bizarre Adventure easter eggs** 🌟

## Running

Just open a local HTTP server in the project folder:

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765` in any modern browser.

No build step, no dependencies. Pure ES modules.

## Controls

| Input | Action |
|---|---|
| `Scroll` | Zoom in / out |
| `Right-drag` / `Middle-drag` | Pan camera |
| `Click body` | Select it |
| `A` | Toggle **Add Body** mode |
| Click canvas (add mode) | Set placement point |
| Drag (add mode) | Aim initial velocity — shows km/s live |
| Release (add mode) | Place the body |
| `Space` | Pause / Resume |
| `R` | Reset simulation |
| `T` | Toggle trails |
| `Z` | **ZA WARUDO** ⌛ — stop time |
| `H` | Help overlay |
| `Esc` | Deselect / cancel add |
| `Delete` | Remove selected body |

## Presets

| Preset | Description |
|---|---|
| Inner Solar System | Sun + Mercury, Venus, Earth, Mars |
| Full Solar System | All 8 planets |
| Earth–Moon | Accurate Earth–Moon orbital system |
| Binary Stars | Equal-mass stars in mutual orbit |
| Figure-8 Three-Body | Classic Chenciner–Montgomery solution |
| Galaxy Collision | Two star clusters merging |
| DIO's Road Roller 🛣️ | JoJo Part 3 — *WRYYY!* |
| Star Platinum ⭐ | JoJo Part 3 — ORA ORA ORA |
| Golden Requiem 👑 | JoJo Part 5 spiral |
| ZA WARUDO ⌛ | Time stops on load |

## Quick-add bodies

Click a quick-body button to pre-fill the template, then click the canvas to place:

☀️ Sun · 🌍 Earth · 🌙 Moon · 🟤 Jupiter · ⚫ Black Hole · 🪨 Rock · 🧛 DIO · ⭐ Jotaro

## JoJo Easter Eggs

- Name a body **DIO** → it turns gold and glows
- Name a body **Jotaro** → it turns blue
- Name a body **Kira / Yoshikage** → purple glow
- Name a body **Giorno** → cyan
- Name a body **Gyro / Johnny** → orange
- Collision shouts are flavoured by the bodies' names (*ORA ORA*, *MUDA MUDA*, *WRYYY*, etc.)
- Press **Z** or click **⌛ ZA WARUDO!** to stop time

## Physics Notes

- **G** = 6.674 × 10⁻¹¹ m³ kg⁻¹ s⁻²
- All simulation state is in SI units (metres, m/s, kg)
- Display distances in AU (1 AU = 1.496 × 10¹¹ m)
- Collision radii are scaled from display radii; decrease softening for tighter merges
- The leapfrog integrator conserves energy to second order — suitable for long-term orbital motion

## File Overview

| File | Purpose |
|---|---|
| `simulator.js` | Physics engine: `Body`, `Simulation`, presets, mass units, merge events |
| `main.js` | Rendering, camera, UI bindings, placement, JoJo effects |
| `index.html` | Layout, panels, controls |
| `styles.css` | Space theme, glassmorphism, JoJo animations |
| `ui.js` | (stub — logic lives in `main.js`) |

## License

MIT
