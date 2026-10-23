import { createPlayer, movePlayer } from '../../../shared/movement.js';
export class PlayerController {
  constructor(world, camera, input, settings) {
    this.state = createPlayer(world);
    this.world = world;
    this.camera = camera;
    this.input = input;
    this.settings = settings;
    this.yaw = 0;
    this.pitch = -0.08;
    this.recoil = 0;
    this.aimScale = 1;
    this.zoomFov = null;
  }
  sample() {
    const input = this.input;
    if (!(input.down('KeyE') && this.rotating)) {
      this.yaw -= input.dx * 0.002 * this.settings.sensitivity * this.aimScale;
      this.pitch = Math.max(
        -1.5,
        Math.min(1.5, this.pitch - input.dy * 0.002 * this.settings.sensitivity * this.aimScale),
      );
    }
    input.dx = input.dy = 0;
    this.state.yaw = this.yaw;
    this.state.pitch = this.pitch;
    return (this.packet = { ...input.movement(), yaw: this.yaw, pitch: this.pitch });
  }
  step(dt) {
    movePlayer(this.state, this.packet || this.sample(), this.world, dt);
  }
  updateCamera(dt) {
    const b = this.state.body;
    this.camera.position.set(
      b.position.x,
      b.position.y + (this.state.crouched ? 0.25 : 0.65),
      b.position.z,
    );
    this.camera.rotation.set(this.pitch + this.recoil, this.yaw, 0);
    this.recoil *= Math.exp(-12 * dt);
    const targetFov = this.zoomFov ?? this.settings.fov + (this.input.down('ShiftLeft') ? 5 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();
  }
  setFly(value = !this.state.fly) {
    this.state.fly = value;
    this.state.body.velocity.setZero();
  }
}
