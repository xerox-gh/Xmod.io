# Xmod.io

An original, browser based physics sandbox. Build ridiculous machines, pose jointed dummies, launch sofas, and drive a little procedural buggy. All models, sky, textures, UI art, particles, and sounds are generated in code. There are no downloaded art or audio assets.

![Xmod.io procedural playground and main menu](docs/menu.webp)

## Run it

### Play on GitHub Pages

The static game can be published at **https://xerox-gh.github.io/Xmod.io/**. Solo play runs entirely in the browser, with no Node server required by players.

1. In this repository's **Settings → Pages**, set **Source** to **GitHub Actions** once.
2. The **Deploy Xmod.io to GitHub Pages** workflow builds and publishes every push to `main`. It can also be run manually from the Actions tab.
3. Once the deploy job succeeds, open the Pages URL above and click **Enter playground**.

`npm run build:pages` produces the uploadable `dist/` directory. Asset paths are relative, so they work at the repository's `/Xmod.io/` subpath. The static build starts in solo mode and does not send requests to a nonexistent multiplayer API.

GitHub Pages cannot run the Node/WebSocket server. To add multiplayer, host `server/` on a Node host with HTTPS/WebSocket support and enter that origin in the game's **Multiplayer server** field. Set the server's `ALLOWED_ORIGINS` to `https://xerox-gh.github.io`. Optionally set the repository Actions variable `VITE_SERVER_URL` to that HTTPS server origin before rebuilding, to provide it by default. No server is needed for solo tools, physics, ragdolls, weapons or vehicles.

To check the exact static build locally:

```sh
npm run build:pages
npm run test:pages
```

### Run locally

Use **Node.js 22.12+ or 24 LTS** and a desktop browser with WebGL 2 and pointer lock.

```sh
npm install
npm run dev
```

