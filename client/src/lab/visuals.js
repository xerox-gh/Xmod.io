import * as T from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { Optics } from './optics.js';
export class LabVisuals {
  constructor(game) {
    this.game = game;
    this.records = new Map();
    this.lines = new Map();
    this.trails = new Map();
    this.decals = [];
    this.clock = 0;
    this.optics = new Optics(game);
    this.vortices = new Map();
    this.decalTextures = new Map();
    this.iceMeshes = [];
    this.weaponGeometry = new T.BoxGeometry(1, 1, 1);
    this.weaponMaterial = new T.MeshStandardMaterial({ color: '#33494b', flatShading: true });
  }
  removeRecord(id) {
    const r = this.records.get(id);
    if (!r) return;
    r.object?.parent?.remove(r.object);
    r.texture?.dispose();
    r.geometry?.dispose();
    r.material?.dispose();
    this.records.delete(id);
  }
  line(id, color = '#97d5ca') {
    if (!this.lines.has(id)) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(18), 3));
      const line = new T.Line(geo, new T.LineBasicMaterial({ color }));
      line.frustumCulled = false;
      this.game.view.scene.add(line);
      this.lines.set(id, line);
    }
    return this.lines.get(id);
  }
  setLine(line, points) {
    const a = line.geometry.attributes.position;
    points.forEach((p, i) => a.setXYZ(i, p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]));
    a.needsUpdate = true;
    line.geometry.setDrawRange(0, points.length);
  }
  clearLine(id) {
    const line = this.lines.get(id);
    if (line) {
      line.parent?.remove(line);
      line.geometry.dispose();
      line.material.dispose();
      this.lines.delete(id);
    }
  }
  prepare(e, root) {
    if (this.records.has(e.id)) return;
    if (e.type === 'glass_shard' && e.behavior.polygon) {
      const shape = new T.Shape(e.behavior.polygon.map((p) => new T.Vector2(...p))),
        geo = new T.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
      geo.translate(0, 0, -0.06);
      for (const c of root.children) c.visible = false;
      const mesh = new T.Mesh(geo, root.userData.materials[0]);
      mesh.userData.paint = true;
      root.add(mesh);
      root.userData.disposables ??= [];
      root.userData.disposables.push(geo);
      this.records.set(e.id, {});
    }
    if (
      [
        'digital_screen',
        'laser_sensor',
        'logic_and',
        'logic_or',
        'logic_not',
        'logic_xor',
        'logic_clock',
        'logic_latch',
      ].includes(e.type)
    ) {
      if ([...this.records.values()].filter((r) => r.canvas).length >= 16) return;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 144;
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      const geometry = new T.PlaneGeometry(
          e.type === 'digital_screen' ? 2.2 : 0.68,
          e.type === 'digital_screen' ? 1.3 : 0.4,
        ),
        material = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
        object = new T.Mesh(geometry, material);
      object.position.set(
        0,
        e.type === 'digital_screen' ? 0 : 0.17,
        e.type === 'digital_screen' ? 0.14 : 0,
      );
      if (e.type !== 'digital_screen') object.rotation.x = -Math.PI / 2;
      root.add(object);
      this.records.set(e.id, { canvas, texture, object, geometry, material, history: [] });
    }
    if (e.type === 'nextbot') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#b580a6';
      ctx.fillRect(8, 8, 112, 112);
      ctx.fillStyle = '#fff9dc';
      for (const x of [36, 90]) {
        ctx.beginPath();
        ctx.arc(x, 45, 19, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#252f3b';
      ctx.fillRect(36, 40, 9, 20);
      ctx.fillRect(90, 40, 9, 20);
      ctx.fillRect(27, 87, 78, 8);
      const texture = new T.CanvasTexture(canvas),
        material = new T.SpriteMaterial({ map: root.userData.spriteTexture || texture }),
        object = new T.Sprite(material);
      object.scale.set(2.5, 3.3, 1);
      root.add(object);
      this.records.set(e.id, { object, texture, material });
    }
  }
  update(dt) {
    const g = this.game,
      sim = g.sim;
    this.clock += dt;
    const draw = this.clock > 0.1;
    if (draw) this.clock = 0;
    for (const [id] of this.records) if (!sim.entities.has(id)) this.removeRecord(id);
    const alive = new Set();
    for (const c of sim.constraints.values())
      if (['wire', 'winch', 'hydraulic', 'pulley'].includes(c.type)) {
        const a = sim.entities.get(c.a),
          b = sim.entities.get(c.b);
        if (!a || !b) continue;
        alive.add(c.id);
        const line = this.line(c.id, c.type === 'wire' ? c.color : '#e3c58e');
        this.setLine(line, [
          a.body.position,
          ...(c.type === 'pulley' ? c.anchors || [] : []),
          b.body.position,
        ]);
        line.visible = !g.recorder.playing;
        if (c.type === 'wire')
          line.material.color.set(
            (sim.lab.values.get(c.a)?.out || 0) > 0 ? '#d7fa94' : c.color || '#87d8cc',
          );
      }
    for (const [owner, hooks] of sim.lab.grapples)
      for (const [hand, hook] of Object.entries(hooks)) {
        const id = 'hook' + owner + hand,
          actor = sim.lab.actors.get(owner);
        if (!actor) continue;
        alive.add(id);
        const e = sim.entities.get(hook.id),
          point = e ? e.body.pointToWorldFrame(hook.point) : hook.point;
        this.setLine(this.line(id, '#98e2f0'), [actor.state.body.position, point]);
      }
    for (const id of this.lines.keys()) if (!alive.has(id)) this.clearLine(id);
    for (const e of sim.entities.values()) {
      const root = g.props.meshes.get(e.id);
      if (!root) continue;
      this.prepare(e, root);
      const record = this.records.get(e.id),
        s = e.behavior,
        state = sim.lab.state(e.id);
      if (s.npcWeapon && !root.userData.npcGun) {
        const gun = new T.Group(),
          part = (scale, p) => {
            const m = new T.Mesh(this.weaponGeometry, this.weaponMaterial);
            m.scale.set(...scale);
            m.position.set(...p);
            gun.add(m);
          };
        if (s.npcWeapon === 'ranged') {
          part([0.14, 0.14, 0.65], [0, 0, -0.25]);
          part([0.11, 0.25, 0.12], [0, -0.14, 0]);
        } else part([0.1, 0.65, 0.1], [0, -0.2, -0.2]);
        gun.position.set(0.5, -0.1, -0.2);
        root.add(gun);
        root.userData.npcGun = gun;
      }
      if (root.userData.npcGun) {
        root.userData.npcGun.visible = !!s.npc;
        root.userData.npcGun.rotation.set(-(state.aimPitch || 0), state.aimYaw || 0, 0);
      }
      if (record?.object?.isSprite) {
        record.object.material.map = root.userData.spriteTexture || record.texture;
        record.object.material.needsUpdate = record.object.material.map !== record.lastMap;
        record.lastMap = record.object.material.map;
      }
      if (draw && record?.canvas) {
        const ctx = record.canvas.getContext('2d'),
          value = sim.lab.values.get(e.id)?.out || 0;
        ctx.fillStyle = '#152f34';
        ctx.fillRect(0, 0, 256, 144);
        ctx.fillStyle = '#bfe9b8';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(
          (s.text || e.type.replace('logic_', '').replace('_sensor', '')).slice(0, 16),
          12,
          33,
        );
        if (s.display === 'graph') {
          record.history.push(value);
          if (record.history.length > 60) record.history.shift();
          const max = Math.max(1, ...record.history.map(Math.abs));
          ctx.strokeStyle = '#8ce5d0';
          ctx.beginPath();
          record.history.forEach((v, i) => {
            const x = 10 + i * 4,
              y = 110 - (v / max) * 55;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke();
        } else {
          ctx.font = 'bold 38px monospace';
          ctx.fillText(s.display === 'text' ? s.text || '' : value.toFixed(2), 12, 100);
        }
        record.texture.needsUpdate = true;
      }
      if (e.type === 'turret')
        for (const child of root.children)
          if (child.userData.gimbal) {
            child.rotation.y = state.turretYaw || 0;
            child.rotation.x = -(state.turretPitch || 0);
          }
      if (e.type === 'gravity_zone') {
        const size = (s.zoneSize || 8) / 8;
        root.scale.set(e.scale * size, (e.scale * size * 8) / 6, e.scale * size);
        if (draw && root.position.distanceTo(g.view.camera.position) < 35)
          g.effects.burst(
            root.position
              .clone()
              .add(
                new T.Vector3(
                  (Math.random() - 0.5) * size * 8,
                  0,
                  (Math.random() - 0.5) * size * 8,
                ),
              ),
            '#b7a2ed',
            1,
          );
      }
      if (s.trail && s.trail !== 'off') this.ribbon(e, dt);
      else this.removeRibbon(e.id);
    }
    for (const id of this.trails.keys()) if (!sim.entities.has(id)) this.removeRibbon(id);
    for (const d of [...this.decals])
      if (d.owner && !sim.entities.has(d.owner)) this.removeDecal(d);
    this.updateVortices();
    for (const r of [...this.iceMeshes])
      if (sim.time > r.until) {
        r.mesh.parent?.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.iceMeshes.splice(this.iceMeshes.indexOf(r), 1);
      }
    this.optics.update(dt);
  }
  ribbon(e, dt) {
    let r = this.trails.get(e.id);
    if (!r) {
      if (this.trails.size >= 24) return;
      const geometry = new T.BufferGeometry(),
        positions = new Float32Array(64 * 2 * 3),
        colors = new Float32Array(positions.length),
        indices = [];
      for (let i = 0; i < 63; i++)
        indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      const material = new T.MeshBasicMaterial({
          vertexColors: true,
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
        mesh = new T.Mesh(geometry, material);
      mesh.frustumCulled = false;
      this.game.view.scene.add(mesh);
      r = { geometry, mesh, material, points: [], clock: 0 };
      this.trails.set(e.id, r);
    }
    r.clock += dt;
    if (r.clock < 0.05) return;
    r.clock = 0;
    r.points.unshift(new T.Vector3().copy(e.body.position));
    if (r.points.length > 64) r.points.pop();
    const p = r.geometry.attributes.position,
      c = r.geometry.attributes.color,
      color = new T.Color();
    r.points.forEach((point, i) => {
      const next = r.points[Math.min(i + 1, r.points.length - 1)],
        side = point
          .clone()
          .sub(next)
          .cross(new T.Vector3(0, 1, 0))
          .normalize()
          .multiplyScalar(e.behavior.trail === 'smoke' ? 0.16 : 0.06);
      if (!side.lengthSq()) side.x = 0.06;
      for (let j = 0; j < 2; j++) {
        const v = point.clone().addScaledVector(side, j ? 1 : -1);
        p.setXYZ(i * 2 + j, v.x, v.y, v.z);
        if (e.behavior.trail === 'rainbow') color.setHSL(i / 64, 0.8, 0.6);
        else color.set(e.behavior.trail === 'smoke' ? '#899b9d' : '#a9f2e2');
        color.multiplyScalar(1 - i / 70);
        c.setXYZ(i * 2 + j, color.r, color.g, color.b);
      }
    });
    p.needsUpdate = c.needsUpdate = true;
    r.geometry.setDrawRange(0, Math.max(0, (r.points.length - 1) * 6));
  }
  removeRibbon(id) {
    const r = this.trails.get(id);
    if (r) {
      r.mesh.parent?.remove(r.mesh);
      r.geometry.dispose();
      r.material.dispose();
      this.trails.delete(id);
    }
  }
  updateVortices() {
    const sim = this.game.sim;
    for (const [id, r] of sim.lab.singularities) {
      let mesh = this.vortices.get(id);
      if (!mesh) {
        mesh = new T.Mesh(
          new T.IcosahedronGeometry(0.3, 1),
          new T.MeshBasicMaterial({ color: '#6d3f91', wireframe: true }),
        );
        this.game.view.scene.add(mesh);
        this.vortices.set(id, mesh);
      }
      mesh.position.copy(r.p);
      mesh.rotation.y += 0.12;
      mesh.scale.setScalar(r.phase === 'vortex' ? 4 : 1);
    }
    for (const [id, mesh] of this.vortices)
      if (!sim.lab.singularities.has(id)) {
        mesh.parent.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.vortices.delete(id);
      }
  }
  event(e) {
    if (e.type === 'ice') {
      const mesh = new T.Mesh(
        new T.CircleGeometry(3, 24),
        new T.MeshStandardMaterial({
          color: '#94dcea',
          transparent: true,
          opacity: 0.3,
          roughness: 0.05,
          metalness: 0.3,
          side: T.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.fromArray(e.p);
      mesh.position.y += 0.025;
      this.game.view.scene.add(mesh);
      this.iceMeshes.push({ mesh, until: this.game.sim.time + 20 });
      if (this.iceMeshes.length > 16) this.iceMeshes[0].until = -1;
    }
    if (e.type === 'map') for (const r of this.iceMeshes) r.until = -1;
    if (e.type === 'gadget') {
      this.game.effects.event({ type: 'tracer', from: e.from, to: e.to, hit: false });
      const synth = this.game.effects.audio;
      synth.position = e.from;
      synth.tone(320, 0.12, 'triangle', 0.05, 650);
    }
    if (e.type === 'tracer' && e.hit) this.project(e.from, e.to, 'bullet');
    if (e.type === 'explosion') this.project(e.p, [e.p[0], e.p[1] - 10, e.p[2]], 'scorch');
    if (e.type === 'burn') this.game.effects.burst(new T.Vector3(...e.p), '#575c59', 3);
    if (e.type === 'fracture') this.game.effects.burst(new T.Vector3(...e.p), e.color, 18);
    if (e.type === 'teleport') this.game.effects.burst(new T.Vector3(...e.p), '#b999ef', 30);
  }
  project(from, to, kind) {
    const origin = new T.Vector3(...from),
      direction = new T.Vector3(...to).sub(origin),
      distance = direction.length();
    direction.normalize();
    const ray = new T.Raycaster(origin, direction, 0, distance + 0.2),
      objects = [...this.game.props.meshes.values(), this.game.map.root].filter(Boolean),
      hit = ray.intersectObjects(objects, true).find((h) => h.face);
    if (hit) this.decalAt(hit, kind);
  }
  decalAt(hit, kind = 'paint', color = '#d7fa94') {
    const object = hit.object || this.game.props.meshes.get(hit.id)?.children.find((c) => c.isMesh);
    if (!object?.isMesh) return;
    const normal =
        hit.normal ||
        hit.face?.normal.clone().transformDirection(object.matrixWorld) ||
        new T.Vector3(0, 1, 0),
      rotation = new T.Euler().setFromQuaternion(
        new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), normal),
      ),
      size = kind === 'scorch' ? 2 : kind === 'paint' ? 0.65 : 0.18;
    const material = new T.MeshBasicMaterial({
      map: this.decalTexture(kind),
      color: kind === 'bullet' ? '#293739' : kind === 'scorch' ? '#4d4942' : color,
      transparent: true,
      opacity: kind === 'scorch' ? 0.65 : 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const geometry = new DecalGeometry(object, hit.point, rotation, new T.Vector3(size, size, 0.2)),
      mesh = new T.Mesh(geometry, material);
    let root = object;
    while (root.parent && !root.userData.id) root = root.parent;
    const owner = root.userData.id;
    if (owner) {
      root.updateMatrixWorld(true);
      geometry.applyMatrix4(root.matrixWorld.clone().invert());
      root.add(mesh);
    } else this.game.view.scene.add(mesh);
    const record = { mesh, geometry, material, owner };
    this.decals.push(record);
    if (this.decals.length > 48) this.removeDecal(this.decals[0]);
  }
  decalTexture(kind) {
    if (this.decalTextures.has(kind)) return this.decalTextures.get(kind);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    if (kind === 'bullet') {
      ctx.beginPath();
      ctx.arc(64, 64, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24);
        ctx.lineTo(
          64 + Math.cos(a + 0.1) * (35 + Math.random() * 20),
          64 + Math.sin(a + 0.1) * (35 + Math.random() * 20),
        );
        ctx.stroke();
      }
    } else if (kind === 'scorch') {
      const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
      gradient.addColorStop(0, '#ffffffff');
      gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    } else {
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2,
          r = 35 + Math.random() * 25;
        i ? ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) : ctx.moveTo(64 + r, 64);
      }
      ctx.closePath();
      ctx.fill();
    }
    const texture = new T.CanvasTexture(canvas);
    this.decalTextures.set(kind, texture);
    return texture;
  }
  removeDecal(d) {
    d.mesh.parent?.remove(d.mesh);
    d.geometry.dispose();
    d.material.dispose();
    this.decals.splice(this.decals.indexOf(d), 1);
  }
}
