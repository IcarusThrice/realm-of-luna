// The look of space: a painted deep-sky backdrop, a star field, the Moon's surface, and
// the glow around planets. Everything is drawn in code, so there are no image files to
// load and nothing to license. All functions take THREE so this file has no globals.

const TAU = Math.PI * 2;

// --- Noise ---------------------------------------------------------------------------------
// Smooth 3D value noise. Sampling it at points on a sphere gives clouds with no seam and
// no pinching at the poles, which a flat 2D pattern wrapped onto a sphere would have.
function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const perm = new Uint8Array(512), val = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    const aa = perm[a] + Z, ab = perm[a + 1] + Z, ba = perm[b] + Z, bb = perm[b + 1] + Z;
    const x1 = val[perm[aa]] + (val[perm[ba]] - val[perm[aa]]) * u;
    const x2 = val[perm[ab]] + (val[perm[bb]] - val[perm[ab]]) * u;
    const x3 = val[perm[aa + 1]] + (val[perm[ba + 1]] - val[perm[aa + 1]]) * u;
    const x4 = val[perm[ab + 1]] + (val[perm[bb + 1]] - val[perm[ab + 1]]) * u;
    const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
  };
  // Layered noise: each octave adds finer detail at half the strength. Returns 0..1.
  const fbm = (x, y, z, octaves) => {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x, y, z) * amp; norm += amp;
      x = x * 2.03 + 11.7; y = y * 2.03 + 3.1; z = z * 2.03 + 7.9; amp *= 0.5;
    }
    return sum / norm;
  };
  return { noise, fbm, rnd };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// The galaxy's band. Its plane is set so that, from the chart's opening view, the band
// runs behind the plate from lower left to upper right, brightest toward the upper right.
// BAND_NORMAL is the plane's normal; BAND_CORE is the direction of the galactic centre.
const BAND_NORMAL = [0.550, -0.831, 0.078];
const BAND_CORE = [-0.018, -0.105, -0.994];

// --- The deep sky ----------------------------------------------------------------------------
// Paints the backdrop a few rows at a time so the page stays responsive, then calls done
// with a canvas. The image is an equirectangular map for the inside of a large sphere:
// a dim galactic band with dust lanes, and a few faint clouds of teal and violet gas.
export function paintSky(width, height, done) {
  const { fbm } = makeNoise(20260523);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const d = image.data;
  const n = BAND_NORMAL, core = BAND_CORE;
  let y = 0;
  const step = () => {
    const until = Math.min(height, y + 24);
    for (; y < until; y++) {
      const theta = (y + 0.5) / height * Math.PI, st = Math.sin(theta), ct = Math.cos(theta);
      for (let x = 0; x < width; x++) {
        const phi = (x + 0.5) / width * TAU;
        const vx = -Math.cos(phi) * st, vy = ct, vz = Math.sin(phi) * st;
        const off = vx * n[0] + vy * n[1] + vz * n[2];              // distance from the band's plane
        const toCore = vx * core[0] + vy * core[1] + vz * core[2];  // 1 at the galactic centre
        // The band: a soft ridge, wider and brighter toward the centre, broken up by noise.
        const widthHere = 0.2 + 0.1 * clamp01(toCore);
        const ridge = Math.exp(-(off * off) / (widthHere * widthHere));
        const grain = fbm(vx * 3.1 + 5, vy * 3.1, vz * 3.1, 5);
        let band = ridge * (0.35 + 0.9 * grain) * (0.55 + 0.6 * clamp01(toCore * 0.5 + 0.5));
        // Dust lanes: dark filaments running along the middle of the band.
        const dust = fbm(vx * 6.3 + 40, vy * 6.3 + 9, vz * 6.3, 4);
        band *= 1 - 0.85 * smooth(0.46, 0.7, dust) * Math.exp(-(off * off) / 0.016);
        // Gas clouds: wispy, only where a slow mask allows, so most of the sky stays dark.
        const mask = smooth(0.52, 0.74, fbm(vx * 1.25 + 80, vy * 1.25 + 17, vz * 1.25 + 3, 3));
        const wisp = fbm(vx * 4.4 + 21, vy * 4.4 + 60, vz * 4.4 + 33, 5);
        const cloud = mask * smooth(0.42, 0.8, wisp);
        const hue = fbm(vx * 0.9 + 140, vy * 0.9, vz * 0.9 + 70, 2); // teal on one side of the sky, violet on the other
        // Compose. The base is a blue-black that lightens very slightly toward the band.
        let r = 4 + 9 * ridge, g = 6 + 11 * ridge, b = 13 + 20 * ridge;
        const warm = clamp01(toCore * 0.5 + 0.5);
        r += band * (80 + 96 * warm); g += band * (78 + 62 * warm); b += band * (112 + 10 * warm);
        const teal = smooth(0.38, 0.62, hue), k = cloud * 120;
        r += k * (0.16 + 0.5 * (1 - teal)); g += k * (0.3 + 0.42 * teal); b += k * (0.78 + 0.1 * teal);
        const o = (y * width + x) * 4;
        d[o] = r > 255 ? 255 : r; d[o + 1] = g > 255 ? 255 : g; d[o + 2] = b > 255 ? 255 : b; d[o + 3] = 255;
      }
    }
    if (y < height) { setTimeout(step, 0); return; }
    ctx.putImageData(image, 0, 0);
    done(canvas);
  };
  step();
}

