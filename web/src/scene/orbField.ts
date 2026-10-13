import * as THREE from "three";

/**
 * Cinematic WebGL field — particle hologram + orbital seals.
 * Craft inspired by HorizonX Orvane / Halovane and ThreeUI Agent AI moods.
 * Original geometry; not a copy of paid template source.
 */
export function mountOrbField(host: HTMLElement) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060a, 0.028);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "orb-canvas";
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x6e8599, 0.45));
  const key = new THREE.DirectionalLight(0xffd29a, 1.2);
  key.position.set(5, 6, 3);
  scene.add(key);
  const cyan = new THREE.PointLight(0x4fd0ff, 2.2, 24);
  cyan.position.set(-4, 1.5, 3);
  scene.add(cyan);
  const ember = new THREE.PointLight(0xff9a4a, 1.6, 16);
  ember.position.set(2.5, -0.5, 2);
  scene.add(ember);

  // Hologram particle shell
  const COUNT = 14000;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 1.65 + (Math.random() - 0.5) * 0.35;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.95;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    seeds[i] = Math.random() * Math.PI * 2;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const cloud = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: 0x9ed7ff,
      size: 0.018,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(cloud);

  // Inner core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1a2430,
      metalness: 0.85,
      roughness: 0.22,
      emissive: 0x0a3048,
      emissiveIntensity: 0.8,
    }),
  );
  scene.add(core);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.58, 1)),
    new THREE.LineBasicMaterial({ color: 0x6ad4ff, transparent: true, opacity: 0.35 }),
  );
  scene.add(wire);

  // Orbital rings
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1 + i * 0.38, 0.012, 10, 160),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x4fd0ff : 0xe8b86a,
        metalness: 0.95,
        roughness: 0.2,
        emissive: i % 2 === 0 ? 0x123848 : 0x3a2810,
        emissiveIntensity: 0.45,
      }),
    );
    ring.rotation.x = Math.PI / 2.4 + i * 0.18;
    ring.rotation.y = i * 0.4;
    scene.add(ring);
    rings.push(ring);
  }

  // Soft floor plane glow
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 64),
    new THREE.MeshBasicMaterial({
      color: 0x0a1520,
      transparent: true,
      opacity: 0.55,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.85;
  scene.add(disc);

  let raf = 0;
  let mx = 0;
  let my = 0;
  let energy = 0;

  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener("pointermove", onMove);

  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener("resize", resize);

  const tick = (t: number) => {
    const sec = t * 0.001;
    const pos = pGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      const breathe = 1 + Math.sin(sec * 1.2 + s) * 0.04 + energy * 0.08;
      const ix = i * 3;
      const bx = positions[ix];
      const by = positions[ix + 1];
      const bz = positions[ix + 2];
      // scatter under pointer energy
      const scatter = 1 + energy * (0.15 + (s % 1) * 0.35);
      pos.setXYZ(i, bx * breathe * scatter, by * breathe * scatter, bz * breathe * scatter);
    }
    pos.needsUpdate = true;

    cloud.rotation.y = sec * 0.08 + mx * 0.15;
    cloud.rotation.x = my * 0.08;
    core.rotation.y = -sec * 0.35;
    core.rotation.z = sec * 0.12;
    wire.rotation.copy(core.rotation);
    rings.forEach((r, i) => {
      r.rotation.z = sec * (0.12 + i * 0.03) * (i % 2 === 0 ? 1 : -1);
      r.rotation.y = sec * 0.05 * i;
    });

    energy *= 0.96;
    cyan.intensity = 2.0 + Math.sin(sec * 2.4) * 0.35 + energy * 1.2;
    ember.intensity = 1.4 + Math.sin(sec * 1.7) * 0.3;

    camera.position.x += (mx * 0.9 - camera.position.x) * 0.035;
    camera.position.y += (0.2 + my * 0.35 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pulse() {
      energy = 1;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    },
  };
}

export type OrbFieldApi = ReturnType<typeof mountOrbField>;
