import { validateBuild } from '../../../shared/builds.js';
const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
export function base64(bytes) {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function unbase64(text) {
  if (!/^[\w-]+$/.test(text) || text.length > 800000)
    throw new Error('Invalid or oversized compressed build');
  return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
}
async function collect(stream, max = 512000) {
  const reader = stream.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('Decompressed build is too large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
export async function packBuild(build) {
  validateBuild(build);
  const bytes = encoder.encode(JSON.stringify(build));
  if (bytes.length > 512000) throw new Error('Build is too large');
  if (typeof CompressionStream === 'undefined') return 'j.' + base64(bytes);
  return (
    'g.' +
    base64(await collect(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))))
  );
}
export async function unpackBuild(code) {
  if (typeof code !== 'string' || code.length > 800000) throw new Error('Invalid compressed build');
  const bytes = unbase64(code.slice(2));
  let decoded;
  if (code.startsWith('g.')) {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('This browser cannot open gzip build links');
    decoded = await collect(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    );
  } else if (code.startsWith('j.')) decoded = bytes;
  else throw new Error('Unsupported build encoding');
  return validateBuild(JSON.parse(decoder.decode(decoded)));
}
export async function buildURL(build, base = location.href) {
  const url = new URL(base);
  url.hash = 'build=' + (await packBuild(build));
  if (url.href.length > 24000)
    throw new Error(
      'This build is too large for a reliable link. Use a PNG save card or JSON file.',
    );
  return url.href;
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const bytes = new Uint8Array(data.length + 12),
    view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(encoder.encode(type), 4);
  bytes.set(data, 8);
  view.setUint32(data.length + 8, crc32(bytes.subarray(4, data.length + 8)));
  return bytes;
}
export async function saveCard(png, build) {
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (bytes[0] !== 137 || decoder.decode(bytes.subarray(1, 4)) !== 'PNG')
    throw new Error('A PNG screenshot is required');
  const text = encoder.encode('XmodBuild\0\0\0\0\0' + (await packBuild(build))),
    metadata = chunk('iTXt', text);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    if (decoder.decode(bytes.subarray(offset + 4, offset + 8)) === 'IEND') break;
    offset += length + 12;
  }
  return new Blob([bytes.subarray(0, offset), metadata, bytes.subarray(offset)], {
    type: 'image/png',
  });
}
export async function loadCard(png) {
  if (png.size > 32e6) throw new Error('PNG exceeds 32 MB');
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (bytes[0] !== 137) return null;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset),
      length = view.getUint32(0);
    if (length > 32e6 || offset + length + 12 > bytes.length) throw new Error('Invalid PNG chunk');
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8)),
      data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'iTXt' && decoder.decode(data.subarray(0, 10)) === 'XmodBuild\0') {
      if (view.getUint32(length + 8) !== crc32(bytes.subarray(offset + 4, offset + 8 + length)))
        throw new Error('PNG build metadata is damaged');
      return unpackBuild(decoder.decode(data.subarray(14)));
    }
    offset += length + 12;
  }
  return null;
}
