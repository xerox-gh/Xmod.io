import { publicProps, CATEGORIES } from '../../../shared/props.js';
export class SpawnMenu {
  constructor(game, root) {
    this.game = game;
    this.category = 'All props';
    const read = (key) => {
      try {
        const v = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(v)
          ? v.filter((id) => publicProps.some(([key]) => key === id)).slice(0, 50)
          : [];
      } catch {
        return [];
      }
    };
    this.favorites = read('xmod.favorites');
    this.recents = read('xmod.recents');
    this.el = document.createElement('section');
    this.el.className = 'overlay spawn-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="catalog"><header><div><span class="eyebrow">THE OBJECT LIBRARY</span><h2>A little bit of everything.</h2></div><button class="icon-button close-catalog" aria-label="Close spawn menu">×</button></header><div class="catalog-body"><aside>${['All props', 'Favorites', 'Recent', ...CATEGORIES.filter((c) => c !== 'All props')].map((c, i) => `<button class="category ${i ? '' : 'active'}" data-category="${c}">${c}<span>↗</span></button>`).join('')}<p class="muted">Pick an object.<br>Make something weird.</p></aside><div class="catalog-content"><input id="prop-search" placeholder="Search props…" aria-label="Search props"><div id="prop-grid" class="prop-grid"></div></div></div><footer><span>Q / ESC to close</span><span>Click a card to spawn · 200 body limit</span></footer></div>`;
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
          ([id, p]) =>
            (this.category === 'All props' ||
              this.category === p.category ||
              (this.category === 'Favorites' && this.favorites.includes(id)) ||
              (this.category === 'Recent' && this.recents.includes(id))) &&
            p.name.toLowerCase().includes(query),
        )
        .sort((a, b) =>
          this.category === 'Recent' ? this.recents.indexOf(a[0]) - this.recents.indexOf(b[0]) : 0,
        )
        .map(
          ([id, p]) =>
            `<div class="prop-card-wrap"><button class="favorite-toggle" data-favorite="${id}" aria-label="Favorite ${p.name}" aria-pressed="${this.favorites.includes(id)}">${this.favorites.includes(id) ? '★' : '☆'}</button><button class="prop-card" data-prop="${id}" style="--prop-color:${p.color}"><span class="prop-art">${p.icon || '▣'}</span><strong>${p.name}</strong><small>${p.category}<span>+ SPAWN</span></small></button></div>`,
        )
        .join('') || '<p class="muted">No objects found.</p>';
    grid.querySelectorAll('[data-favorite]').forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.favorite;
          this.favorites = this.favorites.includes(id)
            ? this.favorites.filter((x) => x !== id)
            : [id, ...this.favorites].slice(0, 50);
          this.persist();
          this.render();
        }),
    );
    grid.querySelectorAll('[data-prop]').forEach(
      (b) =>
        (b.onclick = () => {
          this.game.spawner.selected = b.dataset.prop;
          this.game.spawner.spawn();
          this.game.toast(`${b.querySelector('strong').textContent} spawned`);
        }),
    );
  }
  persist() {
    try {
      localStorage.setItem('xmod.favorites', JSON.stringify(this.favorites));
      localStorage.setItem('xmod.recents', JSON.stringify(this.recents));
    } catch {
      /* Optional preferences. */
    }
  }
  recent(id) {
    if (!publicProps.some(([key]) => key === id)) return;
    this.recents = [id, ...this.recents.filter((x) => x !== id)].slice(0, 30);
    this.persist();
  }
  open() {
    this.render();
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
