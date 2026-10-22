import * as T from 'three';
// The visual rope uses local attachment pivots, so it follows rotating props.
export class ConstraintView {
  constructor(game) {
    this.game = game;
    this.lines = new Map();
  }
  event(e) {
    if (e.type === 'constraint' && e.constraint.type === 'rope') {
      const c = e.constraint,
        line = new T.Line(
          new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
          new T.LineBasicMaterial({ color: '#e8d8a7' }),
        );
      line.frustumCulled = false;
      this.lines.set(c.id, { line, c });
      this.game.view.scene.add(line);
    }
    if (e.type === 'unconstraint') this.remove(e.id);
  }
  remove(id) {
    const r = this.lines.get(id);
    if (r) {
      this.game.view.scene.remove(r.line);
      r.line.geometry.dispose();
      r.line.material.dispose();
      this.lines.delete(id);
    }
  }
  update() {
    for (const { line, c } of this.lines.values()) {
      const a = this.game.props.meshes.get(c.a),
        b = this.game.props.meshes.get(c.b);
      if (!a || !b) {
        line.visible = false;
        continue;
      }
      line.visible = true;
      const p = a.localToWorld(new T.Vector3(...c.pa).divideScalar(a.scale.x)),
        q = b.localToWorld(new T.Vector3(...c.pb).divideScalar(b.scale.x));
      const middle = p.clone().lerp(q, 0.5);
      middle.y -= Math.max(0, (c.length - p.distanceTo(q)) * 0.35);
      line.geometry.setFromPoints([p, middle, q]);
    }
  }
}
