import { STEP } from '../../../shared/constants.js';
export function runLoop(frame, fixed) {
  let last = performance.now(),
    accumulator = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 5) {
      fixed(STEP);
      accumulator -= STEP;
    }
    if (steps > 5) accumulator = 0;
    frame(dt, now / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
