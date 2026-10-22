const defaults = { fov: 90, sensitivity: 1, volume: 0.35, shadows: true, pixelRatio: 1.5 };
export function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('xmod.settings') || '{}') };
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(settings) {
  try {
    localStorage.setItem('xmod.settings', JSON.stringify(settings));
  } catch {
    /* Private mode can disable storage. */
  }
}
