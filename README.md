# Azarakhsh Front V4

نسخه آماده بررسی نهایی پیش از انتشار دامنه. برای جزئیات تغییرات، `CHANGELOG_2_9_FA.txt` را ببینید.

## AF 2.8 independent SAM + ceasefire + nightmare AI

AF 2.8 keeps the 2.7 missile visuals and flight model, but changes the defense and diplomacy rules: each physical SAM battery gets one independent 50% interception roll per eligible incoming missile, only when the missile destination is inside that battery's coverage and the threat is radar-tracked. The in-match intelligence-rule toggle is removed. Sustained player pressure can trigger a bot ceasefire request; accepted truces last 300 simulation seconds and either side can break them. Nightmare AI receives faster decision cycles and an emergency rebuild reserve for destroyed critical infrastructure.

# Azarakhsh Front 2.8 - Independent SAM Defense + Diplomacy / AI Recovery

This is an incremental update to **Azarakhsh Front Reborn 2.5**, not a new game
and not a rewrite of the old v13 game. No separate source named AF V4 was available.
The user-supplied AF V3 reference (`Pasted text(3).txt`) was consulted ONLY for non-visual offensive-missile and SAM dynamics.
Its UI, graphics, AAA, economy and room implementation have not been imported.

## Release status - read first

Offline gameplay, missile/defense regression, authoritative room logic and
snapshot rendering have been tested. **Actual Express/Socket.IO transport has NOT
been executed in the delivery environment**, because its packages could not be
installed without network access. The complete transport integration test is
included; run `npm run test:network` after `npm install` before sharing the online
version. This is a first-stage online implementation, not a production-certified
multiplayer service. No server has been deployed for you.

All movement, damage and interception numbers are fictional game units.
No real-world weapon accuracy, coordinates or military-performance data are used.

## 1. Play offline

Extract the complete folder. Open `index.html` and choose the offline game.
The file is already built; there is no npm or Python requirement for offline play.
Country PNGs are in `music/`. Small embedded maps and land masks provide a fallback.
Missing MP3 files are silent and do not stop the game.

Direct `file://` browsing was blocked by the testing environment's browser policy.
Browser tests used the exact compiled HTML with Playwright `set_content`; this is
not a claim that direct-file execution was tested on every browser.

## 2. Start the multiplayer server

Install an active Node.js LTS (Node 24 LTS is recommended; code/unit tests ran on
Node 22.16.0). This project declares Node >=22. Open a terminal **in this folder**:

```sh
npm install
npm run test:syntax
npm test
npm run test:network
npm start
```

The server defaults to port **3000**, bound to `0.0.0.0`. Leave that terminal open.
Declared packages: Express 5.2.1 and Socket.IO / socket.io-client 4.8.4.
The first installation needs internet access for packages; ordinary LAN matches
subsequently use your running server, not an external database/service.

On the server computer open:

```text
http://localhost:3000
```

Choose Online, enter a name, pick a country and create a room. Share its six-character
code. A second player opens the **same running server**, chooses a different
country, enters the code and joins. Both players press Ready; only the host can
start, and only after both are connected and ready.

### Two computers on the same local network

Only one computer runs Node. The other needs a browser. Find the server computer's
local IPv4 address with `ipconfig` on Windows or `ip address` on Linux. Then open:

```text
http://SERVER_LAN_IP:3000
```

Replace `SERVER_LAN_IP` with the actual address, for example `192.168.1.20` if that
is what your machine reports. Do not use `localhost` on the second computer; that
would refer to the second computer itself.

Allow incoming TCP 3000 / Node on the server's trusted private-network firewall if
needed. Do not disable the firewall. Guest Wi-Fi/client isolation can prevent LAN
clients from reaching each other. Check `/health` from the second browser before
troubleshooting the game lobby.

Opening the HTML file directly is **offline**, not an online connection. Merely
sending the ZIP to two people or uploading `index.html` to static hosting does not
start the Node server. Internet play requires an accessible, running Node server;
use HTTPS and a WebSocket-capable reverse proxy for a public deployment. Public
hosting, TLS, NAT forwarding and outside-LAN reachability are not configured or
verified in this release.

### Server options

`PORT`, `HOST` and a comma-separated `ALLOWED_ORIGINS` are optional environment
variables. By default the browser UI and Socket.IO share one HTTP origin. Keep
that setup for the first LAN test. No secrets need to be embedded in the client.

## 3. What changed in combat

- New `src/flight-physics.js` contains the legacy ascent, delayed turn, descent,
  submunition fan and fixed-interception-curve equations adapted to the current
  coordinate system. A relative apex replaces the legacy hard-coded screen top.
  Timings and cluster release height were adapted to the current world scale.
