import { publicProps, CATEGORIES } from '../../../shared/props.js';
export class SpawnMenu {
  constructor(game, root) {
    this.game = game;
    this.category = 'All props';
    this.el = document.createElement('section');
    this.el.className = 'overlay spawn-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="catalog"><header><div><span class="eyebrow">THE OBJECT LIBRARY</span><h2>A little bit of everything.</h2></div><button class="icon-button close-catalog" aria-label="Close spawn menu">×</button></header><div class="catalog-body"><aside>${CATEGORIES.map((c, i) => `<button class="category ${i ? '' : 'active'}" data-category="${c}">${c}<span>↗</span></button>`).join('')}<p class="muted">Pick an object.<br>Make something weird.</p></aside><div class="catalog-content"><input id="prop-search" placeholder="Search props…" aria-label="Search props"><div id="prop-grid" class="prop-grid"></div></div></div><footer><span>Q / ESC to close</span><span>Click a card to spawn · 200 body limit</span></footer></div>`;
    root.append(this.el);
    this.el.querySelector('.close-catalog').onclick = () => this.close();
    this.el.querySelectorAll('[data-category]').forEach(
      (b) =>
        (b.onclick = () => {
          this.category = b.dataset.category;
          this.el
            .querySelectorAll('.category')
            .forEach((c) => c.classList.toggle('active', c === b));
          this.render();
        }),
    );
    this.el.querySelector('input').oninput = () => this.render();
    this.render();
    document.addEventListener('keydown', (e) => {
      if (
        !this.el.hidden &&
        (e.code === 'Escape' || (e.code === 'KeyQ' && e.target.tagName !== 'INPUT'))
      ) {
        e.preventDefault();
        this.close();
      }
    });
  }
  render() {
    const query = this.el.querySelector('input').value.toLowerCase(),
      grid = this.el.querySelector('#prop-grid');
    grid.innerHTML =
      publicProps
        .filter(
          ([, p]) =>
            (this.category === 'All props' || this.category === p.category) &&
            p.name.toLowerCase().includes(query),
        )
        .map(
          ([id, p]) =>
            `<button class="prop-card" data-prop="${id}" style="--prop-color:${p.color}"><span class="prop-art">${p.icon || '▣'}</span><strong>${p.name}</strong><small>${p.category}<span>+ SPAWN</span></small></button>`,
        )
        .join('') || '<p class="muted">No objects found.</p>';
    grid.querySelectorAll('button').forEach(
      (b) =>
        (b.onclick = () => {
          this.game.spawner.selected = b.dataset.prop;
          this.game.spawner.spawn();
          this.game.toast(`${b.querySelector('strong').textContent} spawned`);
        }),
    );
  }
  open() {
    this.game.overlay = 'spawn';
    this.game.input.unlock();
    this.el.hidden = false;
    this.game.menus.hide();
  }
  close() {
    this.el.hidden = true;
    this.game.resume();
  }
}
