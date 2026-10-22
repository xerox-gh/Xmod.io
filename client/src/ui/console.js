export class GameConsole {
  constructor(game, root) {
    this.game = game;
    this.history = [];
    this.index = 0;
    this.el = document.createElement('section');
    this.el.className = 'console-panel';
    this.el.hidden = true;
    this.el.innerHTML =
      '<header><strong>XMOD.IO / CONSOLE</strong><span>` / ESC close</span></header><div class="console-log" aria-live="polite"></div><form><span>›</span><input aria-label="Console command" placeholder="/help" autocomplete="off" spellcheck="false"></form>';
    root.append(this.el);
    this.input = this.el.querySelector('input');
    this.log = this.el.querySelector('.console-log');
    this.print('Type /help for commands.');
    this.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const command = this.input.value.trim();
      if (!command) return;
      this.history.push(command);
      this.index = this.history.length;
      this.input.value = '';
      this.print(`› ${command}`);
      try {
        this.execute(command);
      } catch (err) {
        this.print(err.message);
      }
    };
    this.input.onkeydown = (e) => {
      if (e.code === 'Escape' || e.code === 'Backquote') {
        e.preventDefault();
        this.close();
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        this.index = Math.max(0, this.index - 1);
        this.input.value = this.history[this.index] || '';
      }
      if (e.code === 'ArrowDown') {
        this.index = Math.min(this.history.length, this.index + 1);
        this.input.value = this.history[this.index] || '';
      }
    };
  }
  print(text) {
    const line = document.createElement('div');
    line.textContent = text;
    this.log.append(line);
    while (this.log.childElementCount > 80) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
  execute(text) {
    const [cmd, ...args] = text.replace(/^\//, '').trim().split(/\s+/);
    const g = this.game;
    if (cmd === 'help')
      return this.print(
        '/spawn <prop> · /gravity <-40..40> · /clear · /noclip · /undo · /day · /night · /map <id> · /time <0|0.25|1> · /camera <first|third|chase|free> · /kick <name>',
      );
    if (cmd === 'spawn') {
      g.spawner.spawn(args[0] || 'barrel');
      return this.print(`Requested ${args[0] || 'barrel'}`);
    }
    if (cmd === 'gravity') {
      if (args.length !== 1 || !Number.isFinite(+args[0])) throw new Error('Usage: /gravity 0');
      g.action({ kind: 'gravity', value: +args[0] });
      return;
    }
    if (cmd === 'map') return g.action({ kind: 'map', map: args[0] });
    if (cmd === 'time') return g.action({ kind: 'time', value: Number(args[0]) });
    if (cmd === 'camera') return g.cameraRig.set(args[0]);
    if (cmd === 'clear' || cmd === 'undo' || cmd === 'noclip') return g.action({ kind: cmd });
    if (cmd === 'day' || cmd === 'night') {
      g.night = cmd === 'night';
      g.view.setNight(g.night);
      return;
    }
    if (cmd === 'kick') {
      if (!g.net?.connected) throw new Error('Join a room first');
      g.net.action({ kind: 'kick', name: args.join(' ') });
      return;
    }
    throw new Error('Unknown command. Try /help.');
  }
  open() {
    this.game.overlay = 'console';
    this.game.input.unlock();
    this.game.menus.hide();
    this.el.hidden = false;
    this.input.focus();
  }
  close() {
    this.el.hidden = true;
    this.game.resume();
  }
}
