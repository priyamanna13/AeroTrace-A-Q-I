import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN-SOURCE TOKENS  (locked from brand-spec.md + index.html :root)
   These values are the visual contract — do NOT substitute defaults.
───────────────────────────────────────────────────────────────────────────── */
const TOKENS = {
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
  fast: '150ms',
  base: '220ms',
};

/* ─────────────────────────────────────────────────────────────────────────────
   TRANSLATIONS  (verbatim from index.html)
───────────────────────────────────────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    title: 'AeroTrace A(Q)I — Trace the air',
    tagline: [['Trace', 'the', 'air.'], ['Understand', 'the', 'source.']],
    cta: 'Live AQI',
    menuOpen: 'Open menu', menuClose: 'Close menu', menu: 'Menu',
    appearance: 'Appearance', appearanceGroup: 'Appearance',
    light: 'Light', dark: 'Dark',
    settings: 'Settings', language: 'Language', selectLanguage: 'Select language',
    languages: { en: 'English', hi: 'हिन्दी', mr: 'मराठी' },
    liveMap: 'Live Map', screen: 'Screen 01',
    pin: 'India', pinAlt: 'India location pin', logoAlt: 'AeroTrace A(Q)I logo',
    globeAlt: 'Interactive Earth showing India',
    fallback: 'Interactive globe unavailable. The AeroTrace landing content remains available.',
    textureStatus: 'Earth texture unavailable',
    noScript: 'JavaScript is required for the live globe and menu interactions.',
    selected: 'selected',
    appearanceStatus: { light: 'Light appearance selected', dark: 'Dark appearance selected' },
    liveMapStatus: 'Live Map selected', ctaStatus: 'Live AQI selected',
  },
  hi: {
    title: 'AeroTrace A(Q)I — हवा को ट्रेस करें',
    tagline: [['हवा', 'को', 'ट्रेस', 'करें।'], ['स्रोत', 'को', 'समझें।']],
    cta: 'लाइव AQI',
    menuOpen: 'मेन्यू खोलें', menuClose: 'मेन्यू बंद करें', menu: 'मेन्यू',
    appearance: 'रूपरंग', appearanceGroup: 'रूपरंग',
    light: 'हल्का', dark: 'गहरा',
    settings: 'सेटिंग्ज', language: 'भाषा', selectLanguage: 'भाषा चुनें',
    languages: { en: 'अंग्रेज़ी', hi: 'हिन्दी', mr: 'मराठी' },
    liveMap: 'लाइव नक्शा', screen: 'स्क्रीन ०१',
    pin: 'भारत', pinAlt: 'भारत स्थान पिन', logoAlt: 'AeroTrace A(Q)I लोगो',
    globeAlt: 'भारत दिखाता इंटरैक्टिव पृथ्वी',
    fallback: 'इंटरैक्टिव ग्लोब उपलब्ध नहीं है। AeroTrace लैंडिंग सामग्री उपलब्ध है।',
    textureStatus: 'पृथ्वि टेक्सचर उपलब्ध नहीं है', noScript: '',
    selected: 'चयनित',
    appearanceStatus: { light: 'हल्का रूपरंग चुना गया', dark: 'गहरा रूपरंग चुना गया' },
    liveMapStatus: 'लाइव नक्शा चुना गया', ctaStatus: 'लाइव AQI चुना गया',
  },
  mr: {
    title: 'AeroTrace A(Q)I — हवेचा मागोवा घ्या',
    tagline: [['हवेचा', 'मागोवा', 'घ्या.'], ['स्रोत', 'समजून', 'घ्या.']],
    cta: 'लाइव्ह AQI',
    menuOpen: 'मेनू उघडा', menuClose: 'मेनू बंद करा', menu: 'मेनू',
    appearance: 'स्वरूप', appearanceGroup: 'स्वरूप',
    light: 'फिकट', dark: 'गडद',
    settings: 'सेटिंग्ज', language: 'भाषा', selectLanguage: 'भाषा निवडा',
    languages: { en: 'इंग्रजी', hi: 'हिन्दी', mr: 'मराठी' },
    liveMap: 'लाइव्ह नकाशा', screen: 'स्क्रीन ०१',
    pin: 'भारत', pinAlt: 'भारत स्थान पिन', logoAlt: 'AeroTrace A(Q)I लोगो',
    globeAlt: 'भारत दाखवणारे इंटरॅक्टिव्ह पृथ्वी',
    fallback: 'इंटरॅक्टिव्ह ग्लोब उपलब्ध नाही. AeroTrace लँडिंग मजकूर उपलब्ध आहे.',
    textureStatus: 'पृथ्वी टेक्सचर उपलब्ध नाही', noScript: '',
    selected: 'निवडले',
    appearanceStatus: { light: 'फिकट स्वरूप निवडले', dark: 'गडद स्वरूप निवडले' },
    liveMapStatus: 'लाइव्ह नकाशा निवडला', ctaStatus: 'लाइव्ह AQI निवडला',
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   WebGL2 vertex / fragment sources — verbatim from design source index.html
───────────────────────────────────────────────────────────────────────────── */
const VERTEX_SOURCE = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPosition;
  layout(location = 1) in vec2 aUv;
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
  uniform float uRotation;
  uniform float uTilt;
  uniform float uReveal;
  out vec2 vUv;
  out vec3 vNormal;
  out vec3 vWorldPosition;
  mat3 rotateY(float angle) {
    float s = sin(angle); float c = cos(angle);
    return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);
  }
  mat3 rotateX(float angle) {
    float s = sin(angle); float c = cos(angle);
    return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c);
  }
  void main() {
    mat3 rotation = rotateX(uTilt) * rotateY(uRotation);
    vec4 world = uModel * vec4(rotation * aPosition, 1.0);
    world.y += (1.0 - uReveal) * 0.18;
    vUv = aUv;
    vNormal = normalize(mat3(uModel) * rotation * normalize(aPosition));
    vWorldPosition = world.xyz;
    gl_Position = uProjection * uView * world;
  }
`;

const SPHERE_FRAG_SOURCE = `#version 300 es
  precision highp float;
  in vec2 vUv;
  in vec3 vNormal;
  in vec3 vWorldPosition;
  uniform sampler2D uTexture;
  uniform vec3 uLightDirection;
  uniform vec3 uCameraPosition;
  uniform float uTheme;
  uniform float uReveal;
  uniform float uHasTexture;
  out vec4 outColor;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
    vec3 texel = texture(uTexture, vec2(vUv.x, 1.0 - vUv.y)).rgb;
    vec3 fallbackOcean = vec3(0.035, 0.115, 0.17);
    vec3 surface = mix(fallbackOcean, texel, uHasTexture);
    surface = pow(max(surface, 0.0), vec3(0.92));
    vec3 night = surface * vec3(0.18, 0.24, 0.28);
    vec3 day = surface * vec3(0.72, 0.84, 0.92) + vec3(0.035, 0.065, 0.075);
    float lightMix = smoothstep(-0.08, 0.62, diffuse);
    vec3 color = mix(night, day, lightMix);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
    color += vec3(0.03, 0.16, 0.18) * rim * 0.72;
    color = mix(color, color * 1.06, uTheme);
    outColor = vec4(color, 1.0);
  }
