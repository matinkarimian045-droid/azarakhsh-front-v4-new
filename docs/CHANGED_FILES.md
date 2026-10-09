# File change inventory vs supplied Reborn 2.1

Generated source comparison. Original package was left unchanged.

| File | Status |
|---|---|
| `CREDITS.md` | modified |
| `QA_REPORT.md` | modified |
| `README.md` | modified |
| `READ_ME_FA.txt` | modified |
| `build.py` | modified |
| `docs/NETWORK.md` | added |
| `docs/PHYSICS_SOURCE.md` | added |
| `index.html` | modified |
| `music/README-SOUNDS.txt` | modified |
| `music/ui-click.wav` | added |
| `package.json` | added |
| `server/load-simulation.cjs` | added |
| `server/rooms.cjs` | added |
| `server/snapshot.cjs` | added |
| `server.cjs` | added |
| `src/app.js` | modified |
| `src/audio.js` | modified |
| `src/commands.js` | added |
| `src/config.js` | modified |
| `src/engine.js` | modified |
| `src/flight-physics.js` | added |
| `src/locale.js` | modified |
| `src/network.js` | added |
| `src/render.js` | modified |
| `src/selftest.js` | modified |
| `src/shell.html` | modified |
| `src/style.css` | modified |
| `src/ui.js` | modified |
| `tests/audio-check.cjs` | modified |
| `tests/audio-results.json` | modified |
| `tests/browser-check.py` | modified |
| `tests/browser-results.json` | modified |
| `tests/client22-check.py` | added |
| `tests/client22-results.json` | added |
| `tests/combat22-results.json` | added |
| `tests/combat22-test.cjs` | added |
| `tests/engine-results.json` | modified |
| `tests/make-snapshot-fixture.cjs` | added |
| `tests/network-results.json` | added |
| `tests/network-test.cjs` | added |
| `tests/room-unit-results.json` | added |
| `tests/room-unit-test.cjs` | added |
| `tests/run-engine.cjs` | modified |
| `tests/screenshots-2_2/01-main-menu.png` | added |
| `tests/screenshots-2_2/02-battle-setup.png` | added |
| `tests/screenshots-2_2/03-research.png` | added |
| `tests/screenshots-2_2/04-missile-production.png` | added |
| `tests/screenshots-2_2/05-launch-picker.png` | added |
| `tests/screenshots-2_2/06-warhead-separation.png` | added |
| `tests/screenshots-2_2/07-audio-settings.png` | added |
| `tests/screenshots-2_2/08-battlefield.png` | added |
| `tests/screenshots-2_2/09-boost-phase.png` | added |
| `tests/screenshots-2_2/09-player-two-view.png` | added |
| `tests/screenshots-2_2/10-room-lobby-fixture.png` | added |
| `tests/screenshots-2_2/10-separated-warhead.png` | added |
| `tests/screenshots-2_2/11-terminal-defense.png` | added |
| `tests/screenshots-2_2/12-live-field.png` | added |
| `tests/screenshots-2_2/13-aftermath.png` | added |
| `tests/screenshots-2_2/mobile-360-launch.png` | added |
| `tests/screenshots-2_2/mobile-360-menu.png` | added |
| `tests/screenshots-2_2/mobile-360-production.png` | added |
| `tests/screenshots-2_2/mobile-360-research.png` | added |
| `tests/screenshots-2_2/mobile-360-room-fixture.png` | added |
| `tests/screenshots-2_2/mobile-360-rules.png` | added |
| `tests/screenshots-2_2/mobile-360-setup.png` | added |
| `tests/syntax-check.py` | modified |
| `tests/syntax-results.json` | modified |
| `tests/touch-check.py` | modified |
| `tests/touch-results.json` | modified |
| `tests/visual-battle-check.py` | modified |
| `tests/visual-battle-results.json` | modified |
| `tools/build.cjs` | added |
| `tools/check-syntax.cjs` | added |

Old 2.1 screenshot reports were removed from this updated working copy.
No font binaries or MP3 recordings are included.

## 2.6 - Legacy Missile Dynamics

- `src/flight-physics.js`
  - Replaced offensive ballistic-family and SAM interpolation with the normalized
    AF V3 reference equations.
  - Added reference split/apex/descent timing and reference duration clamps.
- `src/engine.js`
  - Added reference Realistic targeting spread bands.
  - Rain payload now releases six staggered fan submunitions at 64% progress.
  - SAM now selects a reachable future trajectory point from the reference
    lead/cap rules; one frozen aim is used after launch.
  - Cooperative SAM sites share one defense-network outcome per threat.
  - Cruise remains excluded from SAM and current Reborn rapid AAA is retained.
- `src/config.js`
  - Reference missile ground speeds; version updated to 2.6.
- `tests/combat22-test.cjs`, `tests/run-engine.cjs`, `tests/visual-battle-check.py`
  - Added trajectory-equation, future-point, frozen-aim, cooperative-network and
    integration regressions.
- `README.md`, `QA_REPORT.md`, `docs/PHYSICS_SOURCE.md`
  - Updated release documentation and test status.
