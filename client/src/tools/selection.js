import * as T from 'three';
export class Selection {
  constructor(game) {
    this.game = game;
    this.ids = new Set();
    this.helpers = new Map();
    this.el = document.createElement('div');
    this.el.className = 'selection-overlay';
    this.el.hidden = true;
    this.el.innerHTML =
      '<div class="selection-bar"><strong>Group selection</strong><span id="selection-count">Drag a box around props. Ctrl adds.</span><label>X <input data-axis="0" type="number" value="0" step=".5"></label><label>Y <input data-axis="1" type="number" value="1" step=".5"></label><label>Z <input data-axis="2" type="number" value="0" step=".5"></label><button id="selection-move">Move group</button><button id="selection-delete">Delete group</button><button id="selection-clear">Clear selection</button><button id="selection-close">Done</button></div><div class="selection-box" hidden></div>';
    game.root.append(this.el);
    this.box = this.el.querySelector('.selection-box');
    this.el.onpointerdown = (e) => {
      if (e.target !== this.el) return;
      this.start = { x: e.clientX, y: e.clientY, add: e.ctrlKey };
      this.el.setPointerCapture(e.pointerId);
      this.box.hidden = false;
      this.drag(e);
    };
    this.el.onpointermove = (e) => {
      if (this.start) this.drag(e);
    };
    this.el.onpointerup = (e) => {
      if (!this.start) return;
      const { x, y, add } = this.start,
        rect = {
          left: Math.min(x, e.clientX),
          right: Math.max(x, e.clientX),
          top: Math.min(y, e.clientY),
          bottom: Math.max(y, e.clientY),
        };
      if (!add) this.ids.clear();
      for (const [id, mesh] of game.props.meshes) {
        const p = mesh.position.clone().project(game.view.camera),
          sx = ((p.x + 1) * innerWidth) / 2,
          sy = ((1 - p.y) * innerHeight) / 2;
        if (
          p.z > -1 &&
          p.z < 1 &&
          sx >= rect.left &&
          sx <= rect.right &&
          sy >= rect.top &&
          sy <= rect.bottom
        )
          this.ids.add(id);
      }
      this.start = null;
      this.box.hidden = true;
      this.label();
    };
    this.el.querySelector('#selection-close').onclick = () => this.close();
    this.el.querySelector('#selection-clear').onclick = () => {
      this.ids.clear();
      this.label();
    };
    this.el.querySelector('#selection-delete').onclick = () => {
      game.action({ kind: 'groupDelete', ids: [...this.ids] });
      this.label();
    };
    this.el.querySelector('#selection-move').onclick = () =>
      game.action({
        kind: 'groupMove',
        ids: [...this.ids],
        delta: [...this.el.querySelectorAll('[data-axis]')].map((e) => Number(e.value)),
      });
    document.addEventListener('keydown', (e) => {
      if (!this.el.hidden && e.code === 'Escape') this.close();
    });
  }
  drag(e) {
    const x = Math.min(this.start.x, e.clientX),
      y = Math.min(this.start.y, e.clientY);
    Object.assign(this.box.style, {
      left: x + 'px',
      top: y + 'px',
      width: Math.abs(this.start.x - e.clientX) + 'px',
      height: Math.abs(this.start.y - e.clientY) + 'px',
    });
  }
  label() {
    this.el.querySelector('#selection-count').textContent =
      `${this.ids.size} selected · Ctrl adds to selection`;
  }
  open() {
    this.game.overlay = 'selection';
    this.game.input.unlock();
    this.game.menus.hide();
    this.el.hidden = false;
    this.label();
  }
  close() {
    this.el.hidden = true;
    this.game.resume();
  }
  update() {
    let changed = false;
    for (const id of this.ids) {
      const mesh = this.game.props.meshes.get(id);
      if (!mesh) {
        this.ids.delete(id);
        changed = true;
        continue;
      }
      if (!this.helpers.has(id)) {
        const helper = new T.BoxHelper(mesh, '#d7fa94');
        this.game.view.scene.add(helper);
        this.helpers.set(id, helper);
      }
      this.helpers.get(id).update();
    }
    if (changed) this.label();
    for (const [id, h] of this.helpers)
      if (!this.ids.has(id)) {
        this.game.view.scene.remove(h);
        h.dispose();
        this.helpers.delete(id);
      }
  }
}
