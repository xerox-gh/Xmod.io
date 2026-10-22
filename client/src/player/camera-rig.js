import * as T from 'three';
import * as C from 'cannon-es';
export const CAMERA_MODES = ['first', 'third', 'chase', 'free'];
export class CameraRig {
  constructor(game) {
    this.game = game;
    this.mode = 'first';
    this.free = new T.Vector3();
    this.avatar = new T.Group();
    const material = new T.MeshStandardMaterial({ color: '#97c5c5', flatShading: true });
    const part = (s, p) => {
      const m = new T.Mesh(new T.BoxGeometry(...s), material);
      m.position.set(...p);
      this.avatar.add(m);
    };
    part([0.55, 0.7, 0.3], [0, 0.15, 0]);
    part([0.4, 0.4, 0.4], [0, 0.72, 0]);
    for (const x of [-0.2, 0.2]) {
      part([0.18, 0.7, 0.2], [x, -0.5, 0]);
      part([0.15, 0.6, 0.17], [x * 1.9, 0.1, 0]);
    }
    game.view.scene.add(this.avatar);
  }
  set(mode) {
    if (!CAMERA_MODES.includes(mode)) return;
    if (mode === 'free') {
      this.free.copy(this.game.view.camera.position);
      this.game.player.state.body.velocity.setZero();
    }
    this.mode = mode;
    this.game.tools.deactivate();
    this.game.toast(`Camera: ${mode}`);
  }
  cycle() {
    this.set(CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]);
  }
  update(dt) {
    const g = this.game,
      c = g.view.camera,
      p = g.player.state.body.position;
    this.avatar.position.copy(p);
    this.avatar.rotation.y = g.player.yaw;
    this.avatar.visible = this.mode === 'third' && !g.vehicleId && g.started;
    if (this.mode === 'free') {
      if (g.input.locked) {
        const packet = g.player.packet || {},
          speed = g.input.down('ShiftLeft') ? 28 : 12,
          dir = new T.Vector3(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw)),
          right = new T.Vector3(Math.cos(g.player.yaw), 0, -Math.sin(g.player.yaw));
        this.free
          .addScaledVector(dir, (packet.forward || 0) * dt * speed)
          .addScaledVector(right, (packet.right || 0) * dt * speed);
        this.free.y += ((packet.jump ? 1 : 0) - (packet.crouch ? 1 : 0)) * dt * speed;
      }
      c.position.copy(this.free);
    } else if (this.mode === 'third' || (this.mode === 'chase' && g.vehicleId)) {
      const target = new T.Vector3(p.x, p.y + 1, p.z),
        offset = new T.Vector3(0, 2, g.vehicleId ? 9 : 5).applyAxisAngle(
          new T.Vector3(0, 1, 0),
          g.player.yaw,
        ),
        end = target.clone().add(offset),
        hit = new C.RaycastResult();
      g.sim.world.raycastClosest(
        new C.Vec3(...target.toArray()),
        new C.Vec3(...end.toArray()),
        { collisionFilterMask: 1, skipBackfaces: true },
        hit,
      );
      if (hit.hasHit) end.copy(hit.hitPointWorld).lerp(target, 0.15);
      c.position.copy(end);
      const aim = new T.Vector3(0, 0, -1).applyEuler(
        new T.Euler(g.player.pitch, g.player.yaw, 0, 'YXZ'),
      );
      c.lookAt(target.clone().addScaledVector(aim, 20));
    }
  }
}
