import * as T from 'three';
export class PhysicsGun {
  constructor(game) {
    this.game = game;
    this.held = null;
    this.distance = 5;
    this.timer = 0;
    this.rotation = new T.Quaternion();
  }
  click(button) {
    const g = this.game,
      hit = g.props.aim(g.view.camera);
    if (button === 0 && hit) {
      this.held = hit.id;
      this.distance = g.view.camera.position.distanceTo(hit.point);
      this.rotation.copy(g.props.meshes.get(hit.id).quaternion);
      g.action({ kind: 'grab', id: hit.id, point: hit.point.toArray(), distance: this.distance });
    }
    if (button === 2 && (this.held || hit)) {
      g.action({ kind: 'freeze', id: this.held || hit.id });
      this.held = null;
    }
  }
  tick(dt) {
    const g = this.game,
      input = g.input;
    if (!input.buttons.has(0) && this.held) this.drop();
    if (this.held && !g.sim.entities.has(this.held)) this.drop();
    if (!this.held) return;
    g.player.rotating = input.down('KeyE');
    if (g.player.rotating) {
      const q = new T.Quaternion().setFromEuler(new T.Euler(input.dy * 0.008, input.dx * 0.008, 0));
      this.rotation.premultiply(q);
    }
    if (input.wheel) {
      this.distance = Math.max(2, Math.min(25, this.distance + input.wheel * 0.7));
      input.wheel = 0;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.05;
      g.action({
        kind: 'grabMove',
        distance: this.distance,
        rotate: g.player.rotating,
        q: this.rotation.toArray(),
      });
    }
  }
  drop() {
    if (this.held) this.game.action({ kind: 'release' });
    this.held = null;
    this.game.player.rotating = false;
  }
}
