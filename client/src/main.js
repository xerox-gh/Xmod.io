import './ui/style.css';
import './ui/multiplayer.css';
import { Game } from './core/game.js';
try {
  const game = new Game();
  game.start();
} catch (error) {
  console.error(error);
  document.querySelector('#ui').innerHTML =
    '<div class="stage-menu"><h1>Xmod.io</h1><p>The renderer could not start. Check that WebGL is enabled, then reload.</p></div>';
}
