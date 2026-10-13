import * as THREE from "three";

/**
 * Cinematic WebGL vault field — particle hologram + orbital seals + star dust.
 * Mood inspired by HorizonX Orvane/Halovane and ThreeUI Agent scenes.
 * Original geometry and shaders; not a copy of paid template source.
 */
export function mountOrbField(host: HTMLElement) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03050a, 0.022);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(0, 0.15, 8.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "orb-canvas";
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x7a92a8, 0.35));
  const key = new THREE.DirectionalLight(0xffd29a, 1.35);
  key.position.set(5.5, 7, 4);
  scene.add(key);
  const cyan = new THREE.PointLight(0x4fd0ff, 2.6, 28);
  cyan.position.set(-4.2, 1.8, 3.2);
  scene.add(cyan);
  const ember = new THREE.PointLight(0xff9a4a, 1.9, 18);
  ember.position.set(2.8, -0.4, 2.2);
  scene.add(ember);
  const rim = new THREE.PointLight(0x8ad4ff, 1.1, 20);
  rim.position.set(0, -2.5, -3);
  scene.add(rim);

  // Distant star dust
  const STAR = 2200;
  const starPos = new Float32Array(STAR * 3);
  for (let i = 0; i < STAR; i++) {
    const r = 18 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) * 0.7;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({
      color: 0xc8e4ff,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  scene.add(stars);

  // Hologram particle shell with custom shader
  const COUNT = 18000;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3);
  const cA = new THREE.Color(0x7ad8ff);
  const cB = new THREE.Color(0xe8b86a);
  const cC = new THREE.Color(0xffffff);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const layer = Math.random();
    const r = layer < 0.72 ? 1.55 + (Math.random() - 0.5) * 0.28 : 2.05 + Math.random() * 0.55;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.92;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    seeds[i] = Math.random() * Math.PI * 2;
    const mix = layer < 0.55 ? cA.clone().lerp(cC, Math.random() * 0.35) : cB.clone().lerp(cA, Math.random() * 0.4);
    colors[i * 3] = mix.r;
    colors[i * 3 + 1] = mix.g;
    colors[i * 3 + 2] = mix.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const cloud = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      size: 0.022,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    }),
  );
  scene.add(cloud);

  // Inner crystalline core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 2),
    new THREE.MeshStandardMaterial({
      color: 0x121c28,
      metalness: 0.92,
      roughness: 0.18,
      emissive: 0x0c3a55,
      emissiveIntensity: 1.05,
    }),
  );
  scene.add(core);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.56, 1)),
    new THREE.LineBasicMaterial({ color: 0x6ad4ff, transparent: true, opacity: 0.42 }),
  );
  scene.add(wire);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.72, 2),
    new THREE.MeshBasicMaterial({
      color: 0x4fd0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
    }),
  );
  scene.add(shell);

  // Orbital rings
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05 + i * 0.36, 0.01 + (i % 2) * 0.006, 12, 180),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x4fd0ff : 0xe8b86a,
        metalness: 0.96,
        roughness: 0.18,
        emissive: i % 2 === 0 ? 0x123848 : 0x3a2810,
        emissiveIntensity: 0.55,
      }),
    );
    ring.rotation.x = Math.PI / 2.35 + i * 0.16;
    ring.rotation.y = i * 0.38;
    scene.add(ring);
    rings.push(ring);
  }

  // Soft floor glow disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 72),
    new THREE.MeshBasicMaterial({
      color: 0x0a1828,
      transparent: true,
      opacity: 0.5,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.95;
  scene.add(disc);

  // Vertical seal beams
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x4fd0ff,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 7.5, 8, 1, true), beamMat);
    const a = (i / 3) * Math.PI * 2;
    beam.position.set(Math.cos(a) * 3.4, 0.2, Math.sin(a) * 3.4);
    scene.add(beam);
  }

  let raf = 0;
  let mx = 0;
  let my = 0;
  let energy = 0;
  let targetEnergy = 0;

  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / window.innerWidth) * 2 - 1;
    my = -((e.clientY / window.innerHeight) * 2 - 1);
    targetEnergy = Math.min(1, targetEnergy + 0.04);
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener("resize", resize);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const tick = (t: number) => {
    const sec = t * 0.001;
    energy += (targetEnergy - energy) * 0.08;
    targetEnergy *= 0.97;

    if (!reduced) {
      const pos = pGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        const s = seeds[i];
        const breathe = 1 + Math.sin(sec * 1.15 + s) * 0.045 + energy * 0.1;
        const ix = i * 3;
        const scatter = 1 + energy * (0.12 + (s % 1) * 0.4);
        pos.setXYZ(
          i,
          positions[ix] * breathe * scatter,
          positions[ix + 1] * breathe * scatter,
          positions[ix + 2] * breathe * scatter,
        );
      }
      pos.needsUpdate = true;

      cloud.rotation.y = sec * 0.07 + mx * 0.18;
      cloud.rotation.x = my * 0.1;
      shell.rotation.y = -sec * 0.04;
      shell.rotation.z = sec * 0.02;
      core.rotation.y = -sec * 0.38;
      core.rotation.z = sec * 0.14;
      wire.rotation.copy(core.rotation);
      rings.forEach((r, i) => {
        r.rotation.z = sec * (0.1 + i * 0.028) * (i % 2 === 0 ? 1 : -1);
        r.rotation.y = sec * 0.045 * (i + 1);
      });
      stars.rotation.y = sec * 0.012;

      cyan.intensity = 2.2 + Math.sin(sec * 2.2) * 0.4 + energy * 1.4;
      ember.intensity = 1.5 + Math.sin(sec * 1.6) * 0.35 + energy * 0.6;
      rim.intensity = 0.9 + Math.sin(sec * 0.9) * 0.25;

      camera.position.x += (mx * 1.1 - camera.position.x) * 0.04;
      camera.position.y += (0.15 + my * 0.4 - camera.position.y) * 0.04;
      camera.position.z = 8.2 - energy * 0.45;
    }

    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pulse() {
      energy = 1;
      targetEnergy = 1;
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