- Preview, offline flight and authoritative online flight use that same module.
  This is not a pixel-for-pixel copy of the old renderer or a physical simulation
  of an actual missile.
- Ballistic, hypersonic, heavy and cluster carriers have separate ascent/descent
  behavior and visible discarded body sections. Hypersonic terminal descent is
  much faster than its earlier flight; it deals less damage than ballistic.
- Cruise retains straight low flight and AAA-only interception. Current Reborn
  drone/AAA movement was improved independently, not copied from the attachment.
- SAM goes to a fixed future interception point along a curved path. It does not
  home after launch. Shots that miss continue beyond that point and self-destruct.
- Cluster releases ten independently moving submunitions with a slower fan-out stage.
- Distinct missile silhouettes, materials, fins, warheads and engine flames;
  a bounded, quality-sensitive starfield is drawn behind the existing maps.
- AAA retains the newer rapid-fire Reborn system (about one tracer every 0.12s per ready gun). Stray/already-fired rounds survive target destruction and use a small yellow self-destruction flash.

SAM interception in 2.8 is intentionally simple and transparent:

- A SAM battery is eligible only if the incoming missile's destination lies inside that battery's simulation range.
- The threat must also be radar-tracked. No blind SAM shot is created.
- Each physical SAM site fires at most one interceptor at that incoming missile.
- Every launched SAM interceptor receives its **own independent 50% success roll**. A failure by one battery does not consume or change the next battery's 50% roll.
- Defense research expands radar range (+20%) and SAM coverage (+6%) but does not alter the 50% per-interceptor roll.
- Cruise remains SAM-disabled and is handled by AAA.

A successful roll still has to reach the planned crossing point in the simulation; the SAM path is frozen at launch and does not retarget mid-flight.

## 4. Anti-spam balance

No national structure-count limit was added. Instead:

- A faction can issue up to three launches immediately; launch capacity recovers
  one shot per 1.8 seconds in Arcade and 2.5 seconds in Realistic, alongside each
  launcher's existing reload. This applies to manual, operation and AI launches.
- A factory stack scales as `count ** 0.66`, not linearly. Four stacked factories
  provide approximately 2.5x throughput instead of instantly multiplying output.
- Base production cycles are 24s ballistic, 25s cruise, 42s hypersonic, 36s cluster,
  80s heavy and 17s drone. Research, mode and factory condition affect throughput.
- Manual oil sales have no in-game cooldown. Each quick sale still consumes real oil (50 units per hotkey/button use), so repeated selling is limited by actual stock.
- Heavy ammunition and its research require a larger economic commitment.


## 5. Diplomacy and fixed intelligence rule

- The intelligence/recon rule is selected only in pre-match setup. The in-match command gateway rejects attempts to toggle it, including authoritative multiplayer commands.
- Heavy sustained attacks raise pressure on an AI enemy. At the pressure threshold it can send an incoming ceasefire request; the Diplomacy rail shows a red notification dot until the request is handled or expires.
- Accepted ceasefires last **300 simulation seconds (5 minutes)**. The Diplomacy panel shows the remaining time and a **نقض آتش‌بس** action.
- AI enemies may also break an active ceasefire after rebuilding key infrastructure and rearming.
- Nightmare AI uses faster thinking, higher income, larger rebuild targets, more simultaneous construction capacity, and an emergency resource reserve only when a critical structure type has been completely lost.

## 6. Multiplayer architecture

```text
Browser UI / rendering
        |
        | typed intent, command ID, arguments (no client damage/resources)
        v
Socket.IO -> RoomService -> GameCommands -> shared Simulation
                                          |
                                          v
                           per-player filtered snapshots + events
                                          |
                                          v
                            Browser interpolation / rendering
```

The server runs 30 simulation steps/second and sends snapshots approximately 10
times/second. Clients do not advance economy, damage, AI or construction online.
They only display snapshots and extrapolate visuals for a short bounded interval.
The server decides ownership from the connection's session, not from user-supplied
`owner` fields. Resource spending, research, build positions, cooldowns, stock,
launch targets and operation reservations all use shared game command validation.

Opponent funds, stocks and unrevealed structures are not included in snapshots.
A visible hostile missile track does not expose its hidden source, target or
future random defense outcome. The land mask used for placement is shared too.

See `docs/NETWORK.md` for event contracts, lifecycle and scope limitations.

## 7. Existing files edited and new files

