import * as T from 'three';
export const FILTERS = ['none', 'crt', 'vhs', 'night', 'pixel', 'comic'];
// One full-screen shader pass. It renders into the same canvas as screenshots
// and MediaRecorder; CSS filters would not be included in those exports.
export class CameraFilters {
  constructor(game) {
    this.game = game;
    this.kind = 'none';
    this.width = 0;
    this.height = 0;
    this.target = new T.WebGLRenderTarget(1, 1, { depthBuffer: true });
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        image: { value: this.target.texture },
        resolution: { value: new T.Vector2(1, 1) },
        time: { value: 0 },
        mode: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `uniform sampler2D image;uniform vec2 resolution;uniform float time;uniform int mode;varying vec2 vUv;
      float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+time)*43758.5453);}
      float luminance(vec2 p){return dot(texture2D(image,p).rgb,vec3(.299,.587,.114));}
      void main(){vec2 uv=vUv; if(mode==4)uv=(floor(uv*resolution/5.)+.5)*5./resolution;
      if(mode==2)uv.x+=sin(uv.y*90.+time*3.)*.003+step(.985,noise(vec2(floor(uv.y*60.),floor(time*8.))))*.025;
      vec3 c=texture2D(image,uv).rgb;
      if(mode==1){c*=.88+.12*sin(uv.y*resolution.y*3.14159);c*=1.-.35*dot(uv-.5,uv-.5);}
      if(mode==2)c+=vec3((noise(uv)-.5)*.14);
      if(mode==3){float y=dot(c,vec3(.299,.587,.114));c=vec3(.08,y*1.7+.08,.15)*(0.9+noise(uv)*.2);}
      if(mode==5){vec2 d=2./resolution;float a=luminance(uv+vec2(-d.x,-d.y)),b=luminance(uv+vec2(0.,-d.y)),e=luminance(uv+vec2(d.x,-d.y));float f=luminance(uv+vec2(-d.x,0.)),g=luminance(uv+vec2(d.x,0.));float h=luminance(uv+vec2(-d.x,d.y)),i=luminance(uv+vec2(0.,d.y)),j=luminance(uv+d);float edge=length(vec2(-a-2.*f-h+e+2.*g+j,-a-2.*b-e+h+2.*i+j));c=floor(c*5.)/5.;c*=1.-smoothstep(.12,.5,edge);}
      gl_FragColor=vec4(c,1.);}`,
    });
    this.scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.material));
  }
  set(kind) {
    if (FILTERS.includes(kind)) this.kind = kind;
  }
  render(scene, camera) {
    const renderer = this.game.view.renderer;
    if (this.kind === 'none') {
      renderer.render(scene, camera);
      return;
    }
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    if (size.x !== this.width || size.y !== this.height) {
      this.width = size.x;
      this.height = size.y;
      this.target.setSize(size.x, size.y);
      this.material.uniforms.resolution.value.copy(size);
    }
    this.material.uniforms.time.value = performance.now() / 1000;
    this.material.uniforms.mode.value = FILTERS.indexOf(this.kind);
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