`;

const ATMO_VERTEX_SOURCE = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPosition;
  layout(location = 1) in vec2 aUv;
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
  uniform float uRotation;
  uniform float uTilt;
  uniform float uReveal;
  out vec3 vNormal;
  out vec3 vWorldPosition;
  mat3 rotateY(float angle) {
    float s = sin(angle); float c = cos(angle);
    return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);
  }
  mat3 rotateX(float angle) {
    float s = sin(angle); float c = cos(angle);
    return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c);
  }
  void main() {
    mat3 rotation = rotateX(uTilt) * rotateY(uRotation);
    vec4 world = uModel * vec4(rotation * aPosition, 1.0);
    world.y += (1.0 - uReveal) * 0.18;
    vNormal = normalize(mat3(uModel) * rotation * normalize(aPosition));
    vWorldPosition = world.xyz;
    gl_Position = uProjection * uView * world;
  }
`;

const ATMO_FRAG_SOURCE = `#version 300 es
  precision highp float;
  in vec3 vNormal;
  in vec3 vWorldPosition;
  uniform vec3 uCameraPosition;
  uniform float uReveal;
  uniform float uTheme;
  out vec4 outColor;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
    float alpha = smoothstep(0.03, 0.98, rim) * 0.42 * uReveal;
    vec3 glow = mix(vec3(0.02, 0.17, 0.18), vec3(0.12, 0.30, 0.28), uTheme);
    outColor = vec4(glow, alpha);
  }
`;

