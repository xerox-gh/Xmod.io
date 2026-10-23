import * as T from 'three';
import { WEAPONS } from '../../../shared/weapons.js';
import { makeFirearmModels } from '../weapons/firearms.js';
import { makeExtraWeaponModels } from '../weapons/models.js';
// Original block-built tool silhouette, with an emissive core and a world-space beam.
export class ViewModel {
  constructor(game) {
    this.game = game;
    this.root = new T.Group();
    this.body = new T.Group();
    this.root.add(this.body);
    game.view.camera.add(this.root);
    game.view.scene.add(game.view.camera);
    const metal = new T.MeshStandardMaterial({ color: '#34474c', roughness: 0.6 }),
      light = new T.MeshStandardMaterial({ color: '#dce4cb' });
    this.core = new T.MeshStandardMaterial({
      color: '#bcf7b2',
      emissive: '#96e3b5',
      emissiveIntensity: 1.3,
    });
    this.materials = [metal, light, this.core];
    const part = (s, p, m) => {
      const mesh = new T.Mesh(new T.BoxGeometry(...s), m);
      mesh.position.set(...p);
      mesh.castShadow = false;
      this.body.add(mesh);
    };
    part([0.28, 0.25, 0.65], [0, 0, 0], metal);
    part([0.19, 0.14, 0.22], [0, 0.04, -0.35], light);
    part([0.12, 0.32, 0.15], [0, -0.25, 0.14], metal);
    part([0.12, 0.12, 0.4], [0, 0.2, -0.02], this.core);
    for (const x of [-0.17, 0.17]) part([0.06, 0.08, 0.55], [x, 0, -0.22], light);
    this.specials = { ...makeExtraWeaponModels(), ...makeFirearmModels() };
    for (const mesh of Object.values(this.specials)) {
      mesh.visible = false;
      this.root.add(mesh);
    }
    this.root.position.set(0.37, -0.32, -0.75);
    this.root.rotation.y = -0.1;
    this.beam = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineBasicMaterial({ color: '#c9ffac', transparent: true, opacity: 0.8 }),
    );
    this.beam.frustumCulled = false;
    game.view.scene.add(this.beam);
  }
  update(dt) {
    const g = this.game;
    this.root.visible =
      g.input.locked &&
      !g.vehicleId &&
      g.cameraRig?.mode === 'first' &&
      !(g.weapons.aiming && WEAPONS[g.toolId]?.scope);
    this.body.visible = !this.specials[g.toolId];
    for (const [id, model] of Object.entries(this.specials)) model.visible = id === g.toolId;
    const aiming = g.weapons.aiming,
      reload = Math.sin(g.weapons.reloadProgress(g.toolId) * Math.PI);
    this.root.rotation.z = g.toolId === 'crowbar' ? -g.player.recoil * 7 : reload * -0.3;
    this.root.rotation.x = reload * 0.45;
    this.root.position.x += ((aiming ? 0.12 : 0.37) - this.root.position.x) * Math.min(1, dt * 16);
    this.root.position.z = -0.75 + g.weapons.kick;
    this.root.position.y =
      -0.32 -
      reload * 0.1 +
      (aiming ? 0.06 : 0) +
      Math.sin(performance.now() * 0.006) *
        Math.min(
          0.018,
          Math.hypot(g.player.state.body.velocity.x, g.player.state.body.velocity.z) * 0.001,
        );
    const id = g.tools.physgun.held || g.tools.gravitygun.held,
      e = g.sim.entities.get(id);
    this.beam.visible = !!e && g.input.locked;
    if (e) {
      const a = g.view.camera.position.clone().addScaledVector(g.direction(), 0.8),
        b = new T.Vector3().copy(e.body.position);
      this.beam.geometry.setFromPoints([a, b]);
    }
    this.core.color.set(g.toolId === 'gravitygun' ? '#ffc184' : '#bde9b8');
    this.core.emissive.copy(this.core.color);
  }
}
