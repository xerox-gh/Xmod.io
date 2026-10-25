import { WEAPONS } from '../../../shared/weapons.js';
// The Q catalog equips weapons into slot 5, without spawning physics clutter.
export function renderWeaponCatalog(menu, grid, query) {
  const items = Object.entries(WEAPONS).filter(([id, w]) =>
    `${id} ${w.name}`.toLowerCase().includes(query),
  );
  grid.innerHTML =
    items
      .map(
        ([id, w]) =>
          `<button class="prop-card weapon-card" data-weapon="${id}" style="--prop-color:${w.accent || w.flash}"><span class="weapon-firemode">${w.automatic ? 'AUTO' : w.gun ? 'SEMI' : 'SPECIAL'}</span><span class="prop-art weapon-art" aria-hidden="true">${w.scope ? '⊕' : id === 'revolver' ? '◉' : w.gun ? '⌐' : '↗'}</span><strong>${w.name}</strong><span class="weapon-stats">${w.gadget ? 'Unlimited charge' : w.unlimited ? 'Melee' : `${w.capacity} rounds · ${w.reload}s reload`}</span><small>${w.scope ? 'Scoped precision' : w.automatic ? 'Hold LMB to fire' : w.gun ? 'Click to fire' : w.gadget ? 'Sandbox gadget' : 'Sandbox weapon'}<span>EQUIP ↗</span></small></button>`,
      )
      .join('') || '<p class="muted">No weapons found.</p>';
  grid.querySelectorAll('[data-weapon]').forEach(
    (button) =>
      (button.onclick = () => {
        menu.game.weapons.equip(button.dataset.weapon);
        menu.close();
      }),
  );
}
