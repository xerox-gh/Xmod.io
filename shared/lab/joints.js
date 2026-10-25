import * as C from 'cannon-es';
// Empty constraints are useful: no-collide suppresses only this body's pair;
// wires remain ordinary colliding props with a persistent logical connection.
class Link extends C.Constraint {
  update() {}
}
class RopeEquation extends C.Equation {
  constructor(a, b, anchors, length) {
    super(a, b, -8e4, 8e4);
    this.anchors = anchors;
    this.length = length;
  }
  computeB(h) {
    const first = new C.Vec3(...this.anchors[0]),
      last = new C.Vec3(...this.anchors.at(-1));
    const da = this.bi.position.vsub(first),
      db = this.bj.position.vsub(last);
    const la = da.normalize(),
      lb = db.normalize();
    this.jacobianElementA.spatial.copy(da);
    this.jacobianElementB.spatial.copy(db);
    this.jacobianElementA.rotational.setZero();
    this.jacobianElementB.rotational.setZero();
    let route = 0;
    for (let i = 1; i < this.anchors.length; i++)
      route += new C.Vec3(...this.anchors[i]).distanceTo(new C.Vec3(...this.anchors[i - 1]));
    return (
      -(la + lb + route - this.length) * this.a - this.computeGW() * this.b - h * this.computeGiMf()
    );
  }
}
export function labJoint(type, a, b, pa, pb, options) {
  if (type === 'wire' || type === 'nocollide')
    return new Link(a, b, { collideConnected: type === 'wire' });
  if (type === 'winch' || type === 'hydraulic')
    return new C.DistanceConstraint(a, b, options.length || a.position.distanceTo(b.position), 8e4);
  if (type === 'ballsocket')
    return new C.PointToPointConstraint(
      a,
      a.pointToLocalFrame(new C.Vec3(...pa)),
      b,
      b.pointToLocalFrame(new C.Vec3(...pb)),
      8e4,
    );
  if (type === 'pulley') {
    const anchors = options.anchors || [
      [a.position.x, Math.max(a.position.y, b.position.y) + 5, a.position.z],
      [b.position.x, Math.max(a.position.y, b.position.y) + 5, b.position.z],
    ];
    let length =
      a.position.distanceTo(new C.Vec3(...anchors[0])) +
      b.position.distanceTo(new C.Vec3(...anchors.at(-1)));
    for (let i = 1; i < anchors.length; i++)
      length += new C.Vec3(...anchors[i]).distanceTo(new C.Vec3(...anchors[i - 1]));
    const joint = new Link(a, b);
    joint.anchors = anchors;
    joint.rope = new RopeEquation(a, b, anchors, options.length || length);
    joint.equations.push(joint.rope);
    return joint;
  }
  return null;
}
