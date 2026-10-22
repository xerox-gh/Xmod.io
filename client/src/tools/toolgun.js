import { TOOL_MODES, TOOL_IDS } from '../../../shared/constants.js';
const colors = ['#ed9f7c', '#d7fa94', '#8ac9cf', '#a3a6d9', '#e6c878', '#f1b7cf', '#e9e6d7'];
export class ToolGun {
  constructor(game) {
    this.game = game;
    this.first = null;
    this.color = 0;
  }
  cycle() {
    this.game.toolMode = (this.game.toolMode + 1) % TOOL_MODES.length;
    this.first = null;
    this.game.toast(`Tool gun: ${TOOL_MODES[this.game.toolMode]}`);
  }
  click(button) {
    const g = this.game,
      mode = TOOL_IDS[g.toolMode];
    if (button === 2) {
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
    if (['weld', 'rope', 'motor', 'hinge', 'slider'].includes(mode)) {
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
      });
      this.first = null;
      g.toast(`${mode === 'weld' ? 'Weld' : 'Rope'} created`);
      return;
    }
    g.action({
      kind: 'tool',
      mode,
      id: hit.id,
      point: hit.point.toArray(),
      normal: (hit.normal || g.direction()).toArray(),
      color: colors[this.color],
    });
    g.effects?.burst(hit.point, mode === 'paint' ? colors[this.color] : '#d7fa94', 8);
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