const FIELD_VERTEX_SOURCE = `#version 300 es
  precision highp float;
  out vec2 vUv;
  void main() {
    vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = corner;
    gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const FIELD_FRAG_SOURCE = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTheme;
  uniform float uReveal;
  out vec4 outColor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float pool(vec2 uv, vec2 c, vec2 r) {
    vec2 o = (uv - c) / r;
    return 1.0 - smoothstep(0.0, 1.0, length(o));
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec3 darkBase  = vec3(0.108, 0.110, 0.108);
    vec3 lightBase = vec3(0.945, 0.930, 0.895);
    vec3 base = mix(darkBase, lightBase, uTheme);
    vec3 teal = vec3(0.137, 0.325, 0.278);
    vec3 deepTeal = vec3(0.086, 0.216, 0.235);
    float heroPool = pool(uv, vec2(0.735, 0.50), vec2(0.50 / aspect, 0.56));
    float lowPool  = pool(uv, vec2(0.44,  0.74), vec2(0.44 / aspect, 0.44));
    float strength = mix(0.40, 0.13, uTheme) * mix(0.35, 1.0, uReveal);
    vec3 color = base;
    color += teal     * pow(heroPool, 1.7) * strength;
    color += deepTeal * pow(lowPool,  2.1) * strength * 0.62;
    float vertical = smoothstep(1.0, 0.0, uv.y);
    color += mix(vec3(0.030,0.030,0.032), vec3(0.0), uTheme) * vertical * 0.55;
    float vignette = 1.0 - 0.34 * pow(clamp(length((uv - 0.5) * vec2(1.12,1.0)) * 1.42, 0.0, 1.0), 2.1);
    color *= mix(vignette, 1.0 - (1.0 - vignette) * 0.4, uTheme);
    color += (hash(uv * uResolution) - 0.5) * mix(0.016, 0.006, uTheme);
    outColor = vec4(color, 1.0);
  }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   Screen 00 — Landing Page
   Faithful React port of the Open Design WebGL experience.
───────────────────────────────────────────────────────────────────────────── */
export default function Screen0Landing() {
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();

  // State
  const [theme, setTheme]         = useState('dark');
  const [menuOpen, setMenuOpen]   = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [langCode, setLangCode]   = useState('en');
  const [sceneReady, setSceneReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [statusMsg, setStatusMsg] = useState('GPU · WebGL2');

  const canvasRef   = useRef(null);
  const menuRef     = useRef(null);
  const pickerRef   = useRef(null);
  const rafRef      = useRef(null);
  const glRef       = useRef(null);
  const pinRef      = useRef(null); // direct DOM ref for India pin (updated in GL render loop)

  // Memoised translation
  const tr = TRANSLATIONS[langCode] || TRANSLATIONS.en;

  /* ── Apply language to document ── */
  useEffect(() => {
    document.title = tr.title;
    document.documentElement.lang = langCode;
  }, [langCode, tr]);

  /* ── Close menu / picker on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
      if (pickerOpen && pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, pickerOpen]);

  /* ── Keyboard (Escape) ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (pickerOpen) setPickerOpen(false);
        else if (menuOpen) setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen, pickerOpen]);

  /* ── WebGL2 render loop — verbatim port of design source ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: true, premultipliedAlpha: false,
    });

    if (!gl) {
      setWebglFailed(true);
      setSceneReady(true);
      return;
    }
    glRef.current = gl;

    /* ── helper: compile / link ── */
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(shader) || 'Shader error';
        gl.deleteShader(shader);
        throw new Error(msg);
      }
      return shader;
    }
    function createProgram(vs, fs) {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      return prog;
    }

    /* ── sphere geometry ── */
    function createSphere(lat, lon) {
      const pos = [], uvs = [], idx = [];
      for (let y = 0; y <= lat; y++) {
        const latitude = y / lat;
        const theta = latitude * Math.PI;
        const sinT = Math.sin(theta), cosT = Math.cos(theta);
        for (let x = 0; x <= lon; x++) {
          const longitude = x / lon;
          const phi = longitude * Math.PI * 2 - Math.PI;
          pos.push(sinT * Math.cos(phi), cosT, sinT * Math.sin(phi));
          uvs.push(longitude, 1 - latitude);
        }
      }
      for (let y = 0; y < lat; y++) {
        for (let x = 0; x < lon; x++) {
          const row = lon + 1, first = y * row + x, second = first + row;
          idx.push(first, second, first + 1, second, second + 1, first + 1);
        }
      }
      return {
        positions: new Float32Array(pos),
        uvs: new Float32Array(uvs),
        indices: new Uint16Array(idx),
      };
    }

    /* ── math helpers (verbatim from source) ── */
    function normalize(v) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0]/l, v[1]/l, v[2]/l];
    }
    function cross(a, b) {
      return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    }
    function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
    function lookAt(eye, center, up) {
      const z = normalize([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return new Float32Array([
        x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
        -dot(x,eye), -dot(y,eye), -dot(z,eye), 1,
      ]);
    }
    function perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2), r = 1 / (near - far);
      return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*r,-1, 0,0,2*far*near*r,0]);
    }
    function modelMatrix(x, y, z, scale) {
      return new Float32Array([scale,0,0,0, 0,scale,0,0, 0,0,scale,0, x,y,z,1]);
    }

    /* ── build programs ── */
    const sphereProg = createProgram(VERTEX_SOURCE, SPHERE_FRAG_SOURCE);
    const atmoProg   = createProgram(ATMO_VERTEX_SOURCE, ATMO_FRAG_SOURCE);
    const fieldProg  = createProgram(FIELD_VERTEX_SOURCE, FIELD_FRAG_SOURCE);

    const sphere = createSphere(72, 128);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const fieldVao = gl.createVertexArray();

    /* ── texture ── */
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5,28,45,255]));

    let textureReady = false;
    let textureUploaded = false;
    let renderStarted = false;

    const startRendering = () => { if (!renderStarted) { renderStarted = true; rafRef.current = requestAnimationFrame(render); } };
    const bootTime = performance.now();
    let emergenceAt = performance.now();
    let sceneSignalled = false;
    const beginEmergence = () => { if (emergenceAt === null) emergenceAt = performance.now(); };
    setTimeout(() => {
      sceneSignalled = true;
      setSceneReady(true);
    }, 400);

    const uploadTexture = () => {
      if (!textureUploaded) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texImg);
        textureUploaded = true;
        textureReady = true;
      }
      beginEmergence();
      startRendering();
    };

    const texImg = new Image();
    texImg.onload = uploadTexture;
    texImg.onerror = () => { setStatusMsg('Earth texture unavailable'); beginEmergence(); startRendering(); };
    texImg.src = '/earth-texture.jpg';
    startRendering();
    if (texImg.complete && texImg.naturalWidth > 0) uploadTexture();

    /* ── uniform locations ── */
    const sU = {
      projection: gl.getUniformLocation(sphereProg, 'uProjection'),
      view:       gl.getUniformLocation(sphereProg, 'uView'),
      model:      gl.getUniformLocation(sphereProg, 'uModel'),
      rotation:   gl.getUniformLocation(sphereProg, 'uRotation'),
      tilt:       gl.getUniformLocation(sphereProg, 'uTilt'),
      reveal:     gl.getUniformLocation(sphereProg, 'uReveal'),
      texture:    gl.getUniformLocation(sphereProg, 'uTexture'),
      light:      gl.getUniformLocation(sphereProg, 'uLightDirection'),
      camera:     gl.getUniformLocation(sphereProg, 'uCameraPosition'),
      theme:      gl.getUniformLocation(sphereProg, 'uTheme'),
      hasTexture: gl.getUniformLocation(sphereProg, 'uHasTexture'),
    };
    const aU = {
      projection: gl.getUniformLocation(atmoProg, 'uProjection'),
      view:       gl.getUniformLocation(atmoProg, 'uView'),
      model:      gl.getUniformLocation(atmoProg, 'uModel'),
      rotation:   gl.getUniformLocation(atmoProg, 'uRotation'),
      tilt:       gl.getUniformLocation(atmoProg, 'uTilt'),
      reveal:     gl.getUniformLocation(atmoProg, 'uReveal'),
      camera:     gl.getUniformLocation(atmoProg, 'uCameraPosition'),
      theme:      gl.getUniformLocation(atmoProg, 'uTheme'),
    };
    const fU = {
      resolution: gl.getUniformLocation(fieldProg, 'uResolution'),
      theme:      gl.getUniformLocation(fieldProg, 'uTheme'),
      reveal:     gl.getUniformLocation(fieldProg, 'uReveal'),
    };

    /* ── camera / scene constants (verbatim from source) ── */
    const camera   = [0, 0, 3.6];
    const viewMat  = lookAt(camera, [0, 0, 0], [0, 1, 0]);
    const light    = [0.48, 0.56, 0.82];
    const indiaLat = 22.5 * Math.PI / 180;
    const indiaLon = 78.5 * Math.PI / 180;
    let projection = perspective(42 * Math.PI / 180, 1, 0.1, 100);
    const baseTilt = 0.28;
    let targetRotation  = -0.68;
    let currentRotation = targetRotation;
    let targetTilt  = baseTilt;
    let currentTilt = targetTilt;
    let dragging = false;
    let lastPX = 0, lastPY = 0;
    let canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    let canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    let layout = { x: 0.98, y: -0.04, scale: 1.47 };
    let frameCount = 0, lastFpsTime = performance.now();
    let themeLocal = 'dark'; // local mutable copy

    /* ── project India point → screen coords (verbatim from source) ── */
    function projectPoint(point, model, rotation, tilt) {
      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const rotX = cos * point[0] + sin * point[2];
      const rotZ = -sin * point[0] + cos * point[2];
      const tC = Math.cos(tilt), tS = Math.sin(tilt);
      const tiltY = tC * point[1] - tS * rotZ;
      const tiltZ = tS * point[1] + tC * rotZ;
      const wX = model[0]*rotX + model[4]*tiltY + model[8]*tiltZ + model[12];
      const wY = model[1]*rotX + model[5]*tiltY + model[9]*tiltZ + model[13];
      const wZ = model[2]*rotX + model[6]*tiltY + model[10]*tiltZ + model[14];
      const vX = viewMat[0]*wX + viewMat[4]*wY + viewMat[8]*wZ + viewMat[12];
      const vY = viewMat[1]*wX + viewMat[5]*wY + viewMat[9]*wZ + viewMat[13];
      const vZ = viewMat[2]*wX + viewMat[6]*wY + viewMat[10]*wZ + viewMat[14];
      const cX = projection[0]*vX + projection[4]*vY + projection[8]*vZ + projection[12];
      const cY = projection[1]*vX + projection[5]*vY + projection[9]*vZ + projection[13];
      const cW = projection[3]*vX + projection[7]*vY + projection[11]*vZ + projection[15];
      const safeW = Math.abs(cW) < 0.0001 ? 1 : cW;
      const screenW = canvasWidth || window.innerWidth;
      const screenH = canvasHeight || window.innerHeight;
      return {
        x: (cX/safeW * 0.5 + 0.5) * screenW,
        y: (0.5 - cY/safeW * 0.5) * screenH,
        visible: cW > 0 && tiltZ > -0.2, // Front facing hemisphere check
      };
    }

    /* ── resize (verbatim layout breakpoints from source) ── */
    function resize() {
      canvasWidth  = window.innerWidth;
      canvasHeight = window.innerHeight;
      const asp = canvasWidth / Math.max(canvasHeight, 1);
      if (canvasWidth <= 560)  layout = { x: 0.30, y: -0.30, scale: 0.80 };
      else if (canvasWidth <= 820)  layout = { x: 0.72, y: -0.10, scale: 0.95 };
      else if (canvasWidth <= 1100) layout = { x: 0.90, y: -0.02, scale: 1.18 };
      else layout = { x: asp >= 1.5 ? 0.98 : 0.90, y: -0.04, scale: asp >= 1.5 ? 1.47 : 1.24 };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor((canvas.clientWidth || canvasWidth) * dpr);
      const h = Math.floor((canvas.clientHeight || canvasHeight) * dpr);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      projection = perspective(42 * Math.PI / 180, w / h, 0.1, 100);
    }

    /* ── pin ref helper (used by render loop — avoids getElementById overhead) ── */
    const getPinEl = () => pinRef.current;

    /* ── main render function (verbatim from source) ── */
    function render(now) {
      resize();
      if (emergenceAt === null && now - bootTime > 1600) beginEmergence();
      const elapsed = emergenceAt === null ? -1 : now - emergenceAt;
      const reveal = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - 620) / 1450));
      const easedReveal = 1 - Math.pow(1 - reveal, 3);

      if (!sceneSignalled && easedReveal >= 0.999) {
        sceneSignalled = true;
        setSceneReady(true); // This triggers re-render → pin gets className="od-pin-animate" via JSX
      }

      currentRotation += (targetRotation - currentRotation) * 0.055;
      currentTilt     += (targetTilt     - currentTilt)     * 0.055;

      const scale = layout.scale * (0.74 + easedReveal * 0.26);
      const model     = modelMatrix(layout.x, layout.y - (1 - easedReveal) * 0.12, 0, scale);
      const atmoModel = modelMatrix(layout.x, layout.y - (1 - easedReveal) * 0.12, 0, scale * 1.075);

      const indiaPoint = [
        Math.cos(indiaLat) * Math.cos(indiaLon),
        Math.sin(indiaLat),
        Math.cos(indiaLat) * Math.sin(indiaLon),
      ];
      const pp = projectPoint(indiaPoint, model, currentRotation, currentTilt);
      const pinEl = getPinEl();
      if (pinEl) {
        if (pp.visible) {
          pinEl.style.left = `${pp.x}px`;
          pinEl.style.top  = `${pp.y}px`;
          pinEl.style.visibility = 'visible';
        } else {
          pinEl.style.visibility = 'hidden';
        }
      }

      const bg = themeLocal === 'dark' ? [0.108, 0.110, 0.108] : [0.945, 0.930, 0.895];
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* field background */
      gl.useProgram(fieldProg);
      gl.uniform2f(fU.resolution, canvas.width, canvas.height);
      gl.uniform1f(fU.theme, themeLocal === 'dark' ? 0 : 1);
      gl.uniform1f(fU.reveal, easedReveal);
      gl.bindVertexArray(fieldVao);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);

      /* atmosphere */
      gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.depthMask(false);
      gl.useProgram(atmoProg);
      gl.uniformMatrix4fv(aU.projection, false, projection);
      gl.uniformMatrix4fv(aU.view, false, viewMat);
      gl.uniformMatrix4fv(aU.model, false, atmoModel);
      gl.uniform1f(aU.rotation, currentRotation);
      gl.uniform1f(aU.tilt, currentTilt);
      gl.uniform1f(aU.reveal, easedReveal);
      gl.uniform3fv(aU.camera, camera);
      gl.uniform1f(aU.theme, themeLocal === 'dark' ? 0 : 1);
      gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);

      /* sphere */
      gl.depthMask(true);
      gl.useProgram(sphereProg);
      gl.uniformMatrix4fv(sU.projection, false, projection);
      gl.uniformMatrix4fv(sU.view, false, viewMat);
      gl.uniformMatrix4fv(sU.model, false, model);
      gl.uniform1f(sU.rotation, currentRotation);
      gl.uniform1f(sU.tilt, currentTilt);
      gl.uniform1f(sU.reveal, easedReveal);
      gl.uniform3fv(sU.camera, camera);
      gl.uniform1f(sU.theme, themeLocal === 'dark' ? 0 : 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(sU.texture, 0);
      gl.uniform3fv(sU.light, light);
      gl.uniform1f(sU.hasTexture, textureReady ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);

      /* FPS counter */
      frameCount++;
      if (now - lastFpsTime > 650) {
        const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
        setStatusMsg(`GPU · WebGL2 · ${fps}fps`);
        frameCount = 0;
        lastFpsTime = now;
      }

      rafRef.current = requestAnimationFrame(render);
    }

    /* ── pointer events ── */
    const onDown = (e) => {
      dragging = true;
      lastPX = e.clientX; lastPY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (dragging) {
        targetRotation += (e.clientX - lastPX) * 0.0024;
        targetTilt = Math.max(0.12, Math.min(0.42, targetTilt + (e.clientY - lastPY) * 0.0012));
        lastPX = e.clientX; lastPY = e.clientY;
      } else if (e.pointerType === 'mouse') {
        targetRotation = -0.68 + (e.clientX / window.innerWidth - 0.5) * 0.12;
        targetTilt = baseTilt + (e.clientY / window.innerHeight - 0.5) * -0.08;
      }
    };
    const onUp    = () => { dragging = false; };
    const onCancel = () => { dragging = false; };

    canvas.addEventListener('pointerdown',  onDown);
    canvas.addEventListener('pointermove',  onMove);
    canvas.addEventListener('pointerup',    onUp);
    canvas.addEventListener('pointercancel', onCancel);
    window.addEventListener('resize', resize);
    resize();
    if (reducedMotion) {
      setSceneReady(true);
    }
    setTimeout(() => { if (!renderStarted) startRendering(); }, 2500);

    /* ── expose theme setter to React state changes ── */
    const themeWatcher = (t) => { themeLocal = t; };
    canvas._setTheme = themeWatcher;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('pointerdown',  onDown);
      canvas.removeEventListener('pointermove',  onMove);
      canvas.removeEventListener('pointerup',    onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('resize', resize);
    };
  }, []); // init once

  /* ── Propagate theme changes into the running GL loop ── */
  useEffect(() => {
    if (canvasRef.current?._setTheme) canvasRef.current._setTheme(theme);
  }, [theme]);

  /* ── CTA pointer tracking for specular shine ── */
  const ctaRef = useRef(null);
  const onCtaMove = useCallback((e) => {
    if (!ctaRef.current) return;
    const b = ctaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - b.top)  / b.height) * 100));
    ctaRef.current.style.setProperty('--shine-x', `${x}%`);
    ctaRef.current.style.setProperty('--shine-y', `${y}%`);
  }, []);
  const onCtaLeave = useCallback(() => {
    if (!ctaRef.current) return;
    ctaRef.current.style.setProperty('--shine-x', '50%');
    ctaRef.current.style.setProperty('--shine-y', '50%');
  }, []);

  const handleCtaClick = () => { navigate('/national'); };
  const handleLiveMapClick = (e) => {
    e.preventDefault();
    setMenuOpen(false);
    navigate('/national');
  };

  return (
    <>
      {/* ── Global CSS injected into the document — verbatim from design source ── */}
      <style>{`
        @font-face {
          font-family: "Abril Fatface";
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url("/assets/fonts/abril-fatface-latin.woff2") format("woff2");
        }
        @font-face {
          font-family: "Archivo Narrow";
          font-style: normal;
          font-weight: 400 600;
          font-display: swap;
          src: url("/assets/fonts/archivo-narrow-latin.woff2") format("woff2");
        }

        /* :root fallback defaults — ensures #landing-india-pin (outside .od-root) can resolve
           --bg, --accent, --surface, --fg for its ::before / ::after and label styles */
        :root {
          --bg: oklch(0.2350 0 89.9);
          --surface: oklch(0.2645 0 89.9);
          --fg: oklch(0.9540 0.0094 100);
          --accent: oklch(0.6278 0.1292 39.2);
          --shadow: oklch(0 0 0 / 0.34);
        }

        .od-root {
          --bg: oklch(0.2350 0 89.9);
          --surface: oklch(0.2645 0 89.9);
          --surface-raised: oklch(0.3012 0 89.9);
          --fg: oklch(0.9540 0.0094 100);
          --fg-2: oklch(0.8670 0.0156 90.2);
          --muted: oklch(0.6352 0.0073 106.6);
          --border: oklch(0.3867 0 89.9);
          --border-soft: oklch(0.3540 0.008 89.9);
          --accent: oklch(0.6278 0.1292 39.2);
          --primary: oklch(0.4050 0.0564 174.6);
          --primary-strong: oklch(0.3380 0.0554 209.6);
          --primary-soft: oklch(0.4050 0.0564 174.6 / 0.34);
          --focus: oklch(0.6278 0.1292 39.2 / 0.72);
          --shadow: oklch(0 0 0 / 0.34);
          --font-display: "Abril Fatface", "Bodoni 72", Baskerville, Georgia, serif;
          --font-body: "Archivo Narrow", "Arial Narrow", "Helvetica Neue", sans-serif;
          --font-ui: "Arimo", "Helvetica Neue", Arial, sans-serif;
          --ease: cubic-bezier(0.2, 0, 0, 1);
          --fast: 150ms;
          --base: 220ms;
        }
        .od-root[data-theme="light"] {
          --bg: oklch(0.9210 0.018 90);
          --surface: oklch(0.9580 0.012 90);
          --surface-raised: oklch(0.9850 0.006 90);
          --fg: oklch(0.2350 0.009 160);
          --fg-2: oklch(0.3650 0.018 160);
          --muted: oklch(0.4850 0.026 160);
          --border: oklch(0.7200 0.032 160);
          --border-soft: oklch(0.8150 0.025 160);
          --shadow: oklch(0.2350 0.009 160 / 0.20);
        }

        .od-root *, .od-root *::before, .od-root *::after { box-sizing: border-box; }
        .od-root button, .od-root a { font: inherit; }
        .od-root button { border: 0; }
        .od-root a { color: inherit; }

        #od-canvas {
          position: fixed; inset: 0; z-index: 0; display: block;
          width: 100%; height: 100%; touch-action: none;
          cursor: grab;
        }
        #od-canvas:active { cursor: grabbing; }

        .od-page {
          position: relative; z-index: 2;
          min-height: 100vh; min-height: 100svh;
          height: 100vh; height: 100dvh;
          overflow: hidden; pointer-events: none;
        }
        .od-hero { position: relative; width: 100%; height: 100%; }

        .od-hero-copy {
          position: absolute;
          top: 40%; left: clamp(28px, 7.1vw, 204px);
          width: min(47vw, 840px);
          transform: translateY(-54%);
          pointer-events: auto;
        }

        .od-logo {
          display: block;
          width: clamp(120px, 7.8vw, 190px); height: auto;
          margin: 0 0 clamp(18px, 1.8vw, 30px) 2px;
          opacity: 0;
          transform: translateY(18px) scale(0.96);
          animation: od-rise-in 800ms var(--ease) 80ms forwards;
          user-select: none;
        }

        .od-product-name {
          display: flex; flex-wrap: nowrap; align-items: baseline;
          column-gap: 0.2em; width: max-content; max-width: 100%;
          margin: 0; color: var(--fg);
          font-family: var(--font-display);
          font-size: clamp(54px, 5.1vw, 94px);
          font-weight: 400; line-height: 1.02; letter-spacing: -0.02em;
          white-space: nowrap;
          opacity: 0; transform: translateY(22px);
          animation: od-rise-in 850ms var(--ease) 360ms forwards;
        }
        .od-product-name .aqi { display: inline-block; }
        .od-product-name .q  { color: var(--accent); }
        .od-root[data-theme="light"] .od-product-name .aqi {
          text-shadow: 0 0 18px var(--surface-raised), 0 0 7px var(--surface-raised);
        }

        .od-tagline {
          width: max-content; max-width: 100%;
          margin: clamp(17px, 1.35vw, 24px) 0 0;
          color: var(--fg-2);
          font-family: var(--font-body);
          font-size: clamp(24px, 2.1vw, 39px);
          font-weight: 700; line-height: 1.22; letter-spacing: 0.004em;
        }
        .od-tagline-line { display: block; white-space: nowrap; perspective: 560px; }
        .od-tagline-line + .od-tagline-line { margin-left: 0.78em; }
        .od-tagline .od-word {
          display: inline-block;
          opacity: 0;
          transform: translate3d(0, 0.7em, 0) rotateX(-60deg);
          transform-origin: 50% 100%;
          backface-visibility: hidden;
          animation: od-tagline-word-in 640ms var(--ease) var(--od-delay) forwards;
        }

        .od-cta {
          --shine-x: 50%; --shine-y: 50%;
          position: relative; display: inline-flex;
          align-items: center; justify-content: center;
          min-width: clamp(200px, 12vw, 350px);
          height: clamp(56px, 3vw, 86px);
          margin: clamp(24px, 2.2vw, 38px) 0 0;
          padding: 0 22px; overflow: hidden;
          border: 1px solid color-mix(in oklab, var(--primary), var(--fg) 24%);
          border-radius: 10px; color: var(--fg);
          background: var(--primary);
          box-shadow: 0 14px 30px color-mix(in oklab, var(--primary), transparent 78%);
          cursor: pointer;
          font-family: var(--font-ui);
          font-size: clamp(14px, 0.78vw, 22px);
          font-weight: 600; letter-spacing: 0.02em;
          opacity: 0; transform: translateY(18px);
          animation: od-rise-in 760ms var(--ease) 350ms forwards;
          transition: background var(--fast) var(--ease), border-color var(--fast) var(--ease),
                      transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .od-cta::before {
          position: absolute; inset: -45% -10%; z-index: 0; content: "";
          background: radial-gradient(circle at var(--shine-x) var(--shine-y),
            color-mix(in oklab, var(--fg), transparent 66%) 0%,
            color-mix(in oklab, var(--fg), transparent 82%) 24%, transparent 60%);
          opacity: 0; transform: scale(0.72);
          transition: opacity var(--fast) var(--ease), transform 420ms var(--ease);
          pointer-events: none;
        }
        .od-cta::after {
          position: absolute; inset: -35% -20%; z-index: 0; content: "";
          background: linear-gradient(112deg, transparent 28%,
            color-mix(in oklab, var(--fg), transparent 72%) 49%, transparent 68%);
          opacity: 0; transform: translateX(-135%) skewX(-12deg);
          pointer-events: none;
        }
        .od-cta span { position: relative; z-index: 1; }
        .od-cta:hover, .od-cta:focus-visible {
          background: color-mix(in oklab, var(--primary), var(--fg) 10%);
          border-color: color-mix(in oklab, var(--primary), var(--fg) 38%);
          box-shadow: 0 17px 34px color-mix(in oklab, var(--primary), transparent 68%);
          transform: translateY(-2px);
        }
        .od-cta:hover::before, .od-cta:focus-visible::before { opacity: 1; transform: scale(1); }
        .od-cta:hover::after, .od-cta:focus-visible::after { animation: od-specular-sweep 760ms var(--ease) forwards; }
        .od-cta:active { transform: translateY(1px); }
        .od-root[data-theme="light"] .od-cta {
          background: color-mix(in oklab, var(--primary), var(--surface) 64%);
          border-color: color-mix(in oklab, var(--primary), var(--surface) 48%);
          box-shadow: 0 14px 30px color-mix(in oklab, var(--primary), transparent 84%);
        }
        .od-root[data-theme="light"] .od-cta:hover,
        .od-root[data-theme="light"] .od-cta:focus-visible {
          background: color-mix(in oklab, var(--primary), var(--surface) 54%);
          border-color: color-mix(in oklab, var(--primary), var(--surface) 36%);
        }

        /* Focus rings */
        .od-cta:focus-visible, .od-menu-toggle:focus-visible,
        .od-appearance-option:focus-visible, .od-language-trigger:focus-visible,
        .od-language-option:focus-visible, .od-live-map-link:focus-visible {
          outline: 2px solid var(--focus); outline-offset: 4px;
        }

        /* Menu */
        .od-menu-region {
          position: absolute;
          top: clamp(24px, 3.2vw, 58px); right: clamp(24px, 4.2vw, 86px);
          z-index: 10; pointer-events: auto;
        }
        .od-menu-toggle {
          display: grid; place-items: center;
          width: clamp(48px, 3.5vw, 70px); height: clamp(48px, 3.5vw, 70px);
          border: 1px solid color-mix(in oklab, var(--border), var(--fg) 8%);
          border-radius: 12px; color: var(--fg);
          background: color-mix(in oklab, var(--bg), transparent 26%);
          backdrop-filter: blur(18px) saturate(120%);
          cursor: pointer;
          transition: background var(--fast) var(--ease), border-color var(--fast) var(--ease),
                      transform var(--fast) var(--ease);
        }
        .od-menu-toggle:hover { border-color: var(--fg-2); background: color-mix(in oklab, var(--surface), transparent 12%); transform: translateY(-1px); }
        .od-menu-toggle svg { width: 42%; height: 42%; overflow: visible; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 1.7; transition: transform var(--base) var(--ease); }
        .od-menu-toggle[aria-expanded="true"] svg { transform: rotate(90deg); }

        .od-menu-panel {
          position: absolute; top: calc(100% + 14px); right: 0;
          width: min(360px, calc(100vw - 32px));
          padding: clamp(20px, 1.7vw, 26px);
          border: 1px solid color-mix(in oklab, var(--border), var(--fg) 10%);
          border-radius: 18px;
          background: color-mix(in oklab, var(--surface), transparent 34%);
          box-shadow: 0 24px 56px var(--shadow);
          backdrop-filter: blur(28px) saturate(135%);
          -webkit-backdrop-filter: blur(28px) saturate(135%);
          opacity: 0; visibility: hidden;
          transform: translateY(-12px) scale(0.98);
          transform-origin: top right;
          transition: opacity var(--base) var(--ease), transform var(--base) var(--ease),
                      visibility 0s linear var(--base);
        }
        .od-menu-panel.is-open {
          opacity: 1; visibility: visible;
          transform: translateY(0) scale(1);
          transition: opacity var(--base) var(--ease), transform var(--base) var(--ease), visibility 0s;
        }
        .od-menu-label { margin: 0 0 14px; color: var(--muted); font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: 0.11em; line-height: 1.2; text-transform: uppercase; }
        .od-menu-block + .od-menu-block { margin-top: 25px; padding-top: 24px; border-top: 1px solid var(--border-soft); }
        .od-appearance-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .od-appearance-option {
          min-height: 48px; padding: 0 14px;
          border: 1px solid var(--border); border-radius: 8px;
          color: var(--fg-2);
          background: color-mix(in oklab, var(--surface-raised), transparent 22%);
          cursor: pointer; font-family: var(--font-ui); font-size: 15px; font-weight: 600;
          transition: color var(--fast) var(--ease), background var(--fast) var(--ease), border-color var(--fast) var(--ease);
        }
        .od-appearance-option:hover { border-color: var(--fg-2); color: var(--fg); background: var(--surface-raised); }
        .od-appearance-option[aria-pressed="true"] { border-color: var(--primary); color: var(--fg); background: color-mix(in oklab, var(--primary), var(--surface) 36%); }

        .od-language-row { display: grid; grid-template-columns: auto minmax(150px,1fr); align-items: center; gap: 18px; }
        .od-language-name { color: var(--fg); font-family: var(--font-ui); font-size: 15px; font-weight: 600; }
        .od-language-picker { position: relative; }
        .od-language-trigger {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; min-height: 48px; padding: 0 14px;
          border: 1px solid var(--border); border-radius: 8px;
          color: var(--fg);
          background: color-mix(in oklab, var(--surface-raised), transparent 22%);
          cursor: pointer; font-family: var(--font-ui); font-size: 14px; font-weight: 600;
          transition: background var(--fast) var(--ease), border-color var(--fast) var(--ease);
        }
        .od-language-trigger:hover { border-color: var(--fg-2); background: var(--surface-raised); }
        .od-language-trigger svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; transition: transform var(--fast) var(--ease); }
        .od-language-picker.is-open .od-language-trigger svg { transform: rotate(180deg); }
        .od-language-list {
          position: absolute; top: calc(100% + 8px); right: 0; left: 0;
          display: grid; gap: 4px; padding: 6px;
          border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface-raised);
          box-shadow: 0 18px 30px var(--shadow);
          opacity: 0; visibility: hidden; transform: translateY(-6px);
          transition: opacity var(--fast) var(--ease), transform var(--fast) var(--ease), visibility 0s linear var(--fast);
        }
        .od-language-picker.is-open .od-language-list { opacity: 1; visibility: visible; transform: translateY(0); transition: opacity var(--fast) var(--ease), transform var(--fast) var(--ease), visibility 0s; }
        .od-language-option {
          min-height: 42px; padding: 0 12px; border-radius: 6px;
          color: var(--fg-2); background: transparent; cursor: pointer;
          text-align: left; font-family: var(--font-ui); font-size: 14px;
          transition: color var(--fast) var(--ease), background var(--fast) var(--ease);
        }
        .od-language-option:hover, .od-language-option[aria-selected="true"] { color: var(--fg); background: var(--primary-soft); }

        .od-live-map-link {
          display: flex; align-items: center; justify-content: space-between;
          min-height: 44px; color: var(--fg); text-decoration: none;
          font-family: var(--font-ui); font-size: 15px; font-weight: 600;
          transition: color var(--fast) var(--ease), transform var(--fast) var(--ease);
        }
        .od-live-map-link:hover { color: var(--fg-2); transform: translateX(2px); }
        .od-live-map-label { display: inline-flex; align-items: center; gap: 11px; }
        .od-live-map-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
        .od-live-map-target { color: var(--accent); font-size: 13px; }

        /* India pin — prominent sizing matching design mockups & user reference */
        #landing-india-pin {
          position: fixed; z-index: 100;
          top: 43.4%; left: 70.5%;
          width: 46px; height: 64px;
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, -100%) scale(0.7) translateY(24px);
          filter: drop-shadow(0 10px 14px rgba(0,0,0,0.45));
        }
        #landing-india-pin.od-pin-animate {
          animation: od-pin-in 760ms cubic-bezier(0.2, 0, 0, 1) 0ms forwards;
        }
        #landing-india-pin::before {
          position: absolute; top: 0; left: 2px; width: 42px; height: 42px;
          border: 4.5px solid var(--bg); border-radius: 50%;
          background: var(--accent); content: "";
        }
        #landing-india-pin::after {
          position: absolute; top: 12px; left: 14px; width: 18px; height: 18px;
          border-radius: 50%; background: var(--bg); content: "";
        }
        .od-india-pin-mark {
          position: absolute; top: 24px; left: 8px; width: 30px; height: 40px;
          background: var(--accent);
          clip-path: polygon(50% 100%, 0 45%, 0 0, 50% 0, 100% 0, 100% 45%);
          z-index: -1;
        }
        .od-india-pin-label {
          position: absolute; top: 5px; left: 56px;
          display: inline-flex; align-items: center;
          min-height: 32px; padding: 0 14px;
          border: 1.5px solid color-mix(in oklab, var(--accent), var(--fg) 22%);
          border-radius: 999px; color: var(--fg);
          background: color-mix(in oklab, var(--surface), transparent 20%);
          box-shadow: 0 10px 24px rgba(0,0,0,0.4);
          backdrop-filter: blur(14px) saturate(130%);
          -webkit-backdrop-filter: blur(14px) saturate(130%);
          font-family: var(--font-ui); font-size: 14px; font-weight: 700;
          letter-spacing: 0.03em; line-height: 1; white-space: nowrap;
        }

        .od-fallback {
          position: fixed; right: 24px; bottom: 24px; z-index: 12;
          max-width: 280px; padding: 12px 14px;
          border: 1px solid var(--border); border-radius: 8px;
          color: var(--fg-2); background: var(--surface);
          font-family: var(--font-ui); font-size: 13px; line-height: 1.4;
        }
        .od-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        /* Keyframes */
        @keyframes od-rise-in { to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes od-tagline-word-in {
          0%   { opacity: 0; transform: translate3d(0, 0.7em, 0) rotateX(-60deg); }
          68%  { opacity: 1; transform: translate3d(0, -0.08em, 0) rotateX(4deg); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) rotateX(0deg); }
        }
        @keyframes od-specular-sweep {
          0%   { opacity: 0; transform: translateX(-135%) skewX(-12deg); }
          18%  { opacity: 0.9; }
          100% { opacity: 0; transform: translateX(135%) skewX(-12deg); }
        }
        @keyframes od-pin-in {
          0%   { opacity: 0; transform: translate(-50%,-100%) scale(0.7) translateY(24px); }
          70%  { opacity: 1; transform: translate(-50%,-100%) scale(1.06) translateY(-4px); }
          100% { opacity: 1; transform: translate(-50%,-100%) scale(1) translateY(0); }
        }
        @keyframes od-pin-in-tablet {
          0%   { opacity: 0; transform: translate(-50%,-100%) scale(0.65) translateY(20px); }
          100% { opacity: 1; transform: translate(-50%,-100%) scale(0.92) translateY(0); }
        }
        @keyframes od-pin-in-mobile {
          0%   { opacity: 0; transform: translate(-50%,-100%) scale(0.6) translateY(16px); }
          100% { opacity: 1; transform: translate(-50%,-100%) scale(0.82) translateY(0); }
        }

        /* Responsive (verbatim from source) */
        @media (max-width: 1100px) {
          .od-hero-copy { width: min(52vw, 640px); }
          .od-product-name { font-size: clamp(50px, 5.5vw, 84px); }
          .od-tagline { font-size: clamp(23px, 2.45vw, 36px); }
        }
        @media (max-width: 820px) {
          .od-hero-copy { top: 18%; left: clamp(24px, 6vw, 54px); width: min(62vw, 560px); transform: none; }
          .od-logo { width: clamp(120px, 18vw, 160px); margin-bottom: 18px; }
          .od-product-name { font-size: clamp(46px, 6.6vw, 74px); }
          .od-tagline { margin-top: 22px; font-size: clamp(22px, 3.2vw, 31px); }
          .od-cta { margin-top: 24px; min-width: 200px; height: 56px; }
          .od-menu-region { top: 24px; right: 24px; }
          .od-menu-toggle { width: 48px; height: 48px; }
          #landing-india-pin { top: 54%; left: 81%; transform: translate(-50%,-100%) scale(0.82); }
          .od-india-pin-label { left: 32px; font-size: 11px; }
          #landing-india-pin.od-pin-animate { animation: od-pin-in-tablet 760ms cubic-bezier(0.2,0,0,1) 0ms forwards; }
        }
        @media (max-width: 560px) {
          .od-hero-copy { top: 12.5%; left: 22px; width: calc(100vw - 44px); }
          .od-logo { width: 116px; margin-bottom: 14px; }
          .od-product-name { max-width: 100%; font-size: clamp(40px, 11.8vw, 58px); line-height: 1.04; white-space: normal; flex-wrap: wrap; }
          .od-tagline { max-width: 18ch; margin-top: 16px; font-size: clamp(20px, 5.5vw, 25px); line-height: 1.26; }
          .od-tagline-line { white-space: normal; }
          .od-tagline-line + .od-tagline-line { margin-left: 0.45em; }
          .od-cta { width: 100%; max-width: 320px; height: 56px; margin-top: 22px; }
          .od-menu-region { top: 18px; right: 18px; }
          .od-menu-toggle { width: 48px; height: 48px; }
          .od-menu-panel { width: calc(100vw - 36px); padding: 20px; }
          #landing-india-pin { top: 64.3%; left: 58.5%; transform: translate(-50%,-100%) scale(0.76); }
          .od-india-pin-label { left: 32px; min-height: 24px; padding: 0 8px; font-size: 10px; }
          #landing-india-pin.od-pin-animate { animation: od-pin-in-mobile 760ms cubic-bezier(0.2,0,0,1) 0ms forwards; }
        }
        @media (prefers-reduced-motion: reduce) {
          .od-root *, .od-root *::before, .od-root *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          .od-logo, .od-product-name, .od-tagline span, .od-cta { opacity: 1; transform: none; }
          .od-cta::before, .od-cta::after { animation: none !important; transition: none !important; }
          #landing-india-pin { opacity: 1; transform: translate(-50%,-100%) scale(1); }
        }
      `}</style>

      {/* ── WebGL canvas — fixed, full-viewport, behind page layer ── */}
      <canvas
        id="od-canvas"
        ref={canvasRef}
        aria-label={tr.globeAlt}
      />

      {/* ── Page overlay — pointer-events: none, all children opt-in ── */}
      <div
        className={`od-root od-page ${sceneReady ? 'od-scene-ready' : ''}`}
        data-theme={theme}
      >
        <main className="od-hero">
          {/* ── Hero copy (left column) ── */}
          <div className="od-hero-copy">
            <img
              className="od-logo"
              src="/LOGO.png"
              width={1254}
              height={1254}
              alt={tr.logoAlt}
            />

            <h1 className="od-product-name">
              <span>AeroTrace</span>{' '}
              <span className="aqi">A(<span className="q">Q</span>)I</span>
            </h1>

            <p className="od-tagline">
              {tr.tagline.map((lineWords, li) => (
                <span key={li} className="od-tagline-line">
                  {lineWords.map((word, wi) => {
                    const delay = 760 + (li * lineWords.length + wi) * 82;
                    return (
                      <React.Fragment key={wi}>
                        {wi > 0 && ' '}
                        <span className="od-word" style={{ '--od-delay': `${delay}ms` }}>
                          {word}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </span>
              ))}
            </p>

            <button
              ref={ctaRef}
              className="od-cta"
              type="button"
              onClick={handleCtaClick}
              onPointerMove={onCtaMove}
              onPointerLeave={onCtaLeave}
            >
              <span>{tr.cta}</span>
            </button>
          </div>

          {/* ── Menu region (top-right) ── */}
          <div className="od-menu-region" ref={menuRef}>
            <button
              className="od-menu-toggle"
              type="button"
              aria-label={menuOpen ? tr.menuClose : tr.menuOpen}
              aria-expanded={menuOpen ? 'true' : 'false'}
              aria-controls="od-menu-panel"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <aside
              id="od-menu-panel"
              className={`od-menu-panel${menuOpen ? ' is-open' : ''}`}
              aria-label={tr.menu}
            >
              {/* Appearance block */}
              <div className="od-menu-block">
                <p className="od-menu-label">{tr.appearance}</p>
                <div
                  className="od-appearance-options"
                  role="group"
                  aria-label={tr.appearanceGroup}
                >
                  {['light', 'dark'].map((t) => (
                    <button
                      key={t}
                      className="od-appearance-option"
                      type="button"
                      aria-pressed={theme === t ? 'true' : 'false'}
                      onClick={() => setTheme(t)}
                    >
                      {tr[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings / Language block */}
              <div className="od-menu-block">
                <p className="od-menu-label">{tr.settings}</p>
                <div className="od-language-row">
                  <span className="od-language-name">{tr.language}</span>
                  <div
                    className={`od-language-picker${pickerOpen ? ' is-open' : ''}`}
                    ref={pickerRef}
                  >
                    <button
                      className="od-language-trigger"
                      type="button"
                      aria-label={tr.selectLanguage}
                      aria-haspopup="listbox"
                      aria-expanded={pickerOpen ? 'true' : 'false'}
                      onClick={(e) => { e.stopPropagation(); setPickerOpen((o) => !o); }}
                    >
                      <span>{tr.languages[langCode]}</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <div className="od-language-list" role="listbox" aria-label={tr.language}>
                      {['en', 'hi', 'mr'].map((code) => (
                        <button
                          key={code}
                          className="od-language-option"
                          type="button"
                          role="option"
                          aria-selected={langCode === code ? 'true' : 'false'}
                          onClick={() => {
                            setLangCode(code);
                            setLang(code);
                            setPickerOpen(false);
                          }}
                        >
                          {tr.languages[code]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Map block */}
              <div className="od-menu-block">
                <a
                  className="od-live-map-link"
                  href="/national"
                  onClick={handleLiveMapClick}
                >
                  <span className="od-live-map-label">
                    <span className="od-live-map-dot" aria-hidden="true" />
                    <span>{tr.liveMap}</span>
                  </span>
                  <span className="od-live-map-target">{tr.screen}</span>
                </a>
              </div>
            </aside>
          </div>
        </main>

        {/* ── WebGL fallback ── */}
        {webglFailed && (
          <div className="od-fallback" role="status">
            {tr.fallback}
          </div>
        )}

        {/* ── Screen-reader status ── */}
        <div className="od-sr-only" aria-live="polite">{statusMsg}</div>
      </div>

      {/* ── India pin — rendered OUTSIDE .od-page (no overflow:hidden) ──
           className is driven by sceneReady React state — NOT manual classList.add (React
           would strip manually-added classes on every re-render). When sceneReady flips true,
           React commits className="od-pin-animate" → CSS animation fires exactly once. ── */}
      <div
        id="landing-india-pin"
        ref={pinRef}
        className={sceneReady ? 'od-pin-animate' : ''}
        aria-label={tr.pinAlt}
        role="img"
      >
        <span className="od-india-pin-mark" aria-hidden="true" />
        <span className="od-india-pin-label">{tr.pin}</span>
      </div>
    </>
  );
}