// --- Stars -----------------------------------------------------------------------------------
// A few thousand points with their own size, colour and twinkle. Two in five sit along the
// galactic band, so the band reads as stars and not only as haze.
export function makeStars(THREE, count, pixelRatio) {
  const { rnd } = makeNoise(77123);
  const pos = new Float32Array(count * 3), tint = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
  const n = BAND_NORMAL;
  // Star colours by temperature: most are white, some blue-white, fewer amber and orange.
  const palette = [[1, 1, 1], [0.78, 0.86, 1], [0.66, 0.78, 1], [1, 0.93, 0.78], [1, 0.82, 0.62], [1, 0.72, 0.55]];
  const weights = [0.42, 0.2, 0.1, 0.14, 0.09, 0.05];
  for (let i = 0; i < count; i++) {
    let x, y, z;
    for (;;) {
      const u = rnd() * 2 - 1, t = rnd() * TAU, q = Math.sqrt(1 - u * u);
      x = q * Math.cos(t); y = u; z = q * Math.sin(t);
      if (i % 5 > 1) break; // three in five: anywhere
      const off = x * n[0] + y * n[1] + z * n[2];
      if (rnd() < Math.exp(-(off * off) / 0.035)) break; // two in five: near the band
    }
    const dist = 420 + rnd() * 160;
    pos[i * 3] = x * dist; pos[i * 3 + 1] = y * dist; pos[i * 3 + 2] = z * dist;
    let pick = rnd(), c = 0;
    while (c < weights.length - 1 && pick > weights[c]) { pick -= weights[c]; c++; }
    // Mostly faint, a handful bright: brightness follows a steep curve.
    const m = Math.pow(rnd(), 6);
    const lum = 0.5 + 0.5 * Math.pow(rnd(), 2) + m * 0.6;
    tint[i * 3] = palette[c][0] * lum; tint[i * 3 + 1] = palette[c][1] * lum; tint[i * 3 + 2] = palette[c][2] * lum;
    size[i] = 1.6 + 1.9 * rnd() + m * 7;
    phase[i] = rnd();
  }
  return pointCloud(THREE, pos, tint, size, phase, pixelRatio);
}

