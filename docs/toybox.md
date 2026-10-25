# Browser Toybox guide

Open **Toybox** from the main menu or **B → Toybox**. Solo features need no backend. The existing optional Node/WebSocket server remains separate.

## Tools and wiring

Engineering lets you choose an advanced tool, set its parameters and equip it. LMB applies single-prop tools; two-object tools use one click on each prop. Hoverballs attach to the aimed prop. Keep Upright removes pitch/roll while preserving yaw. **J/K** raise/lower hover height or extend/retract ropes by default; binds can be changed. A winch limits maximum rope length; hydraulics hold the requested distance. Axles use the selected X/Y/Z axis; ball sockets allow rotation on all three axes.

For pulleys, **RMB** places up to four fixed world anchors before you LMB-select the moving ends. Without anchors, the rope takes an overhead route. Freeze support structures and combine a slider with a hydraulic/winch to build a crane or lift. No-Collide suppresses collision for its selected pair only; it does not change either body's collision layer. Z undoes connections.

Wire components are ordinary props that can be welded onto machines. A wire connects **OUT → A/B/X/Y/Z**. To make a flashing lamp, spawn a clock chip and lamp, equip Wire with destination A, click the clock, then the lamp. Sensors can feed digital screens, gates use A/B, and gimbals take X/Y/Z coordinates. Sound emitter A controls pitch; A=1 uses the configured base frequency. Gates advance once per physics tick, keeping feedback bounded. Configure range, oscillator, display text/graph and automatic defense in Wiring, then apply to the aimed device.

Gravity volumes override the global gravity vector within their cube. Zero all axes for zero-G; positive Y inverts gravity. Global wind pushes light bodies and airfoils. Currents and whirlpools operate in Flatgrass's water pit. Use Buoyancy to tune individual hulls. Flames char wood, spread to nearby touching wood, and eventually break it into debris. Glass uses clipped 2D Voronoi cells with convex collision prisms. Link two portal pads using the portal-link tool; exit transforms preserve local velocity, angular velocity and relative position.

## Gadgets and actors

| Gadget | Controls |
| --- | --- |
| Grappling hook | LMB hook, RMB release, J reel, K pay out, F pull a movable anchor |
| Dual tether gear | LMB left hook, RMB right hook, R release both, J/K reel/pay out |
| Swap gun | LMB prop A, then prop B; exchanges position, orientation and velocities |
| Singularity grenade | LMB throw; three seconds of swirling attraction followed by outward force |
| Cryo ray | LMB freezes a prop and creates temporary ice; a hard hit thaws the prop |
| Scale ray | LMB grows, RMB shrinks; collider/mass follow size and old joints disconnect |
| RC controller | LMB links a vehicle/contraption, WASD drives from its camera, RMB disconnects |

Actors configures red, blue, green, hostile and friendly factions with melee/ranged attacks. **E** on a friendly dummy cycles Wander → Follow → Guard. Dummies and fast billboard chasers use ray-based obstacle steering and jumps, not navmesh pathfinding. The image picker creates a chaser from a local image.

Aim at a dummy/contraption or select props, then **Record five seconds**. Move it with the physics gun. Loop the resulting clip to drive kinematic poses; Stop releases bodies back to physics. Up to eight clips can play. Puppet clips can be saved in the Garage.

## Saves, links and files

Garage uses **IndexedDB** and stores thumbnails alongside builds, maps, replays, puppet clips and best-lap ghosts. The list reads metadata rather than every replay's full data. Storage quota depends on the browser/device. Data persists on the same browser/profile/origin; clearing site data removes it. JSON and PNG exports provide portable backups.

**Save as custom map** freezes the saved prop layout over its current base map. Loading a saved map replaces props and switches to that base. This supports block/prop maps, not terrain sculpting. Replays use the existing 30-second transform format and need their recorded base map.

**Create build link** stores gzip-compressed validated JSON in `#build=g.…`; opening it adds the creation automatically and switches base maps if necessary. Links have a 24,000-character limit. For larger builds, export JSON or a **PNG save card**. Cards are real screenshots containing compressed build JSON in a CRC-protected PNG `iTXt` metadata chunk. Drop the original `.png` into the game to load it. Image-recompressing services may strip metadata, so share it as an original file. Decompressed build data is capped at 512 KB and validated before use.

Drop `.glb`/`.gltf` models, images or `.mp3`/`.wav`/`.ogg` audio into the window, or use the Garage picker. Drop glTF `.bin` and image dependencies together with the model. Only supplied files and embedded data URIs are resolved; no remote asset service or external compressed-model decoder is used. Models receive fitted box collision proxies. Textures apply to the aimed/selected prop, and audio attaches to a sound emitter and retriggers on a rising A input.

Imported media is **session-local**: it is not embedded in build files or sent to peers. A later session shows a proxy until media is imported again. Limits are 32 MB/file, 96 MB and 32 imported assets/session, 250,000 model vertices, 16-megapixel images and two-minute audio clips.

## Mini-modes and direct peers

- **Prop Hunt:** solo hunters find four disguised props; wrong shots cost 5 HP. Solo hiders evade dummy hunters. Aim at a prop before choosing Disguise. With two direct peers, the guest gets the role opposite the host. Hider models keep a fixed rotation; hunter hits reduce hider health.
- **Contraption Derby:** drive through checkpoints in order. Existing checkpoints are used when there are at least three; otherwise the mode creates six and supplies a buggy. Lap times use milliseconds, and the best lap becomes a ghost that can be saved.
- **Beacon Defense:** protect the core against increasingly strong waves, capped at five active jointed attackers. Build barricades and enable defense turrets.
- **Rising Lava:** the glowing floor rises and damages players below its surface. Build upward or fly.
- **Build & Destroy:** three minutes of building with weapons disabled, followed by two minutes allowing rockets/grenades and disabling building. Timers follow world time. Returning to Sandbox removes mode-created objects and exits mode vehicles.

Peers uses a manual WebRTC exchange: Host creates an offer, Guest pastes it and sends an answer, and Host accepts the answer. Allow local-network access if the browser requests it. Both browsers need a reachable **LAN/direct network route**. No signaling/STUN/TURN service is contacted; restrictive NATs and blocked networks therefore cannot be crossed. The host must keep its tab open. Physics, props, editing permissions, limits, chat and mode health/disguises run on that host. Media imports and puppet loops remain local. This is not universal Internet matchmaking.

## Visuals and performance

Camera filters are a real canvas shader pass, so CRT, VHS, night vision, pixel and comic effects appear in screenshots and canvas WebM recordings. Camera-link connects one CCTV camera and one monitor; cameras face local −Z. Two monitors update at about 7 FPS. Two mirrors use 256-pixel reflections. Bullet holes, scorch marks and paint splashes use projected procedural decals.

The ordinary 200-body/200-constraint budget applies. Fragments expire after 18 seconds and do not evict unrelated builds solely to make debris. Live visuals are capped at 24 trails with 64 samples each, 16 dynamic displays, two mirrors, two 256×144 CCTV feeds, 48 decals and eight singularities. Default zero-wind physics preserves sleeping bodies. These are bounded sandbox approximations; physical mid-range laptop performance has not been benchmarked. Richer navigation/animation, terrain sculpting, detailed imported collision hulls and relay-backed matchmaking remain future work.
