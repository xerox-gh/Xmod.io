export async function openMultiplayer(game, panel) {
  const modal = panel.querySelector('.modal'),
    content = document.createElement('div');
  content.className = 'mp-content';
  modal.append(content);
  modal.querySelector('.muted')?.remove();
  content.innerHTML =
    '<div class="mp-identity"><label>YOUR NAME<input id="player-name" aria-label="Player name" maxlength="20" placeholder="Builder"></label><label>NEW ROOM ID<input id="new-room" aria-label="New room ID" maxlength="32" placeholder="my-workshop"></label></div><div class="mp-actions"><button class="primary" id="create-room">Create room ↗</button><button id="refresh-rooms">Refresh rooms</button><button id="leave-room" hidden>Leave current room</button></div><p class="muted" id="room-status">Looking for rooms…</p><div class="room-list"></div><p class="muted mp-note">Rooms share one physics world. The first player is the room owner.<br>Run the Node server alongside Vite to play with friends.</p>';
  const name = content.querySelector('#player-name');
  try {
    name.value = localStorage.getItem('xmod.name') || 'Builder';
  } catch {
    name.value = 'Builder';
  }
  const status = content.querySelector('#room-status'),
    list = content.querySelector('.room-list');
  async function join(room) {
    try {
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
    try {
      const rooms = await game.net.rooms();
      list.replaceChildren();
      status.textContent = rooms.length
        ? 'AVAILABLE PLAYGROUNDS'
        : 'No active rooms. Create one to get started.';
      for (const room of rooms) {
        const row = document.createElement('button');
        row.className = 'room-row';
        const title = document.createElement('strong'),
          info = document.createElement('span');
        title.textContent = room.name;
        info.textContent = `${room.players} / ${room.maxPlayers} builders · ${room.props} bodies ↗`;
        row.append(title, info);
        row.onclick = () => join(room.id);
        list.append(row);
      }
    } catch (error) {
      status.textContent = 'Server unavailable. In another terminal, run: npm run server';
    }
  }
  content.querySelector('#create-room').onclick = () =>
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
