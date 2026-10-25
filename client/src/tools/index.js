import { WEAPONS } from '../../../shared/weapons.js';
import { PhysicsGun } from './physgun.js';
import { GravityGun } from './gravitygun.js';
import { ViewModel } from './viewmodel.js';
import { ToolGun } from './toolgun.js';
export class Tools {
  constructor(game) {
    this.game = game;
    this.physgun = new PhysicsGun(game);
    this.gravitygun = new GravityGun(game);
    this.toolgun = new ToolGun(game);
    this.viewmodel = new ViewModel(game);
  }
  // Every tool boundary is isolated so an extension cannot break movement/rendering.
  safely(fn) {
    try {
      fn();
    } catch (error) {
      console.warn('Tool error:', error);
      this.game.toast(`Tool error: ${error.message}`);
      this.deactivate();
    }
  }
  deactivate() {
    this.physgun.drop();
    this.gravitygun.drop();
    this.game.player.rotating = false;
  }
  update(dt) {
    this.safely(() => {
      const g = this.game,
        input = g.input,
        id = g.toolId;
      this.physgun.tick(dt);
      this.gravitygun.tick(dt);
      if (input.wheel) {
        g.selectTool(g.slot + Math.sign(input.wheel));
        input.wheel = 0;
      }
      for (const button of input.clicks.splice(0)) {
        const tool = g.toolId;
        if (tool === 'physgun') this.physgun.click(button);
        else if (tool === 'gravitygun') this.gravitygun.click(button);
        else if (tool === 'spawner') g.spawner.click(button);
        else if (tool === 'ragdoll' && button === 0) g.spawner.spawn('ragdoll');
        else if (tool === 'vehicle' && button === 0) g.spawner.spawn(g.vehicleChoice || 'car');
        else if (tool === 'toolgun') this.toolgun?.click(button);
        else if (WEAPONS[tool]?.gadget && button === 2)
          g.action({ kind: 'gadget', weapon: tool, button: 2 });
        else if (button === 0) g.weapons?.fire(tool);
      }
      if (input.pressed('KeyR')) {
        if (['grapple', 'odm'].includes(g.toolId)) g.action({ kind: 'gadget', op: 'release' });
        else if (g.toolId === 'toolgun') this.toolgun?.cycle();
        else g.weapons?.reload(g.toolId);
      }
      if (WEAPONS[g.toolId]?.automatic && input.buttons.has(0)) g.weapons.fire(g.toolId);
      this.toolgun?.tick(dt);
    });
  }
}