Open the local address Vite prints (normally **http://127.0.0.1:5173**). Solo play works immediately. Click **Enter playground** to capture the mouse; Esc releases it. If the browser refuses pointer lock after a menu closes, click Enter playground again.

For multiplayer, open another terminal in the same project:

```sh
npm run server
```

Choose **Multiplayer**, enter a name and a room ID, and create a room. A second browser can join it from the room list. Vite proxies `/api` and `/ws` to Node on port **3001**. Each browser uses a separate name; no account is required.

### LAN and production

- LAN development: `npm run dev -- --host 0.0.0.0`, then open the Vite address using your computer's LAN IP on the other computers. Run Node on the same machine. Pointer lock requires a browser secure context; use HTTPS when your browser requires it outside localhost.
- Production: `npm run build`, then `npm run server`. Express serves `dist/` and WebSockets from the same origin on port 3001. Put an HTTPS reverse proxy in front and enable WebSocket upgrades for `/ws`.
- `PORT` changes the Node port. If you change it in development, update the proxy target in `vite.config.js` too.
- For a separately hosted client, set `VITE_SERVER_URL` **before building**. Set Node's `ALLOWED_ORIGINS` to a comma separated list of your client origins. See `.env.example`. Node reads environment variables from your shell; it does not automatically load an `.env` file.

## Controls

| Input             | Action                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| WASD / mouse      | Move / look; WASD also drives the buggy                                          |
| Space             | Jump; hold for bunny hops; brake while driving                                   |
| Shift             | Sprint                                                                           |
| C                 | Crouch; slide while moving quickly                                               |
| V                 | Toggle noclip; Space ascends and C descends                                      |
| 1–9 / wheel       | Select tool (wheel adjusts holding distance while using the physics gun)         |
| Q                 | Open the searchable prop catalog                                                 |
| LMB / RMB         | Primary / secondary tool action                                                  |
| E                 | Enter or exit a nearby buggy; hold E and move mouse to rotate a physics-gun prop |
| R                 | Cycle tool-gun mode / reload weapon                                              |
| F, held           | Activate your thrusters and powered build wheels                                 |
| Z                 | Undo your last spawn, constraint, attachment, resize, or paint action            |
| N                 | Toggle day/night locally                                                         |
| T                 | Chat in your room                                                                |
| Backtick or Enter | Open console                                                                     |
| Esc               | Pause / close an overlay                                                         |

| Slot | Tool            | Use                                                                            |
| ---- | --------------- | ------------------------------------------------------------------------------ |
| 1    | Physics gun     | Hold LMB to grab; wheel pushes/pulls; E + mouse rotates; RMB freezes/unfreezes |
| 2    | Tool gun        | R cycles Weld, Rope, Thruster, Wheel, Balloon, Resize, Color Paint, Remover    |
| 3    | Prop spawner    | LMB places the selected object; RMB turns the preview                          |
| 4    | Ragdoll         | LMB creates a ten-body dummy with nine cone/twist joints                       |
| 5    | Pulse pistol    | LMB fires; 12 rounds; R reloads                                                |
| 6    | Scatter blaster | LMB fires nine physics pellets; 6 rounds                                       |
| 7    | Rocket launcher | LMB launches a swept-collision projectile with radial blast force; 3 rounds    |
| 8    | Gravity gun     | RMB picks up/drops; LMB launches the held or targeted prop                     |
| 9    | Scout buggy     | LMB spawns a RaycastVehicle; approach and press E                              |

Weld/Rope: click two different props. Thruster/Wheel/Balloon: click a surface to attach a device. Thrusters follow the surface normal; hold F to power them. Build wheels rotate about the clicked surface normal. Balloons supply continuous lift. Resize: LMB grows, RMB shrinks; resizing disconnects existing joints so old pivots cannot destabilize the build. Paint: LMB applies the current color, RMB changes colors. Remover deletes the whole targeted assembly.

To build a custom vehicle, spawn a platform, freeze it while working, attach wheels to its sides and thrusters facing the direction of travel, weld on other props, then unfreeze it and hold F. These are powered contraptions; the separate Scout buggy has an enterable driving seat.

## Console

```text
/help
/spawn barrel
/spawn ragdoll
/spawn car
/gravity 0
/gravity 20
/clear
/noclip
/undo
/day
/night
/kick BuilderName
```

`/clear` removes **your** props. `/gravity` and `/kick` require room ownership online. The room owner role passes to another player when the owner leaves. Prop editing/removal is limited to the builder, the room owner, or the starter world props. Everyone can grab and push shared props. Undo tracks a player's own build operations; removals and `/clear` do not have a restore history.

## Architecture

```text
client/
  index.html
  src/
    main.js
    core/       renderer, fixed loop, input, game composition, settings, effects
    physics/    shared-world entry point and constraint visualization
    player/     predicted controller, camera direction, noclip
    tools/      separate physics gun, gravity gun, tool gun, spawner, view model
    props/      definitions via shared/, geometry cache, mesh registry, ragdoll entry
    weapons/    weapon presentation, ammo, projectile rendering
    vehicles/   buggy/wheel presentation and shared physics entry points
    ui/         menus, hotbar/HUD, catalog, console, multiplayer, chat
    audio/      bounded WebAudio synthesizer
    net/        WebSocket transport, snapshot tracks, avatars/nametags
    maps/       map factory registry and flatgrass visuals
server/
  server.js     Express, WebSocket transport and validation/rate limits
  rooms.js      room lifecycle, authority ticks and snapshots
  validation.js input schemas, safe names and token buckets
shared/
  constants.js  protocol and resource limits
  maps.js       collision/visual layout
  props.js      dimensions, categories, materials and masses
  physics.js    cannon-es world setup
  movement.js   shared character controller
  simulation.js entity lifecycle, caps, undo, physics ticks
  actions.js    one validated action dispatcher for solo and online
  grabbing.js, constraints.js, ragdoll.js, vehicles.js, combat.js, weapons.js
tests/          physics, movement, tools, assemblies and two-socket integration
scripts/        syntax checks and a real two-browser smoke test
```

### Multiplayer authority

**Physics runs on the Node server**, at a fixed 60 Hz, rather than on a player's browser. Every room owns a separate cannon-es world. The authority validates commands, owns bodies and constraints, drives vehicles, performs weapon raycasts and projectile sweeps, enforces cooldowns/ammo, and simulates player inputs. A host leaving therefore cannot stop the room's physics.

Browsers send movement/look inputs at **20 Hz**. The server broadcasts player and prop transforms at **20 Hz**; spawn, removal, grab, constraint, paint, resize, and weapon events are reliable WebSocket messages. Other players and props interpolate through a **100 ms** snapshot buffer. The local player predicts with the same movement code and reconciles toward server positions. Replica props are kinematic locally, so browsers cannot fight the authoritative simulation.

This is a playable development networking model. It has basic prediction and reconciliation, but not full input replay, lag-compensated combat, or competitive anti-cheat. Rooms are ephemeral: no account system, saves, persistent bans, or automatic reconnection. A room kick disconnects that client; it is not a permanent identity ban. Empty rooms expire after one minute. Props owned by a departing player are cleaned up.

### Limits and performance

- **200 prop bodies per room**, **60 per player**, **200 constraints**, **12 players**, **20 rooms**, **32 rockets**. Oldest groups despawn first; ragdolls count as ten bodies and reserve capacity before spawning.
- Broadphase sorting, sleeping bodies, shared geometries, instanced scenery and 256 pooled particles. Only the first 64 prop objects cast dynamic shadows.
- Fixed 60 Hz simulation with a five-step catch-up cap; bounded WebAudio voices, tracers, chat history, and undo stacks. Settings include FOV, sensitivity, volume, shadows, and rendering resolution.
- Server bounds input size, tool/spawn/chat frequency, coordinates, reach, scale, names and message shape. Slow or flooded connections are closed. There are no arbitrary console JavaScript/eval commands.
- The 60 FPS laptop target is a design goal; it has **not been benchmarked on physical mid-range hardware**. Turn off shadows and select Performance resolution on slower integrated GPUs. Large, awake constraint chains are the most expensive case.

## Finished vs planned

**Finished:** stages 1–7: Vite project; procedural flatgrass with workshop, ramps, platforms and a water pit; movement/sprint/jump/slide/noclip; categorized catalog and live placement preview; constrained grab/rotate/freeze and gravity launch; all eight building modes; jointed dummies; three weapons with ammo/reload, recoil, flash and prop forces; raycast buggy and attachable powered parts; particles, synthesized impact/gun/explosion sounds, build undo, console, settings, day/night; server rooms, player avatars/nametags, shared props/constraints/vehicles, room list, chat and owner moderation.

**Planned:** saved constructions and import/export; additional maps and map selection; richer per-device force/motor editors; undo for destructive cleanup/removal; dedicated vehicle camera; crouch/vehicle animations on remote avatars; spatial audio and replicated contact sounds; input replay and latency testing over real networks; persistent moderation/auth; touch/controller controls. Water is a visual sunken test area with solid pit walls and floor, not a fluid simulation. Furniture uses conservative box collision proxies.

## Validation

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser smoke starts its own ephemeral server and Vite instance, uses Chromium, exercises actual menus and pointer lock, spawns/undoes assemblies, fires a weapon, tests noclip, connects two browser clients, checks shared prop counts and safe chat rendering, and writes screenshots to `test-results/`. Tests do not need a hosted service. CI runs the same checks.

To add a prop, extend `shared/props.js` and `client/src/props/meshes.js`. To add a map, extend `shared/maps.js`, pass its ID to `new Simulation(mapId)`, and register a matching visual factory in `client/src/maps/index.js`; then add a map selection UI. Keep simulation features in `shared/` so offline and online behavior stay consistent. Tool dispatch is wrapped in try/catch so a failing tool can be deactivated without stopping rendering or movement.
