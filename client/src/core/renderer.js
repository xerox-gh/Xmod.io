import * as T from 'three';
export function createRenderer(canvas, settings) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new T.Scene();
  scene.fog = new T.Fog('#b8d8da', 70, 210);
  const camera = new T.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.08, 600);
  camera.rotation.order = 'YXZ';
  const ambient = new T.HemisphereLight('#e2f2ff', '#a5ad73', 2.3);
  scene.add(ambient);
  const sun = new T.DirectionalLight('#fff3da', 3.2);
  sun.position.set(-30, 55, 25);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -65,
    right: 65,
    top: 65,
    bottom: -65,
    near: 1,
    far: 150,
  });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target);
  const sky = new T.Mesh(
    new T.SphereGeometry(450, 16, 12),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: {
        topColor: { value: new T.Color('#7abbd1') },
        bottomColor: { value: new T.Color('#e4edd5') },
      },
      vertexShader:
        'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 vPos;uniform vec3 topColor;uniform vec3 bottomColor;void main(){gl_FragColor=vec4(mix(bottomColor,topColor,smoothstep(-.1,.65,normalize(vPos).y)),1.);}',
      depthWrite: false,
    }),
  );
  scene.add(sky);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  return {
    renderer,
    scene,
    camera,
    sun,
    sky,
    setSky(preset) {
      const night = preset === 'night' || preset === 'void';
      ambient.intensity = night ? 0.8 : 2.3;
      sun.intensity = night ? 0.65 : 3.2;
      sky.material.uniforms.topColor.value.set(
        preset === 'sunset'
          ? '#6b658e'
          : preset === 'void'
            ? '#080c1c'
            : night
              ? '#101d3d'
              : '#7abbd1',
      );
      sky.material.uniforms.bottomColor.value.set(
        preset === 'sunset'
          ? '#ffbb86'
          : preset === 'void'
            ? '#202440'
            : night
              ? '#465976'
              : '#e4edd5',
      );
      scene.fog.color.set(
        preset === 'sunset'
          ? '#bc9e9b'
          : preset === 'void'
            ? '#141a2e'
            : night
              ? '#293c55'
              : '#b8d8da',
      );
    },
    setNight(night) {
      this.setSky(night ? 'night' : 'day');
    },
  };
}
