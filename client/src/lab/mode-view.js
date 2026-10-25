import * as T from 'three';
import { MODE_NAMES } from '../../../shared/lab/modes.js';
import { makePropMesh, disposeProp } from '../props/meshes.js';
export class ModeView {
  constructor(lab) {
    this.lab = lab;
    this.ghost = null;
    this.disguises = new Map();
    this.hud = document.createElement('div');
    this.hud.className = 'mode-hud';
    this.hud.hidden = true;
    lab.game.root.append(this.hud);
    this.lava = new T.Mesh(
      new T.PlaneGeometry(260, 260),
      new T.MeshStandardMaterial({
        color: '#f06539',
        emissive: '#e94518',
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.8,
        side: T.DoubleSide,
      }),
    );
    this.lava.rotation.x = -Math.PI / 2;
    this.lava.visible = false;
    lab.game.view.scene.add(this.lava);
  }
  update() {
    const g = this.lab.game,
      mode = g.sim.remote ? this.lab.remoteMode || { id: 'sandbox' } : g.sim.lab.modes.snapshot(),
      own = mode.players?.[g.owner] || {};
    this.hud.hidden = mode.id === 'sandbox' || !g.started;
    this.hud.textContent = `${MODE_NAMES[mode.id] || 'Sandbox'} · ${mode.result || mode.phase || 'play'} · HP ${Math.max(0, Math.ceil(own.health ?? 100))}${mode.id === 'race' ? ` · lap ${own.lap || 0} · checkpoint ${(own.checkpoint || 0) + 1} · ${own.last ? `${(own.last / 1000).toFixed(3)} s` : '—'}` : mode.id === 'horde' ? ` · wave ${mode.wave} · beacon ${Math.max(0, g.sim.entities.get(mode.core)?.behavior.health ?? 0)}` : mode.id === 'hunt' ? ` · ${own.role || 'hunter'} · score ${mode.score || 0} · ${Math.ceil(mode.remaining || 0)}s` : ` · ${Math.ceil(mode.remaining || 0)}s`}`;
    this.lava.visible = mode.id === 'lava';
    if (this.lava.visible) this.lava.position.y = mode.lava;
    const ghost = g.sim.lab.modes.ghosts.get(g.owner) || this.lab.loadedGhost;
    if (mode.id === 'race' && ghost?.frames?.length) {
      if (!this.ghost) {
        this.ghost = makePropMesh('car', '#98dfdb');
        this.ghost.traverse((m) => {
          if (m.isMesh) {
            m.material.transparent = true;
            m.material.opacity = 0.3;
            m.material.depthWrite = false;
          }
        });
        g.view.scene.add(this.ghost);
      }
      const time =
          (g.sim.time - (g.sim.lab.modes.players.get(g.owner)?.start || 0)) % (ghost.ms / 1000),
        f = ghost.frames.find((frame) => frame.t >= time) || ghost.frames.at(-1);
      this.ghost.position.fromArray(f.p);
      this.ghost.rotation.y = f.yaw;
      this.ghost.visible = true;
    } else if (this.ghost) this.ghost.visible = false;
    const disguises = new Map();
    if (g.actor.disguise)
      disguises.set(g.owner, {
        skin: g.actor.disguise,
        p: g.player.state.body.position,
        local: true,
      });
    for (const [id, a] of g.net.avatars.players)
      if (a.disguise) {
        const p = a.track.sample()?.p;
        if (p) disguises.set(id, { skin: a.disguise, p, avatar: a });
      }
    for (const [id, d] of disguises) {
      let record = this.disguises.get(id);
      if (!record || record.type !== d.skin.type) {
        if (record) {
          record.mesh.parent?.remove(record.mesh);
          disposeProp(record.mesh);
        }
        const mesh = makePropMesh(d.skin.type, d.skin.color);
        g.view.scene.add(mesh);
        record = { mesh, type: d.skin.type };
        this.disguises.set(id, record);
      }
      record.mesh.position.copy(d.p);
      record.mesh.rotation.y = d.skin.yaw;
      record.mesh.scale.setScalar(d.skin.scale);
      record.mesh.visible = !d.local || g.cameraRig.mode !== 'first';
      if (d.avatar) {
        d.avatar.root.visible = false;
      }
      if (d.local && g.cameraRig.mode === 'third') g.cameraRig.avatar.visible = false;
    }
    for (const [id, r] of this.disguises)
      if (!disguises.has(id)) {
        r.mesh.parent?.remove(r.mesh);
        disposeProp(r.mesh);
        this.disguises.delete(id);
      }
  }
}