// Round, softly glowing points that twinkle. Sizes are in screen pixels.
function pointCloud(THREE, pos, tint, size, phase, pixelRatio) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: pixelRatio } },
    vertexShader: `
      attribute vec3 tint; attribute float size; attribute float phase;
      uniform float uTime; uniform float uScale;
      varying vec3 vTint;
      void main() {
        float tw = 0.8 + 0.2 * sin(uTime * (0.5 + phase * 1.3) + phase * 40.0);
        vTint = tint * tw;
        gl_PointSize = size * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vTint;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(vTint, core * core);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// --- The Moon --------------------------------------------------------------------------------
// Returns { colour, height } canvases: dark seas, bright highlands, and craters with a lit
// rim and a shadowed bowl. The height canvas drives the surface relief.
export function paintMoon(width = 1024, height = 512) {
  const { fbm, rnd } = makeNoise(9173);
  const colour = document.createElement('canvas'), relief = document.createElement('canvas');
  colour.width = relief.width = width; colour.height = relief.height = height;
  const cctx = colour.getContext('2d'), hctx = relief.getContext('2d');
  const cimg = cctx.createImageData(width, height), himg = hctx.createImageData(width, height);
  const c = cimg.data, h = himg.data;
  // Craters: random spots on the sphere. Small ones are common, big ones rare.
  const craters = [];
  for (let i = 0; i < 260; i++) {
    const u = rnd() * 2 - 1, t = rnd() * TAU, q = Math.sqrt(1 - u * u);
    craters.push({ x: q * Math.cos(t), y: u, z: q * Math.sin(t), r: 0.012 + 0.11 * Math.pow(rnd(), 5), fresh: rnd() });
  }
  // Bucket craters by latitude band so each pixel checks only the few that could reach it.
  const BANDS = 24, buckets = Array.from({ length: BANDS }, () => []);
  for (const k of craters) {
    const lat = Math.asin(k.y), reach = Math.asin(Math.min(1, k.r * 1.5));
    const lo = Math.max(0, Math.floor((lat - reach + Math.PI / 2) / Math.PI * BANDS));
    const hi = Math.min(BANDS - 1, Math.floor((lat + reach + Math.PI / 2) / Math.PI * BANDS));
    for (let b = lo; b <= hi; b++) buckets[b].push(k);
  }
  for (let y = 0; y < height; y++) {
    const theta = (y + 0.5) / height * Math.PI, st = Math.sin(theta), ct = Math.cos(theta);
    const list = buckets[Math.min(BANDS - 1, Math.floor((Math.PI / 2 - theta + Math.PI / 2) / Math.PI * BANDS))];
    for (let x = 0; x < width; x++) {
      const phi = (x + 0.5) / width * TAU;
      const vx = -Math.cos(phi) * st, vy = ct, vz = Math.sin(phi) * st;
      // Seas (maria): broad dark plains. Highlands: brighter and rougher.
      const sea = smooth(0.5, 0.62, fbm(vx * 1.7 + 3, vy * 1.7 + 8, vz * 1.7, 4));
      const rough = fbm(vx * 9 + 20, vy * 9, vz * 9 + 5, 5);
      const fine = fbm(vx * 40, vy * 40 + 7, vz * 40, 3);
      let tone = 0.9 - 0.34 * sea + (rough - 0.5) * 0.22 * (1 - 0.5 * sea) + (fine - 0.5) * 0.08;
      let lift = 0.5 + (rough - 0.5) * 0.35 * (1 - 0.6 * sea) + (fine - 0.5) * 0.1 - 0.05 * sea;
      for (let i = 0; i < list.length; i++) {
        const k = list[i];
        const dot = vx * k.x + vy * k.y + vz * k.z;
        if (dot < 1 - 1.2 * k.r * k.r) continue; // more than about 1.5 radii away
        const dist = Math.acos(dot > 1 ? 1 : dot) / k.r; // 0 at the centre, 1 at the rim
        if (dist > 1.5) continue;
        if (dist < 1) {
          const bowl = 1 - dist * dist;
          lift -= 0.22 * bowl; tone -= 0.05 * bowl;
        }
        const rim = Math.exp(-((dist - 1) * (dist - 1)) / 0.012);
        lift += 0.16 * rim; tone += (0.05 + 0.1 * k.fresh) * rim;
        if (k.fresh > 0.86 && dist > 1) tone += 0.05 * Math.exp(-(dist - 1) * 5); // bright ejecta round a young crater
      }
      tone = clamp01(tone); lift = clamp01(lift);
      const o = (y * width + x) * 4;
      // Ivory with a touch of warmth: this is Luna, not a grey rock.
      c[o] = 255 * tone; c[o + 1] = 246 * tone; c[o + 2] = 224 * tone; c[o + 3] = 255;
      h[o] = h[o + 1] = h[o + 2] = 255 * lift; h[o + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  hctx.putImageData(himg, 0, 0);
  return { colour, relief };
}

// --- Glow ------------------------------------------------------------------------------------
// A thin shell of light that hugs a planet's edge, like air catching the light. Two layers
// share one unit sphere: `rim` brightens the planet's own limb, `air` glows just outside it.
export function makeAtmosphere(THREE) {
  const geometry = new THREE.SphereGeometry(1, 32, 22);
  const vertexShader = `
    varying vec3 vNormal; varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const cache = new Map();
  const material = (kind, hex, strength) => {
    const id = kind + hex + strength;
    if (!cache.has(id)) {
      cache.set(id, new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(hex) }, uStrength: { value: strength } },
        vertexShader,
        fragmentShader: kind === 'rim' ? `
          uniform vec3 uColor; uniform float uStrength;
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
            gl_FragColor = vec4(uColor, f * uStrength);
          }` : `
          uniform vec3 uColor; uniform float uStrength;
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            float f = smoothstep(0.0, 0.62, abs(dot(normalize(vNormal), normalize(vView))));
            gl_FragColor = vec4(uColor, f * f * uStrength);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: kind === 'rim' ? THREE.FrontSide : THREE.BackSide,
      }));
    }
    return cache.get(id);
  };
  // Adds both layers to a planet mesh of the given radius.
  return (mesh, radius, hex, strength = 1) => {
    for (const [kind, scale, power] of [['rim', 1.012, 0.7], ['air', 1.2, 0.34]]) {
      const shell = new THREE.Mesh(geometry, material(kind, hex, power * strength));
      shell.scale.setScalar(radius * scale);
      shell.userData.shared = true; // geometry and material outlive any one planet
      mesh.add(shell);
    }
  };
}

// A soft round glow, as a texture for additive sprites.
export function glowTexture(THREE, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// A thin belt of dust between the plate and the outer orbit.
export function makeBelt(THREE, inner, outer, count, pixelRatio) {
  const { rnd } = makeNoise(4411);
  const pos = new Float32Array(count * 3), tint = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = rnd() * TAU;
    // Denser toward the middle of the belt.
    const r = inner + (outer - inner) * (0.5 + (rnd() + rnd() + rnd() - 1.5) / 3);
    pos[i * 3] = r * Math.cos(t); pos[i * 3 + 1] = (rnd() + rnd() - 1) * 0.45; pos[i * 3 + 2] = r * Math.sin(t);
    const brass = rnd() < 0.14, lum = 0.4 + 0.6 * rnd();
    tint[i * 3] = (brass ? 0.95 : 0.62) * lum; tint[i * 3 + 1] = (brass ? 0.78 : 0.7) * lum; tint[i * 3 + 2] = (brass ? 0.45 : 0.9) * lum;
    size[i] = 1.4 + 2.4 * rnd() * rnd();
    phase[i] = rnd();
  }
  return pointCloud(THREE, pos, tint, size, phase, pixelRatio);
}
