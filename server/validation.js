export class Bucket {
  constructor(rate, capacity) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
    this.time = performance.now();
  }
  take(cost = 1) {
    const now = performance.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.time) / 1000) * this.rate);
    this.time = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
export function cleanName(value, fallback = 'Builder') {
  if (typeof value !== 'string') return fallback;
  return (
    value
      .replace(/[^\p{L}\p{N}_ -]/gu, '')
      .trim()
      .slice(0, 20) || fallback
  );
}
export function cleanRoom(value) {
  if (typeof value !== 'string' || !/^[-a-zA-Z0-9_]{1,32}$/.test(value))
    throw new Error('Room IDs use 1–32 letters, numbers, dashes or underscores');
  return value.toLowerCase();
}
export function validateInput(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !Number.isFinite(value.yaw) ||
    !Number.isFinite(value.pitch)
  )
    throw new Error('Invalid movement input');
  return {
    forward: Math.max(-1, Math.min(1, Number(value.forward) || 0)),
    right: Math.max(-1, Math.min(1, Number(value.right) || 0)),
    yaw: Math.atan2(Math.sin(value.yaw), Math.cos(value.yaw)),
    pitch: Math.max(-1.5, Math.min(1.5, value.pitch)),
    jump: !!value.jump,
    sprint: !!value.sprint,
    crouch: !!value.crouch,
    activate: !!value.activate,
  };
}
export function parseMessage(data) {
  if (data.length > 8192) throw new Error('Message is too large');
  const value = JSON.parse(data.toString());
  if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.type !== 'string')
    throw new Error('Invalid message');
  return value;
}