| File | Role / modification |
|---|---|
| `src/engine.js` | Existing state, resources, aircraft and gameplay; new trajectory adapter, launch budget, defensive timings, per-human statistics |
| `src/config.js` | Explicit weapon roles, balance and sound asset mapping |
| `src/render.js` | Existing map renderer preserved; starfield and weapon/warhead/interceptor visuals improved |
| `src/ui.js` | Existing controls routed through a shared command gateway; compact role hints and online entry |
| `src/app.js` | Offline simulation preserved; online mode consumes server state instead of ticking locally |
| `src/audio.js` | Existing seven recording events preserved; one button-click media sound added |
| `src/locale.js`, `src/style.css`, `src/shell.html` | Labels, room UI, connection state and restrained visual polish |
| `src/flight-physics.js` (new) | Offensive-missile and SAM movement only, adapted from the supplied physics reference |
| `src/commands.js` (new) | Shared validated command interface for offline and server use |
| `src/network.js` (new) | Optional Socket.IO client, lobby, reconnect and snapshot rendering |
| `server.cjs` (new) | Express, HTTP, Socket.IO, health check and static game/assets |
| `server/load-simulation.cjs` (new) | Loads the existing DOM-free game core in Node, not a second implementation |
| `server/rooms.cjs` (new) | Room membership, readiness, start, command dedupe, timing, disconnect lifecycle |
| `server/snapshot.cjs` (new) | Per-player state/event visibility filtering |
| `package.json` (new) | Dependencies and commands |
| `tools/build.cjs` (new) | Dependency-free Node HTML build; Python builder also remains |
| `tests/*` | Retained regression tests plus physics, room, snapshot and real transport tests |

`index.html` is generated from the readable sources. After source edits, run:

```sh
npm run build
```

It does not require installed Express/Socket.IO to build. Both Node and Python
builders produce identical HTML. Original map data and vector structure glyphs
remain; no old structure PNG dependencies were added.

## 7. Audio and assets

Add your seven original MP3 recordings to `music/` with their exact names.
`music/README-SOUNDS.txt` lists them. They are not included in this package.
The new `ui-click.wav` is included and embedded for offline use. It plays only on
actual enabled UI button clicks, not map clicks or game events. Combat sounds are
not synthesized. Missing recordings remain silent. The existing fighter-strike
7-second sound synchronization is retained.

Vazirmatn is an optional external Google Fonts stylesheet; Tahoma/Arial is the
fallback. **No font binaries are redistributed**. There is no mandatory font or
3D-engine download required to run the game.

## 8. Controls

| Key | Action |
|---|---|
| 1 | Oil station |
| 2 | Missile factory |
| 3 | Radar |
| 4 | AAA |
| 5 | SAM |
| 6 | Launcher |
| 7 | Airbase |
| 8 | Missile selection and aiming |
| 9 | Fighter strike |
| 0 | Quick oil sale |
| Q | Operation planner |
| Space | Tactical view (offline slowdown; online visual overlay only) |
| P | Pause menu (online menu does not pause the shared match) |

Gameplay save/load remains removed. Reconnection metadata in sessionStorage is
only a session token and command sequence, not a game save or account.

## 9. Tests and limitations

Read `QA_REPORT.md`. `npm test` is DOM/transport-independent and can run even before
installing the network dependencies. It tests real game logic and a fake transport
adapter for room orchestration. It is **not** an actual Socket.IO test.

`npm run test:network` starts the real Express/Socket.IO server on an ephemeral
local port and connects two actual socket clients after dependencies are installed.
An unrun integration file does not mean that test has passed.

This release has no database, accounts, matchmaking, public room directory,
rankings, match persistence, multi-process room routing or public deployment.
Only two human seats are supported online; offline allies/bots remain available.
Disconnect pauses the match for up to 45 seconds. Restarting the server loses
rooms/matches. This is intentional first-stage scope, not silent persistence.



## 2.7 changes

- Missile/SAM gameplay dynamics now follow the supplied AF V3 reference: reference speeds, duration clamps, high-arc split timing, vertical-first boost, hypersonic late terminal dive, rain-carrier release timing and fixed future-point SAM interception.
- SAM interceptors use a frozen future crossing and the reference ease-plus-sinusoidal-bend path. They do not home or retarget after launch, eliminating the 180-degree snap-turn behavior.
- Multiple SAM battery sites can fire on one threat, but the kill/pass result is decided once per defense network.
- Base SAM intercept roles are ballistic 50%, hypersonic 30%, heavy 40% and rain carrier 50%; defense research improves them and blind engagement remains less accurate.
- Cruise remains SAM-disabled and uses the existing Reborn rapid-fire AAA.
- Reborn graphics, missile artwork, explosions, UI, audio, economy and multiplayer architecture are unchanged by this physics transplant.

## 2.5 changes

- Removed the gameplay cooldown between manual oil sales.
- AAA now fires a rapid sequential stream at roughly one round every 0.12 simulation seconds per site, adjusted by operational efficiency.
- AAA projectiles, miss behavior, and yellow self-destruct visuals are otherwise unchanged.
