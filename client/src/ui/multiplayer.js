export async function openMultiplayer(game, panel) {
  const modal = panel.querySelector('.modal');
  const content = document.createElement('div');
  content.className = 'mp-content';
  modal.append(content);
  modal.querySelector('.muted')?.remove();
  content.innerHTML = `
    <label class="mp-server">MULTIPLAYER SERVER
      <input id="server-url" aria-label="Multiplayer server URL" type="url" placeholder="https://your-server.example" autocomplete="off">
    </label>
    <div class="mp-identity">
      <label>YOUR NAME<input id="player-name" aria-label="Player name" maxlength="20" placeholder="Builder"></label>
      <label>NEW ROOM ID<input id="new-room" aria-label="New room ID" maxlength="32" placeholder="my-workshop"></label>
    </div>
    <div class="mp-actions">
      <button class="primary" id="create-room">Create room ↗</button>
      <button id="refresh-rooms">Refresh rooms</button>
      <button id="leave-room" hidden>Leave current room</button>
    </div>
    <p class="muted" id="room-status" role="status">Looking for rooms…</p>
    <div class="room-list"></div>
    <p class="muted mp-note">Solo play is always available. Online rooms need a multiplayer server.<br>Enter its address above to find friends and share a playground.</p>`;
  const name = content.querySelector('#player-name');
  const server = content.querySelector('#server-url');
  server.value = game.net.base;
  try {
    name.value = localStorage.getItem('xmod.name') || 'Builder';
  } catch {
    name.value = 'Builder';
  }
  const status = content.querySelector('#room-status');
  const list = content.querySelector('.room-list');
  const create = content.querySelector('#create-room');
  function configure() {
    game.net.setServer(server.value);
    create.disabled = !game.net.base;
    return !!game.net.base;
  }
  async function join(room) {
    try {
      if (!configure()) throw new Error('Add a multiplayer server URL first.');
      status.textContent = 'Joining room…';
      try {
        localStorage.setItem('xmod.name', name.value);
      } catch {}
      await game.net.connect(name.value || 'Builder', room);
      game.resume();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  async function refresh() {
    list.replaceChildren();
    try {
      if (!configure()) {
        status.textContent = 'Solo play is ready. Add a multiplayer server URL to play online.';
        return;
      }
      status.textContent = 'Looking for rooms…';
      const rooms = await game.net.rooms();
      status.textContent = rooms.length
        ? 'AVAILABLE PLAYGROUNDS'
        : 'No active rooms. Create one to get started.';
      for (const room of rooms) {
        const row = document.createElement('button');
        row.className = 'room-row';
        const title = document.createElement('strong');
        const info = document.createElement('span');
        title.textContent = room.name;
        info.textContent = `${room.players} / ${room.maxPlayers} builders · ${room.props} bodies ↗`;
        row.append(title, info);
        row.onclick = () => join(room.id);
        list.append(row);
      }
    } catch (error) {
      status.textContent = `Cannot load rooms. ${error.message}`;
    }
  }
  server.oninput = () => {
    create.disabled = !server.value.trim();
  };
  create.onclick = () =>
    join(
      content.querySelector('#new-room').value ||
        `workshop-${Math.random().toString(36).slice(2, 7)}`,
    );
  content.querySelector('#refresh-rooms').onclick = refresh;
  const leave = content.querySelector('#leave-room');
  leave.hidden = !game.net.connected;
  leave.onclick = () => {
    game.net.disconnect();
    game.menus.show();
    game.toast('Returned to solo mode');
  };
  await refresh();
}
