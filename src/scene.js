// The 3D star chart. Uses the global THREE loaded by index.html.
// createChart() returns null when WebGL is unavailable, and the page falls back to the list.

const BRASS = '#d0aa5c';
const LINE = '#3a4560';
const PLATE_RADIUS = 14;
const HOME = { az: 0.95, pol: 0.98 };

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
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
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
    for (let i = 0; i < 1100; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, d = 130 + Math.random() * 120;
      const q = Math.sqrt(1 - u * u);
      pts.push(d * q * Math.cos(t), d * u, d * q * Math.sin(t));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd6ea, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.75 })));
  }

  // The plate: sector wedges, range rings, rim ticks.
  const ring = (r, color, opacity) => {
    const pts = [];
    for (let i = 0; i < 128; i++) pts.push(P(r, i * 360 / 128));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  };
  for (const s of Object.values(sectors)) {
    const wedge = new THREE.Mesh(
      new THREE.CircleGeometry(PLATE_RADIUS, 48, rad(s.from), rad(120)),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    wedge.rotation.x = -Math.PI / 2;
    wedge.position.y = -0.02;
    scene.add(wedge);
    scene.add(line([P(2.4, s.from), P(PLATE_RADIUS, s.from)], LINE));
  }
  ring(4.6, LINE, 0.9); ring(9.2, LINE, 0.9); ring(PLATE_RADIUS, BRASS, 0.9); ring(PLATE_RADIUS + 0.5, BRASS, 0.35);
  {
    const pts = [];
    for (let i = 0; i < 72; i++) pts.push(P(PLATE_RADIUS, i * 5), P(PLATE_RADIUS - (i % 6 === 0 ? 0.7 : 0.32), i * 5));
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: BRASS, transparent: true, opacity: 0.7 })));
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
  const mark = (cls, build, v, color) => {
    const el = document.createElement('div');
    el.className = 'mark ' + cls;
    build(el);
    if (color) el.style.color = color;
    tags.appendChild(el);
    marks.push({ el, v });
  };
  for (const s of Object.values(sectors)) mark('', (el) => { el.textContent = s.name; }, P(PLATE_RADIUS + 2.1, s.from + 60), s.color);
  mark('court', (el) => {
    el.textContent = 'The Moon Court';
    const small = document.createElement('small');
    small.textContent = 'Houses cast their votes here';
    el.appendChild(small);
  }, new THREE.Vector3(0, 4.1, 0));
  mark('deep', (el) => { el.textContent = 'The Interchain Deep'; }, P(PLATE_RADIUS + 6.5, 122));

  // Systems: two bodies around their shared centre, on a stem above the plate.
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.42, 64), new THREE.MeshBasicMaterial({ color: BRASS, side: THREE.DoubleSide }));
  selRing.rotation.x = -Math.PI / 2;
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
      s.base = base;

      group.add(line([base, pos], 0x5b6680));
      const foot = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: sectors[s.sector].color, side: THREE.DoubleSide }));
      foot.rotation.x = -Math.PI / 2;
      foot.position.copy(base).setY(0.01);
      group.add(foot);

      // Radii follow each token's share of the pool's value; both bodies circle the barycentre.
      const ra = 0.7 * k * Math.cbrt(2 * s.shareA);
      const rb = 0.7 * k * Math.cbrt(2 * (1 - s.shareA));
      const sep = (ra + rb) * 1.25;
      const da = sep * (1 - s.shareA), db = sep * s.shareA;
      const extent = Math.max(da + ra, db + rb);

      const tilt = new THREE.Group();
      tilt.position.copy(pos);
      tilt.rotation.set(0.35 + (i % 3) * 0.12, 0, -0.25 + (i % 4) * 0.14);
      const spin = new THREE.Group();
      tilt.add(spin);
      const body = (r, sym) => {
        const c = tokens[sym] || unknownColor;
        return new THREE.Mesh(new THREE.SphereGeometry(r, 32, 22), new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, emissive: c, emissiveIntensity: 0.18 }));
      };
      const A = body(ra, s.a), B = body(rb, s.b);
      A.position.x = -da; B.position.x = db;
      spin.add(A); spin.add(B);
      const orbit = [];
      const or = Math.max(da, db);
      for (let j = 0; j < 72; j++) orbit.push(new THREE.Vector3(or * Math.cos(j * Math.PI / 36), 0, or * Math.sin(j * Math.PI / 36)));
      tilt.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbit), new THREE.LineBasicMaterial({ color: 0x8590ad, transparent: true, opacity: 0.7 })));
      if (s.crown) {
        const crown = new THREE.Mesh(new THREE.TorusGeometry(extent + 0.3 * k, 0.045, 10, 80), new THREE.MeshBasicMaterial({ color: BRASS }));
        crown.rotation.x = Math.PI / 2;
        tilt.add(crown);
      }
      group.add(tilt);
      spin.rotation.y = i * 0.9;
      spinners.push({ g: spin, v: 0.25 + (i % 3) * 0.08 });

      const mid = base.clone().multiplyScalar(0.5).setY(1.6);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0), mid, base.clone().setY(0.05));
      const lane = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineDashedMaterial({ color: BRASS, dashSize: 0.3, gapSize: 0.32, transparent: true, opacity: 0.6 }));
      lane.computeLineDistances();
      lanes.add(lane);

      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag';
      const nm = document.createElement('b'); nm.textContent = s.name;
      const pr = document.createElement('span'); pr.textContent = s.a + ' · ' + s.b;
      tag.appendChild(nm); tag.appendChild(pr);
      if (s.crown) { const cr = document.createElement('i'); cr.textContent = 'Crown system'; tag.appendChild(cr); }
      tag.addEventListener('click', () => onSelect(s.id));
      tag.setAttribute('aria-pressed', s.id === selected ? 'true' : 'false');
      tags.appendChild(tag);
      tagEls[s.id] = tag;
      s.anchor = pos.clone().setY(pos.y - extent - 0.3);
    });
  }

  function setSelected(id) {
    selected = id;
    for (const [key, el] of Object.entries(tagEls)) el.setAttribute('aria-pressed', key === id ? 'true' : 'false');
  }

  // Camera: drag to turn, wheel or pinch to zoom.
  const view = { az: HOME.az, pol: HOME.pol, dist: 36, auto: true };
  let W = 1, H = 1;
  const fitDist = () => Math.min(96, Math.max(36, 17.5 / (Math.tan(rad(19)) * (W / H))));
  const resize = () => {
    W = stage.clientWidth || 1; H = stage.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (view.auto) view.dist = fitDist();
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  const zoom = (f) => { view.auto = false; view.dist = Math.min(110, Math.max(16, view.dist * f)); };
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
  const place = (el, v, dy, above) => {
    v3.copy(v).project(camera);
    const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    el.style.transform = `translate(${x.toFixed(1)}px,${(y + dy).toFixed(1)}px) translate(-50%,${above ? '-100%' : '0'})`;
    return v3.z;
  };
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!still) for (const s of spinners) s.g.rotation.y += s.v * dt;
    const sp = Math.sin(view.pol);
    camera.position.set(target.x + view.dist * sp * Math.cos(view.az), target.y + view.dist * Math.cos(view.pol), target.z + view.dist * sp * Math.sin(view.az));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const cur = systems.find((s) => s.id === selected);
    selRing.visible = !!cur;
    if (cur) selRing.position.copy(cur.base).setY(0.02);
    for (const s of systems) {
      const el = tagEls[s.id];
      if (!el) continue;
      const z = place(el, s.anchor, 4, false);
      el.style.zIndex = String(2000 - Math.round(z * 1000));
    }
    for (const m of marks) place(m.el, m.v, -4, true);
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
