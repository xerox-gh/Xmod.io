import * as C from 'cannon-es';
// Five bilateral equations lock rotation and two translations. The sixth is a
// travel stop, enabled only outside the rail. This is a prismatic joint.
export class SliderConstraint extends C.LockConstraint {
  constructor(a, b, axis = new C.Vec3(0, 1, 0), travel = 4) {
    super(a, b, { maxForce: 8e4 });
    this.railAxis = a.vectorToLocalFrame(axis);
    this.travel = travel;
  }
  update() {
    super.update();
    if (!this.railAxis) return;
    const axis = this.bodyA.vectorToWorldFrame(this.railAxis);
    axis.normalize();
    const u = axis.cross(Math.abs(axis.y) < 0.9 ? new C.Vec3(0, 1, 0) : new C.Vec3(1, 0, 0));
    u.normalize();
    const v = axis.cross(u);
    this.equationX.ni.copy(u);
    this.equationY.ni.copy(v);
    this.equationZ.ni.copy(axis);
    const a = this.bodyA.position.vadd(this.equationZ.ri),
      b = this.bodyB.position.vadd(this.equationZ.rj);
    const displacement = b.vsub(a).dot(axis),
      limit = Math.max(-this.travel, Math.min(this.travel, displacement));
    this.equationZ.enabled = Math.abs(displacement) > this.travel;
    this.equationZ.ri.vadd(axis.scale(limit), this.equationZ.ri);
  }
}
