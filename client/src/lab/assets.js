import * as T from 'three';
import * as C from 'cannon-es';
import { loadCard } from './codec.js';
import { validateBuild } from '../../../shared/builds.js';
// Session-only imports. The loader can resolve only supplied files and embedded
// data URIs; importing a glTF never starts a remote asset download.
export class LocalAssets {
  constructor(lab) {
    this.lab = lab;
    this.items = new Map();
    this.serial = 0;
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files.length) {
        e.preventDefault();
        this.import([...e.dataTransfer.files]).catch((error) => lab.game.toast(error.message));
      }
    });
  }
  target() {
    const g = this.lab.game;
    return g.sim.entities.get(g.props.aim(g.view.camera)?.id || this.lab.target);
  }
  position() {
    this.lab.ensurePlayground();
    const g = this.lab.game;
    return g.view.camera.position.clone().addScaledVector(g.direction(), 5).toArray();
  }
  async import(files, mode = 'auto') {
    const g = this.lab.game;
    if (g.net.connected) throw new Error('Local asset files are available in solo play');
    if (files.some((f) => f.size > 32e6))
      throw new Error('Each imported asset must be below 32 MB');
    if (this.items.size + files.length > 32)
      throw new Error('This session already has 32 imported assets');
    if ((this.bytes || 0) + files.reduce((n, f) => n + f.size, 0) > 96e6)
      throw new Error('Session imports are limited to 96 MB');
    this.bytes = (this.bytes || 0) + files.reduce((n, f) => n + f.size, 0);
    const models = files.filter((f) => /\.(glb|gltf)$/i.test(f.name));
    for (const file of models) await this.model(file, files);
    for (const file of files.filter((f) => !models.includes(f))) {
      if (/\.png$/i.test(file.name)) {
        const build = await loadCard(file);
        if (build) {
          this.lab.loadBuild(build);
          g.toast('PNG save card loaded');
          continue;
        }
      }
      if (/\.(png|jpg|jpeg|webp)$/i.test(file.name)) await this.image(file, mode);
      else if (/\.(mp3|wav|ogg)$/i.test(file.name)) await this.audio(file);
      else if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(await file.text());
        if (data.format === 'xmod-replay') await g.recorder.import(file);
        else if (data.format === 'xmod-puppet') this.lab.puppets.play(data, true);
        else this.lab.loadBuild(validateBuild(data));
      }
    }
  }
  async model(file, files) {
    const g = this.lab.game,
      urls = new Map(),
      manager = new T.LoadingManager();
    for (const f of files) urls.set(f.name, URL.createObjectURL(f));
    manager.setURLModifier((url) => {
      if (url.startsWith('data:')) return url;
      const name = decodeURIComponent(url.split('/').at(-1));
      if (urls.has(name)) return urls.get(name);
      throw new Error(
        'Missing local glTF dependency: ' + name + '. Drop its .bin and texture files together.',
      );
    });
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader(manager),
        data = /\.gltf$/i.test(file.name) ? await file.text() : await file.arrayBuffer(),
        gltf = await loader.parseAsync(data, '');
      let vertices = 0;
      gltf.scene.traverse((m) => {
        if (m.isMesh) vertices += m.geometry.attributes.position?.count || 0;
      });
      if (vertices > 250000) throw new Error('Model exceeds the 250,000-vertex session limit');
      const bounds = new T.Box3().setFromObject(gltf.scene),
        size = bounds.getSize(new T.Vector3()),
        center = bounds.getCenter(new T.Vector3()),
        fit = 3 / Math.max(size.x, size.y, size.z, 0.001),
        root = new T.Group();
      gltf.scene.position.copy(center).multiplyScalar(-fit);
      gltf.scene.scale.setScalar(fit);
      root.add(gltf.scene);
      const id = 'asset' + ++this.serial;
      this.items.set(id, { kind: 'model', root, size: size.multiplyScalar(fit), name: file.name });
      const e = g.sim.spawn('custom_model', this.position(), 'local', { behavior: { asset: id } });
      g.sim.remember('local', { group: e.group });
      this.applyModel(e, id);
      g.toast('Model imported · box collision proxy fits its bounds');
    } finally {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    }
  }
  applyModel(e, id) {
    const asset = this.items.get(id),
      root = this.lab.game.props.meshes.get(e.id);
    if (!asset || !root || root.userData.asset === id) return;
    for (const child of root.children) child.visible = false;
    const model = asset.root.clone(true);
    model.traverse((m) => {
      if (m.isMesh) {
        m.userData.paint = true;
        m.material = Array.isArray(m.material)
          ? m.material.map((mat) => mat.clone())
          : m.material.clone();
        root.userData.materials.push(...(Array.isArray(m.material) ? m.material : [m.material]));
      }
    });
    root.add(model);
    root.userData.asset = id;
    while (e.body.shapes.length) e.body.removeShape(e.body.shapes[0]);
    e.body.addShape(
      new C.Box(new C.Vec3(...asset.size.toArray().map((n) => Math.max(0.1, n / 2) * e.scale))),
    );
    e.body.updateBoundingRadius();
    e.body.updateMassProperties();
    e.body.aabbNeedsUpdate = true;
  }
  async image(file, mode) {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 16e6) {
      bitmap.close();
      throw new Error('Image exceeds 16 megapixels');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const id = 'asset' + ++this.serial;
    this.items.set(id, { kind: 'texture', texture, name: file.name });
    const g = this.lab.game;
    let e = this.target();
    if (mode === 'nextbot' || !e)
      e = g.sim.spawn('nextbot', this.position(), 'local', { behavior: { asset: id } });
    e.behavior.asset = id;
    const root = g.props.meshes.get(e.id);
    if (e.type === 'nextbot') root.userData.spriteTexture = texture;
    else
      root.traverse((child) => {
        if (child.isMesh && child.userData.paint) {
          child.material.map = texture;
          child.material.needsUpdate = true;
        }
      });
    g.toast(e.type === 'nextbot' ? 'Chaser image loaded' : 'Texture applied to aimed prop');
  }
  async audio(file) {
    const g = this.lab.game;
    await g.effects.audio.unlock();
    const buffer = await g.effects.audio.context.decodeAudioData(await file.arrayBuffer());
    if (buffer.duration > 120) throw new Error('Audio clips must be under two minutes');
    const id = 'asset' + ++this.serial;
    this.items.set(id, { kind: 'audio', buffer, name: file.name });
    let e = this.target();
    if (e?.type !== 'sound_emitter') e = g.sim.spawn('sound_emitter', this.position(), 'local');
    e.behavior.asset = id;
    this.play(e);
    g.toast('Audio attached · wire A to replay the clip');
  }
  play(e) {
    const asset = this.items.get(e?.behavior.asset),
      synth = this.lab.game.effects.audio,
      c = synth.context;
    if (asset?.kind !== 'audio' || !c || synth.voices >= 24) return;
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = asset.buffer;
    gain.gain.value = this.lab.game.settings.volume * 0.5;
    synth.position = e.body.position.toArray();
    source.connect(gain);
    const panner = synth.output(gain);
    source.start();
    synth.voices++;
    source.onended = () => {
      synth.voices--;
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }
  update() {
    for (const e of this.lab.game.sim.entities.values()) {
      if (e.type === 'custom_model' && this.items.has(e.behavior.asset))
        this.applyModel(e, e.behavior.asset);
      if (this.items.get(e.behavior.asset)?.kind === 'audio') {
        const state = this.lab.game.sim.lab.state(e.id),
          on = (this.lab.game.sim.lab.values.get(e.id)?.a || 0) > 0;
        if (on && !state.audioOn) this.play(e);
        state.audioOn = on;
      }
    }
  }
}
