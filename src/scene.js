// The 3D star chart. Uses the global THREE loaded by index.html.
// createChart() returns null when WebGL is unavailable, and the page falls back to the list.
import { PLATE_RADIUS, pairName } from './model.js';

const BRASS = '#d0aa5c';
const LINE = '#3a4560';
const HOME = { az: 0.95, pol: 0.98 };
const OUTER_RING = 19.8;
const FIT_RADIUS = 25;

const rad = (d) => d * Math.PI / 180;

export function createChart({ stage, canvas, tags, sectors, tokens, unknownColor, onSelect }) {
  const THREE = window.THREE;
  if (!THREE) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (err) {
    return null;
  }
  renderer.setClearColor(0x070a13, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1400);
  const target = new THREE.Vector3(0, 0.8, 0);
  const P = (r, deg, y = 0) => new THREE.Vector3(r * Math.cos(rad(deg)), y, -r * Math.sin(rad(deg)));
  const line = (pts, color, opacity = 1) => new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(8, 20, 12);
  scene.add(sun);
  const moonLight = new THREE.PointLight(0xfff2cf, 0.8, 0);
  moonLight.position.set(0, 2.2, 0);
  scene.add(moonLight);

  // Stars.
  {
    const pts = [];
    for (let i = 0; i < 1400; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, d = 320 + Math.random() * 260;
      const q = Math.sqrt(1 - u * u);
      pts.push(d * q * Math.cos(t), d * u, d * q * Math.sin(t));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd6ea, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.75 })));
  }

  // The plate: one wedge per gauge, range rings, rim ticks.
  const circle = (r, n = 128) => {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(P(r, i * 360 / n));
    return pts;
  };
  const ring = (r, color, opacity) => {
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(r)), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  };
  for (const s of Object.values(sectors)) {
    const wedge = new THREE.Mesh(
      new THREE.CircleGeometry(PLATE_RADIUS, 48, rad(s.from), rad(s.span)),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    wedge.rotation.x = -Math.PI / 2;
    wedge.position.y = -0.02;
    scene.add(wedge);
    scene.add(line([P(2.4, s.from), P(PLATE_RADIUS, s.from)], LINE));
  }
  ring(4.4, LINE, 0.9); ring(7.3, LINE, 0.6); ring(10.3, LINE, 0.9); ring(PLATE_RADIUS, BRASS, 0.9); ring(PLATE_RADIUS + 0.5, BRASS, 0.35);
  {
    const pts = [];
    for (let i = 0; i < 72; i++) pts.push(P(PLATE_RADIUS, i * 5), P(PLATE_RADIUS - (i % 6 === 0 ? 0.7 : 0.32), i * 5));
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.7 })));
  }
  // The outer orbit: where pools outside the Alliance drift.
  {
    const far = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(OUTER_RING, 180)), new THREE.LineDashedMaterial({ color: 0x6b7591, dashSize: 0.35, gapSize: 0.55, transparent: true, opacity: 0.55 }));
    far.computeLineDistances();
    scene.add(far);
  }

  // The Moon Court at the centre.
  const glow = (hex) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, hex); g.addColorStop(0.25, hex + '88'); g.addColorStop(1, hex + '00');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  };
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0xf1e6b8, emissive: 0xb9a56a, emissiveIntensity: 0.55, roughness: 0.9 }),
  );
  moon.position.set(0, 2.2, 0);
  scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('#f1e6b8'), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(9, 9, 1);
  halo.position.copy(moon.position);
  scene.add(halo);
  scene.add(line([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.7, 0)], BRASS));

  // Fixed lettering, projected each frame.
  const marks = [];
  const mark = (cls, title, sub, v, color) => {
    const el = document.createElement('div');
    el.className = 'mark ' + cls;
    el.textContent = title;
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      el.appendChild(small);
    }
    if (color) el.style.color = color;
    tags.appendChild(el);
    marks.push({ el, v });
  };
  for (const s of Object.values(sectors)) mark('', s.name, '', P(PLATE_RADIUS + 1.7, s.from + s.span / 2), s.color);
  mark('court', 'The Moon Court', 'Houses cast their votes here', new THREE.Vector3(0, 4.1, 0));
  mark('deep', 'The Interchain Deep', 'Pools outside the Alliance', P(OUTER_RING + 5.2, 135));

  // Systems: bodies around their shared centre. Alliance systems stand on a stem above
  // the plate and are joined to the Moon by a trade lane. Outer systems float free.
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 10, 72), new THREE.MeshBasicMaterial({ color: BRASS }));
  selRing.visible = false;
  scene.add(selRing);

  let group = null, lanes = null, lanesOn = true;
  let systems = [], spinners = [], tagEls = {}, selected = null;

  function clearSystems() {
    if (group) {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      scene.remove(group);
    }
    Object.values(tagEls).forEach((el) => el.remove());
    tagEls = {}; spinners = [];
  }

  function setSystems(list) {
    clearSystems();
    systems = list;
    group = new THREE.Group();
    lanes = new THREE.Group();
    lanes.visible = lanesOn;
    group.add(lanes);
    scene.add(group);

    list.forEach((s, i) => {
      const k = s.size;
      const pos = P(s.r, s.deg, s.y);
      const base = P(s.r, s.deg, 0);
      const single = s.kind === 'single';
      s.pos = pos;

      if (!s.outer) {
        group.add(line([base, pos], 0x5b6680));
        const foot = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), new THREE.MeshBasicMaterial({ color: sectors[s.sector].color, side: THREE.DoubleSide }));
        foot.rotation.x = -Math.PI / 2;
        foot.position.copy(base).setY(0.01);
        group.add(foot);
      }

      // Radii follow each token's share of the pool's value; both bodies circle the barycentre.
      const ra = 0.7 * k * Math.cbrt(single ? 1 : 2 * s.shareA);
      const rb = single ? 0 : 0.7 * k * Math.cbrt(2 * (1 - s.shareA));
      const sep = single ? 0 : (ra + rb) * 1.25;
      const da = sep * (1 - s.shareA), db = sep * s.shareA;
      const extent = single ? ra * 1.5 : Math.max(da + ra, db + rb);
      s.extent = extent;

      const tilt = new THREE.Group();
      tilt.position.copy(pos);
      tilt.rotation.set(0.35 + (i % 3) * 0.12, 0, -0.25 + (i % 4) * 0.14);
      const spin = new THREE.Group();
      tilt.add(spin);
      // A ghost is a system the chart knows of but cannot read yet: drawn hollow.
      const body = (r, sym) => {
        const c = tokens[sym] || unknownColor;
        const mat = s.ghost
          ? new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.45 })
          : new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, emissive: c, emissiveIntensity: s.outer ? 0.1 : 0.18 });
        return new THREE.Mesh(new THREE.SphereGeometry(r, s.ghost ? 12 : 32, s.ghost ? 8 : 22), mat);
      };
      const A = body(ra, s.a);
      A.position.x = -da;
      spin.add(A);
      if (!single) {
        const B = body(rb, s.b);
        B.position.x = db;
        spin.add(B);
      }
      const orbit = [];
      const or = single ? extent : Math.max(da, db);
      for (let j = 0; j < 72; j++) orbit.push(new THREE.Vector3(or * Math.cos(j * Math.PI / 36), 0, or * Math.sin(j * Math.PI / 36)));
      tilt.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbit), new THREE.LineBasicMaterial({ color: 0x8590ad, transparent: true, opacity: s.outer ? 0.4 : 0.7 })));
      if (s.crown) {
        const crown = new THREE.Mesh(new THREE.TorusGeometry(extent + 0.3 * k, 0.045, 10, 80), new THREE.MeshBasicMaterial({ color: BRASS }));
        crown.rotation.x = Math.PI / 2;
        tilt.add(crown);
      }
      group.add(tilt);
      spin.rotation.y = i * 0.9;
      spinners.push({ g: spin, v: (s.outer ? 0.12 : 0.25) + (i % 3) * 0.08 });

      if (!s.outer) {
        const mid = base.clone().multiplyScalar(0.5).setY(1.6);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0), mid, base.clone().setY(0.05));
        const lane = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineDashedMaterial({ color: BRASS, dashSize: 0.3, gapSize: 0.32, transparent: true, opacity: 0.5 }));
        lane.computeLineDistances();
        lanes.add(lane);
      }

      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag' + (s.outer ? ' outer' : '') + (s.ghost ? ' ghost' : '');
      const nm = document.createElement('b'); nm.textContent = pairName(s);
      tag.appendChild(nm);
      const note = s.crown ? 'Crown system' : s.outer ? 'Outside the Alliance' : s.venue !== 'Astroport' ? s.venue : '';
      if (note) { const cr = document.createElement('i'); cr.textContent = note; tag.appendChild(cr); }
      tag.addEventListener('click', () => onSelect(s.id));
      tag.setAttribute('aria-pressed', s.id === selected ? 'true' : 'false');
      tags.appendChild(tag);
      tagEls[s.id] = tag;
      s.box = null;
      s.anchor = pos.clone().setY(pos.y - extent - 0.3);
    });
  }

  function setSelected(id) {
    selected = id;
    for (const [key, el] of Object.entries(tagEls)) el.setAttribute('aria-pressed', key === id ? 'true' : 'false');
    for (const s of systems) s.box = null; // the selected label is larger, so measure again
  }

  // Camera: drag to turn, wheel or pinch to zoom.
  const view = { az: HOME.az, pol: HOME.pol, dist: 60, auto: true };
  let W = 1, H = 1;
  const fitDist = () => Math.min(150, Math.max(48, FIT_RADIUS / (Math.tan(rad(19)) * (W / H))));
  const resize = () => {
    W = stage.clientWidth || 1; H = stage.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (view.auto) view.dist = fitDist();
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  const zoom = (f) => { view.auto = false; view.dist = Math.min(170, Math.max(16, view.dist * f)); };
  const reset = () => { view.az = HOME.az; view.pol = HOME.pol; view.auto = true; view.dist = fitDist(); };
  const ptrs = {};
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs[e.pointerId];
    if (!p) return;
    const ids = Object.keys(ptrs);
    if (ids.length === 1) {
      view.az -= (e.clientX - p.x) * 0.006;
      view.pol = Math.min(1.36, Math.max(0.3, view.pol - (e.clientY - p.y) * 0.005));
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ids.length === 2) {
      const a = ptrs[ids[0]], b = ptrs[ids[1]];
      const dd = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch / dd);
      pinch = dd;
    }
  });
  const drop = (e) => { delete ptrs[e.pointerId]; pinch = 0; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const v3 = new THREE.Vector3();
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!still) for (const s of spinners) s.g.rotation.y += s.v * dt;
    const sp = Math.sin(view.pol);
    camera.position.set(target.x + view.dist * sp * Math.cos(view.az), target.y + view.dist * Math.cos(view.pol), target.z + view.dist * sp * Math.sin(view.az));
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // The selection ring circles the chosen system and always faces the viewer.
    const cur = systems.find((s) => s.id === selected);
    selRing.visible = !!cur;
    if (cur) {
      selRing.position.copy(cur.pos);
      selRing.scale.setScalar(cur.extent + 0.55);
      selRing.quaternion.copy(camera.quaternion);
    }

    // Labels: selected first, then Alliance before outer, then nearest. A label that
    // would cover one already placed fades out; the system stays reachable from the
    // list and by turning the chart.
    const spots = [];
    for (const s of systems) {
      const el = tagEls[s.id];
      if (!el) continue;
      if (!s.box) s.box = { w: el.offsetWidth, h: el.offsetHeight };
      v3.copy(s.anchor).project(camera);
      spots.push({ s, el, x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H + 4, z: v3.z });
    }
    spots.sort((p, q) => (q.s.id === selected) - (p.s.id === selected) || p.s.outer - q.s.outer || p.z - q.z);
    const taken = [];
    for (const p of spots) {
      const box = { l: p.x - p.s.box.w / 2 - 4, r: p.x + p.s.box.w / 2 + 4, t: p.y - 4, b: p.y + p.s.box.h + 4 };
      const clash = taken.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
      p.el.classList.toggle('hid', clash);
      if (!clash) taken.push(box);
      p.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,0)`;
      p.el.style.zIndex = String(2000 - Math.round(p.z * 1000));
    }
    for (const m of marks) {
      v3.copy(m.v).project(camera);
      m.el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-v3.y * 0.5 + 0.5) * H - 4).toFixed(1)}px) translate(-50%,-100%)`;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    setSystems,
    setSelected,
    setLanes(on) { lanesOn = on; if (lanes) lanes.visible = on; },
    zoom,
    reset,
  };
}
