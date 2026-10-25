export class Chat {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('section');
    this.el.className = 'chat';
    this.el.innerHTML =
      '<div class="chat-log" aria-live="polite"></div><form hidden><input aria-label="Chat message" maxlength="180" placeholder="Say something…" autocomplete="off"><button>Send ↗</button></form>';
    root.append(this.el);
    this.form = this.el.querySelector('form');
    this.input = this.el.querySelector('input');
    this.form.onsubmit = (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (text && game.net.connected) game.net.send({ type: 'chat', text });
      else if (text && game.lab?.peers.role === 'host') {
        game.lab.peers.chat(text);
        this.message(game.lab.peers.name || 'Host', text);
      }
      this.input.value = '';
      this.close();
    };
    this.input.onkeydown = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
  }
  message(name, text) {
    const log = this.el.querySelector('.chat-log'),
      row = document.createElement('div'),
      label = document.createElement('strong');
    label.textContent = `${name}  `;
    row.append(label, document.createTextNode(text));
    log.append(row);
    while (log.childElementCount > 30) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  open() {
    if (!this.game.net.connected && this.game.lab?.peers.role !== 'host') {
      this.game.toast('Join a multiplayer room to chat');
      return;
    }
    this.game.overlay = 'chat';
    this.game.input.unlock();
    this.game.menus.hide();
    this.form.hidden = false;
    this.input.focus();
  }
  close() {
    this.form.hidden = true;
    this.game.resume();
  }
}
