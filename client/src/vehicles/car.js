import * as T from 'three';
import { vehicleSnapshot } from '../../../shared/vehicles.js';
export class VehicleView {
  constructor(game) {
    this.game = game;
    this.states = [];
  }
  update() {
    const g = this.game,
      states = g.sim.remote ? this.states : vehicleSnapshot(g.sim);
    for (const v of states) {
      const root = g.props.meshes.get(v.id);
      if (!root) continue;
      root.updateMatrixWorld(true);
      let i = 0;
      for (const mesh of root.children.filter((m) => m.userData.wheel)) {
        const w = v.wheels[i++];
        if (!w) continue;
        mesh.position.copy(root.worldToLocal(new T.Vector3(...w.p)));
        mesh.quaternion.copy(
          root.quaternion
            .clone()
            .invert()
            .multiply(new T.Quaternion(...w.q)),
        );
      }
    }
    const id = g.player.state.vehicleId;
    if (id && !g.sim.entities.has(id)) {
      g.player.state.vehicleId = null;
      g.player.state.body.collisionResponse = true;
    }
    g.vehicleId = g.player.state.vehicleId;
    if (g.vehicleId) {
      const root = g.props.meshes.get(g.vehicleId);
      if (root) {
        const position = root.localToWorld(new T.Vector3(0, 1.2, 0.15));
        g.view.camera.position.copy(position);
      }
    }
  }
  interact() {
    const g = this.game;
    if (g.player.state.vehicleId) {
      g.action({ kind: 'vehicle' });
      return;
    }
    let closest = null,
      distance = 5;
    for (const e of g.sim.entities.values()) {
      const d = e.body.position.distanceTo(g.player.state.body.position);
      if (e.type === 'car' && d < distance) {
        closest = e.id;
        distance = d;
      }
    }
    if (closest) g.action({ kind: 'vehicle', id: closest });
  }
}
