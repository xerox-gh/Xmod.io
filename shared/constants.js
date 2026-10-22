// All protocol names and resource limits are shared by the client and authority.
export const LIMITS = Object.freeze({
  bodies: 200,
  perPlayer: 60,
  players: 12,
  rooms: 20,
  constraints: 200,
  world: 180,
  reach: 30,
});
export const STEP = 1 / 60;
export const SYNC_RATE = 20;
export const PROTOCOL = 1;
export const MSG = Object.freeze({
  JOIN: 'join',
  WELCOME: 'welcome',
  INPUT: 'input',
  SNAPSHOT: 'snapshot',
  ACTION: 'action',
  EVENT: 'event',
  CHAT: 'chat',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',
});
export const TOOL_MODES = [
  'Weld',
  'Rope',
  'Thruster',
  'Wheel',
  'Balloon',
  'Resize',
  'Color Paint',
  'Remover',
];
export const HOTBAR = [
  {
    id: 'physgun',
    name: 'Physics gun',
    hint: 'Hold LMB grab · wheel distance · E + mouse rotate · RMB freeze',
  },
  {
    id: 'toolgun',
    name: 'Tool gun',
    hint: 'R cycle mode · LMB apply · weld/rope: select two props',
  },
  {
    id: 'spawner',
    name: 'Prop spawner',
    hint: 'Q catalog · LMB place selected prop · RMB rotate preview',
  },
  {
    id: 'ragdoll',
    name: 'Ragdoll',
    hint: 'LMB spawn a jointed dummy · grab limbs with the physics gun',
  },
  { id: 'pistol', name: 'Pulse pistol', hint: 'LMB fire · R reload' },
  { id: 'shotgun', name: 'Scatter blaster', hint: 'LMB fire · R reload' },
  { id: 'rocket', name: 'Rocket launcher', hint: 'LMB launch · R reload' },
  { id: 'gravitygun', name: 'Gravity gun', hint: 'RMB pick up · LMB launch · RMB again drop' },
  {
    id: 'vehicle',
    name: 'Buggy',
    hint: 'LMB spawn · E enter/exit nearby vehicle · WASD drive · Space brake',
  },
];
