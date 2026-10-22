// A Pages build starts in solo mode until a hosted multiplayer server is supplied.
export function normalizeServerUrl(value, pageProtocol = 'https:') {
  if (!value?.trim()) return '';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter a server address starting with https://');
  }
  if (pageProtocol === 'https:' && url.protocol !== 'https:') {
    throw new Error('This page needs an HTTPS multiplayer server.');
  }
  if (url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Enter just the server origin, such as https://play.example.com');
  }
  return url.origin;
}
