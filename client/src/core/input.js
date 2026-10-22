// Edge-triggered actions are consumed once; held movement is sampled every tick.
export class Input {
  constructor(canvas, onUnlock, onLock) {
    this.canvas = canvas;
    this.active = false;
    this.keys = new Set();
    this.edges = new Set();
    this.buttons = new Set();
    this.clicks = [];
    this.wheel = 0;
    this.dx = 0;
    this.dy = 0;
    document.addEventListener('pointerlockchange', () => {
      this.active = this.locked;
      // resume() clears stale input before requesting the lock. Clearing here on
      // entry would erase a fresh keypress arriving before this queued event.
      if (this.locked) {
        this.dx = this.dy = 0;
        onLock?.();
      } else {
        this.clear();
        onUnlock?.();
      }
      canvas.dataset.pointerLocked = String(this.locked);
    });
    document.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Escape' && this.locked) {
        this.unlock();
        return;
      }
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
      if (['F2', 'F3', 'F5'].includes(e.code)) e.preventDefault();
      if (this.locked && ['Space', 'Tab', 'KeyQ', 'KeyT', 'Backquote'].includes(e.code))
        e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.active) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) {
        this.buttons.add(e.button);
        this.clicks.push(e.button);
      }
    });
    document.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) {
          this.wheel += Math.sign(e.deltaY);
          e.preventDefault();
        }
      },
      { passive: false },
    );
    window.addEventListener('blur', () => this.clear());
  }
  get locked() {
    return document.pointerLockElement === this.canvas;
  }
  lock() {
    this.active = false;
    this.canvas.focus();
    return this.canvas.requestPointerLock();
  }
  unlock() {
    this.active = false;
    this.dx = this.dy = 0;
    document.exitPointerLock?.();
  }
  pressed(code) {
    const hit = this.edges.has(code);
    this.edges.delete(code);
    return hit;
  }
  down(code) {
    return this.keys.has(code);
  }
  clear() {
    this.keys.clear();
    this.edges.clear();
    this.buttons.clear();
    this.clicks.length = 0;
    this.wheel = 0;
    this.dx = this.dy = 0;
  }
  movement() {
    return {
      forward: +this.down('KeyW') - +this.down('KeyS'),
      right: +this.down('KeyD') - +this.down('KeyA'),
      jump: this.down('Space'),
      sprint: this.down('ShiftLeft'),
      crouch: this.down('KeyC'),
      binds: ['KeyF', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO'].filter((k) => this.down(k)),
    };
  }
}
