import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
export class Optics {
  constructor(game) {
    this.game = game;
    this.records = new Map();
    this.clock = 0;
    this.capturing = false;
  }
  remove(id) {
    const r = this.records.get(id);
    if (!r) return;
    r.object.parent?.remove(r.object);
    r.object.geometry?.dispose();
    r.object.material?.dispose();
    r.target?.dispose();
    r.reflector?.getRenderTarget().dispose();
    this.records.delete(id);
  }
  update(dt) {
    const g = this.game;
    this.clock += dt;
    for (const [id] of this.records) if (!g.sim.entities.has(id)) this.remove(id);
    for (const e of g.sim.entities.values())
      if ((e.type === 'mirror' || e.type === 'monitor') && !this.records.has(e.id)) {
        const root = g.props.meshes.get(e.id);
        if (!root) continue;
        if (
          e.type === 'mirror' &&
          [...this.records.values()].filter((r) => r.reflector).length < 2
        ) {
          const reflector = new Reflector(new T.PlaneGeometry(2.3, 2.8), {
            textureWidth: 256,
            textureHeight: 256,
            color: 0xc7d7dc,
            clipBias: 0.003,
          });
          reflector.position.z = 0.08;
          const render = reflector.onBeforeRender.bind(reflector);
          let last = 0;
          reflector.onBeforeRender = (...args) => {
            const now = performance.now();
            if (
              this.capturing ||
              now - last < 100 ||
              root.position.distanceTo(g.view.camera.position) > 45
            )
              return;
            last = now;
            render(...args);
          };
          root.add(reflector);
          this.records.set(e.id, { object: reflector, reflector });
        } else if (
          e.type === 'monitor' &&
          [...this.records.values()].filter((r) => r.target).length < 2
        ) {
          const target = new T.WebGLRenderTarget(256, 144),
            screen = new T.Mesh(
              new T.PlaneGeometry(2.2, 1.3),
              new T.MeshBasicMaterial({ map: target.texture, side: T.DoubleSide }),
            );
          screen.position.z = 0.15;
          root.add(screen);
          this.records.set(e.id, {
            object: screen,
            target,
            camera: new T.PerspectiveCamera(65, 256 / 144, 0.1, 150),
          });
        }
      }
    if (this.clock < 0.15) return;
    this.clock = 0;
    this.capturing = true;
    const renderer = g.view.renderer,
      previous = renderer.getRenderTarget(),
      viewVisible = g.tools.viewmodel.root.visible,
      avatarVisible = g.cameraRig.avatar.visible,
      shadows = renderer.shadowMap.autoUpdate;
    const reflectors = [...this.records.values()].filter((r) => r.reflector);
    reflectors.forEach((r) => (r.object.visible = false));
    g.tools.viewmodel.root.visible = false;
    g.cameraRig.avatar.visible = !g.actor.disguise;
    const disguise = g.lab?.modeView.disguises.get(g.owner)?.mesh,
      disguiseVisible = disguise?.visible;
    if (disguise) disguise.visible = true;
    renderer.shadowMap.autoUpdate = false;
    try {
      for (const [id, r] of this.records)
        if (r.target) {
          const e = g.sim.entities.get(id),
            source = g.sim.entities.get(e.behavior.camera);
          if (!source || source.type !== 'cctv') continue;
          r.camera.position.copy(source.body.position);
          r.camera.quaternion.copy(source.body.quaternion);
          r.camera.translateZ(-0.65);
          r.camera.updateMatrixWorld(true);
          renderer.setRenderTarget(r.target);
          renderer.render(g.view.scene, r.camera);
        }
    } finally {
      renderer.setRenderTarget(previous);
      renderer.shadowMap.autoUpdate = shadows;
      g.tools.viewmodel.root.visible = viewVisible;
      g.cameraRig.avatar.visible = avatarVisible;
      if (disguise) disguise.visible = disguiseVisible;
      reflectors.forEach((r) => (r.object.visible = true));
      this.capturing = false;
    }
  }
}
