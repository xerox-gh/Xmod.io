import { TOOL_MODES, TOOL_IDS } from '../../../shared/constants.js';
import * as C from 'cannon-es';
import { LAB_TOOLS, PAIR_TOOLS } from '../../../shared/lab/definitions.js';
const colors = ['#ed9f7c', '#d7fa94', '#8ac9cf', '#a3a6d9', '#e6c878', '#f1b7cf', '#e9e6d7'];
export class ToolGun {
  constructor(game) {
    this.game = game;
    this.first = null;
    this.color = 0;
    this.anchors = [];
  }
  cycle() {
    this.game.toolMode = (this.game.toolMode + 1) % TOOL_MODES.length;
    this.first = null;
    this.anchors = [];
    this.game.toast(`Tool gun: ${TOOL_MODES[this.game.toolMode]}`);
  }
  click(button) {
    const g = this.game,
      mode = TOOL_IDS[g.toolMode];
    if (button === 2) {
      if (mode === 'pulley') {
        const start = new C.Vec3(...g.view.camera.position.toArray()),
          end = start.vadd(new C.Vec3(...g.direction().toArray()).scale(60)),
          hit = new C.RaycastResult();
        g.sim.world.raycastClosest(
          start,
          end,
          { collisionFilterMask: 1, skipBackfaces: true },
          hit,
        );
        if (hit.hasHit) {
          if (this.anchors.length >= 4) this.anchors = [];
          this.anchors.push(hit.hitPointWorld.toArray());
          g.toast(`Pulley anchor ${this.anchors.length}/4 placed · LMB selects rope ends`);
        }
        return;
      }
      if (mode === 'paint') {
        this.color = (this.color + 1) % colors.length;
        g.toast(`Paint color: ${colors[this.color]}`);
      } else if (mode === 'resize') {
        const h = g.props.aim(g.view.camera);
        if (h) {
          const e = g.sim.entities.get(h.id);
          g.action({ kind: 'tool', mode, id: h.id, scale: e.scale / 1.25 });
        }
      } else {
        this.first = null;
        g.toast('Selection cleared');
      }
      return;
    }
    const hit = g.props.aim(g.view.camera);
    if (!hit) {
      g.toast('Aim at a prop first');
      return;
    }
    if (mode === 'duplicate') {
      g.action({
        kind: 'duplicate',
        id: hit.id,
        offset: [Math.cos(g.player.yaw) * 5, 1, -Math.sin(g.player.yaw) * 5],
      });
      return;
    }
    if (mode === 'pose') {
      g.workbench.target = hit.id;
      g.workbench.open('tools');
      return;
    }
    if (['weld', 'rope', 'motor', 'hinge', 'slider', ...PAIR_TOOLS].includes(mode)) {
      if (!this.first) {
        this.first = hit.id;
        this.point = hit.point.toArray();
        g.toast('First prop selected. Click a second prop.');
        return;
      }
      if (hit.id === this.first) {
        g.toast('Choose a different prop');
        return;
      }
      g.action({
        kind: 'tool',
        mode,
        id: this.first,
        other: hit.id,
        point: this.point,
        ...g.construction,
        ...(LAB_TOOLS.some(([id]) => id === mode) ? g.lab.settings : {}),
        anchors: this.anchors.length ? this.anchors : undefined,
        color: colors[this.color],
      });
      this.first = null;
      g.toast(`${TOOL_MODES[g.toolMode]} connection created`);
      return;
    }
    g.action({
      kind: 'tool',
      mode,
      id: hit.id,
      point: hit.point.toArray(),
      normal: (hit.normal || g.direction()).toArray(),
      color: colors[this.color],
      ...(LAB_TOOLS.some(([id]) => id === mode) ? g.lab.settings : {}),
    });
    g.effects?.burst(hit.point, mode === 'paint' ? colors[this.color] : '#d7fa94', 8);
    if (mode === 'paint') g.lab?.visuals.decalAt(hit, 'paint', colors[this.color]);
  }
  tick() {
    const label = this.game.root.querySelector('#target-label');
    if (this.game.toolId === 'toolgun')
      label.textContent = this.first
        ? 'FIRST PROP SELECTED · CLICK SECOND'
        : TOOL_MODES[this.game.toolMode] === 'Color Paint'
          ? `PAINT ${colors[this.color]} · RMB NEXT COLOR`
          : '';
    else label.textContent = '';
  }
}
