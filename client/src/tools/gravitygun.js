export class GravityGun {
  constructor(game) {
    this.game = game;
    this.held = null;
  }
  click(button) {
    const g = this.game,
      hit = g.props.aim(g.view.camera, 18);
    if (button === 2) {
      if (this.held) this.drop();
      else if (hit) {
        this.held = hit.id;
        g.action({ kind: 'grab', id: hit.id, point: hit.point.toArray(), distance: 3.8 });
      }
    } else if (button === 0 && (this.held || hit)) {
      g.action({ kind: 'launch', id: this.held || hit.id });
      this.held = null;
      g.effects?.burst(
        g.view.camera.position.clone().addScaledVector(g.direction(), 2),
        '#f7b46e',
        8,
      );
    }
  }
  tick() {
    if (this.held && !this.game.sim.entities.has(this.held)) this.drop();
  }
  drop() {
    if (this.held) this.game.action({ kind: 'release' });
    this.held = null;
  }
}
