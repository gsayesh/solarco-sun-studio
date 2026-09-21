/**
 * THE SOLAR CO / Living architecture study.
 * Original procedural architecture, materials, landscaping and interaction code.
 * Three.js 0.180.0 is self-hosted under MIT; see assets/vendor/THREE-SOURCE.md.
 * No model, image texture, HDRI, paid resource or competitor asset is loaded.
 * This is a conceptual illustration, not a product specification or savings model.
 */
import * as THREE from "./assets/vendor/three.module.min.js";

const mount = document.getElementById("solar-stage");
if (mount) {
  try {
    initSolarScene(mount);
  } catch (error) {
    const message =
      "Interactive model unavailable. The architectural illustration remains available.";
    mount.classList.add("scene-unavailable");
    const fallback = mount.querySelector(".scene-fallback");
    if (fallback) {
      fallback.style.opacity = "1";
      fallback.removeAttribute("aria-hidden");
    }
    const status = document.getElementById("scene-status");
    if (status) status.textContent = message;
    window.dispatchEvent(
      new CustomEvent("solar:error", { detail: { message } }),
    );
    console.warn("Solar architectural scene could not initialise.", error);
  }
}

function initSolarScene(stage) {
  const fallback = stage.querySelector(".scene-fallback");
  const status = document.getElementById("scene-status");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => motionQuery.matches;
  const mobileTier =
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700;
  let renderer;
  let disposed = false;
  let ready = false;
  let frame = 0;
  let visible = true;
  let lastTime = 0;
  let elapsed = 0;
  let animateUntil = 0;
  let dragging = false;
  let pointer = null;
  let dirty = true;
  const cleanups = [];
  const textures = [];
  const state = { hour: 12, battery: true, exploded: false };
  const eased = { hour: 12, battery: 1, explode: 0 };
  const orbit = { azimuth: 0.64, elevation: 0.5, radius: 23 };
  const desired = { ...orbit };
  const initialAzimuth = reducedMotion() ? orbit.azimuth : orbit.azimuth - 0.18;
  orbit.azimuth = initialAzimuth;
  const on = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    cleanups.push(() => target.removeEventListener(type, callback, options));
  };
  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
  } catch (error) {
    reportError(
      "Interactive model unavailable. The architectural illustration remains available.",
    );
    return;
  }
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, mobileTier ? 1.5 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.className = "solar-webgl-canvas";
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive architectural model of a solar home. Drag left or right to rotate; use the nearby controls to explore daylight and battery storage.",
  );
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-description",
    "Use arrow keys to rotate the model, or Home to reset the view.",
  );
  renderer.domElement.setAttribute(
    "aria-keyshortcuts",
    "ArrowLeft ArrowRight ArrowUp ArrowDown Home",
  );
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;outline-offset:-6px;touch-action:pan-y;cursor:grab;opacity:0;transition:opacity .55s ease;";
  stage.appendChild(renderer.domElement);
  if (getComputedStyle(stage).position === "static")
    stage.style.position = "relative";

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-9, 9, 7, -7, 0.1, 100);
  const target = new THREE.Vector3(0, 1.15, 0);
  const architecture = new THREE.Group();
  scene.add(architecture);
  const materials = {};
  const rough = (key, color, extra = {}) =>
    (materials[key] = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0,
      ...extra,
    }));
  const M = {
    plaster: rough("plaster", "#f8f7f1", { roughness: 0.92 }),
    plasterShade: rough("plasterShade", "#eeede5", { roughness: 0.95 }),
    concrete: rough("concrete", "#e7e5dc", { roughness: 0.95 }),
    plinth: rough("plinth", "#f5f2e9", { roughness: 0.9 }),
    metal: rough("metal", "#2d3f51", { roughness: 0.43, metalness: 0.45 }),
    frame: rough("frame", "#34444c", { roughness: 0.48, metalness: 0.34 }),
    roof: rough("roof", "#374956", { roughness: 0.7, metalness: 0.4 }),
    panelEdge: rough("panelEdge", "#819095", {
      roughness: 0.35,
      metalness: 0.72,
    }),
    timber: rough("timber", "#bd956d", { roughness: 0.7 }),
    oak: rough("oak", "#d0b797", { roughness: 0.84 }),
    cushion: rough("cushion", "#e5dfd1", { roughness: 0.95 }),
    cushionDark: rough("cushionDark", "#aca897", { roughness: 0.92 }),
    gravel: rough("gravel", "#d9d6c6", { roughness: 1 }),
    soil: rough("soil", "#aaa892", { roughness: 1 }),
    lawn: rough("lawn", "#a6ae92", { roughness: 1 }),
    bark: rough("bark", "#8c816b", { roughness: 1 }),
    leaf: rough("leaf", "#8a9a78", { roughness: 0.96 }),
    terracotta: rough("terracotta", "#be9b79", { roughness: 0.98 }),
  };
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#b5c8cc",
    metalness: 0.08,
    roughness: 0.12,
    transparent: true,
    opacity: 0.27,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
  });
  const warmGlass = new THREE.MeshStandardMaterial({
    color: "#f4d8a8",
    transparent: true,
    opacity: 0,
    emissive: "#ffc680",
    emissiveIntensity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: "#f7874c",
    emissive: "#f7874c",
    emissiveIntensity: 0.8,
    roughness: 0.6,
  });
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: "#efae6b",
    emissive: "#eda35a",
    emissiveIntensity: 0.35,
    roughness: 0.7,
    transparent: true,
    opacity: 0.85,
  });

  const box = (
    w,
    h,
    d,
    x,
    y,
    z,
    material,
    parent = architecture,
    cast = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (
    rt,
    rb,
    h,
    x,
    y,
    z,
    material,
    parent = architecture,
    segments = 20,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, segments),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const roundedShape = (w, h, r) => {
    const s = new THREE.Shape(),
      x = -w / 2,
      y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const roundedSolid = (w, h, d, r, material, parent = architecture) => {
    const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
      depth: d,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      curveSegments: 8,
    });
    geo.translate(0, 0, -d / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const random = (() => {
    let seed = 4781;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  })();

  // Subtle, generated material grain. All textures originate in this module.
  function grainTexture(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const n =
          kind === "timber"
            ? 190 +
              Math.sin(x * 0.45 + Math.sin(y * 0.04) * 2) * 12 +
              random() * 14
            : 215 + random() * 30;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(kind === "timber" ? 1 : 4, kind === "timber" ? 2 : 4);
    textures.push(t);
    return t;
  }
  M.plaster.bumpMap = grainTexture("plaster");
  M.plaster.bumpScale = 0.018;
  M.concrete.bumpMap = M.plaster.bumpMap;
  M.concrete.bumpScale = 0.02;
  M.timber.bumpMap = grainTexture("timber");
  M.timber.bumpScale = 0.025;
  M.oak.bumpMap = M.timber.bumpMap;
  M.oak.bumpScale = 0.015;
  M.gravel.bumpMap = M.plaster.bumpMap;
  M.gravel.bumpScale = 0.07;

  // Lighting stays bright at every time. Evening is a warm architectural study,
  // rather than a dark theme. Directional light drives real model shadows.
  const hemisphere = new THREE.HemisphereLight("#f9fbff", "#d9d3bf", 2.1);
  scene.add(hemisphere);
  const ambient = new THREE.AmbientLight("#ffffff", 0.38);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff3dc", 3.0);
  sun.position.set(-5, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobileTier ? 1024 : 2048, mobileTier ? 1024 : 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00018;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d9e8ee", 1.0);
  fill.position.set(9, 6, -6);
  scene.add(fill);
  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ color: "#67705d", opacity: 0.12 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.33;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // A precise, chamfered site plinth keeps the architecture grounded.
  const plinth = roundedSolid(14.1, 11.0, 0.26, 0.3, M.plinth);
  plinth.rotation.x = -Math.PI / 2;
  plinth.position.set(0, -0.12, 0.05);
  const plantingBase = roundedSolid(2.0, 6.85, 0.035, 0.28, M.gravel);
  plantingBase.rotation.x = -Math.PI / 2;
  plantingBase.position.set(-5.57, 0.028, -0.6);
  const plantingRight = roundedSolid(1.55, 5.45, 0.036, 0.22, M.gravel);
  plantingRight.rotation.x = -Math.PI / 2;
  plantingRight.position.set(5.65, 0.028, -0.95);
  box(8.5, 0.14, 5.45, 0, 0.2, 0, M.concrete);
  box(8.15, 0.035, 5.2, 0, 0.294, 0, M.oak);

  // Main envelope uses real window/door openings with extruded reveals.
  function wallWithOpenings(width, height, openings, material = M.plaster) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0.3);
    shape.lineTo(width / 2, 0.3);
    shape.lineTo(width / 2, height);
    shape.lineTo(-width / 2, height);
    shape.closePath();
    for (const [x, y, w, h] of openings) {
      const hole = new THREE.Path();
      hole.moveTo(x - w / 2, y);
      hole.lineTo(x - w / 2, y + h);
      hole.lineTo(x + w / 2, y + h);
      hole.lineTo(x + w / 2, y);
      hole.closePath();
      shape.holes.push(hole);
    }
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.23, bevelEnabled: false }),
      material,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    architecture.add(mesh);
    return mesh;
  }
  const front = wallWithOpenings(8.4, 3.28, [
    [-2.45, 0.73, 2.5, 2.2],
    [1.8, 0.31, 3.25, 2.62],
  ]);
  front.position.z = 2.6;
  const back = wallWithOpenings(8.4, 3.28, [
    [-2.0, 1.25, 1.6, 1.25],
    [1.9, 1.25, 1.7, 1.25],
  ]);
  back.position.z = -2.83;
  const right = wallWithOpenings(5.2, 3.28, [[-0.45, 0.82, 1.8, 1.95]]);
  right.rotation.y = Math.PI / 2;
  right.position.x = 4.2;
  const left = wallWithOpenings(5.2, 3.28, [[-0.25, 0.85, 1.8, 1.9]]);
  left.rotation.y = Math.PI / 2;
  left.position.x = -4.43;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.83, 3.28);
  gableShape.lineTo(0, 4.58);
  gableShape.lineTo(2.83, 3.28);
  gableShape.closePath();
  for (const x of [-4.2, 4.2]) {
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gableShape, {
        depth: 0.16,
        bevelEnabled: false,
      }),
      M.plaster,
    );
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = x;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    architecture.add(mesh);
  }
  // Timber infill, narrow vertical battens, and a deeply recessed front door.
  box(1.16, 2.93, 0.085, -0.46, 1.765, 2.86, M.timber);
  const battenMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.028, 2.9, 0.02),
    M.oak,
    15,
  );
  const transform = new THREE.Object3D();
  for (let i = 0; i < 15; i++) {
    transform.position.set(-1.0 + i * 0.077, 1.765, 2.913);
    transform.updateMatrix();
    battenMesh.setMatrixAt(i, transform.matrix);
  }
  battenMesh.castShadow = true;
  battenMesh.receiveShadow = true;
  architecture.add(battenMesh);

  const windows = [];
  function glazing(w, h, x, y, z, parent = architecture, panes = 2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
    group.add(pane);
    const evening = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.1, h - 0.1),
      warmGlass,
    );
    evening.position.z = -0.035;
    group.add(evening);
    windows.push(evening);
    for (const sign of [-1, 1]) {
      box(w + 0.1, 0.055, 0.14, 0, (sign * h) / 2, 0, M.frame, group);
      box(0.06, h, 0.14, (sign * w) / 2, 0, 0, M.frame, group);
    }
    for (let i = 1; i < panes; i++)
      box(0.045, h, 0.13, -w / 2 + (w * i) / panes, 0, 0, M.frame, group);
    box(w + 0.19, 0.07, 0.24, 0, -h / 2 - 0.04, 0.01, M.concrete, group);
    return group;
  }
  glazing(2.49, 2.19, -2.45, 1.825, 2.735, architecture, 3);
  glazing(3.24, 2.61, 1.8, 1.615, 2.735, architecture, 3);
  const sideWindow = glazing(1.79, 1.94, 4.31, 1.79, 0.45, architecture, 2);
  sideWindow.rotation.y = Math.PI / 2;
  const westWindow = glazing(1.79, 1.89, -4.32, 1.795, 0.25, architecture, 2);
  westWindow.rotation.y = -Math.PI / 2;
  for (const x of [-2, 1.9]) {
    const w = glazing(
      x < 0 ? 1.59 : 1.69,
      1.24,
      x,
      1.875,
      -2.72,
      architecture,
      2,
    );
    w.rotation.y = Math.PI;
  }
  // Handles have actual depth, visible at close inspection.
  box(0.025, 0.23, 0.045, 1.3, 1.5, 2.84, M.frame);
  box(0.025, 0.23, 0.045, 2.27, 1.5, 2.84, M.frame);

  // Interior is intentionally modelled: glazing reveals furnished living spaces.
  box(2.15, 0.25, 0.86, -2.5, 0.55, 1.3, M.cushion);
  box(2.15, 0.62, 0.17, -2.5, 0.83, 0.89, M.cushion);
  for (const x of [-3.47, -1.53])
    box(0.18, 0.53, 0.85, x, 0.74, 1.3, M.cushion);
  for (const x of [-3.02, -2.03]) {
    const c = box(0.89, 0.14, 0.68, x, 0.72, 1.32, M.cushion);
    c.rotation.x = -0.035;
  }
  const pillow = box(0.43, 0.39, 0.13, -2.9, 1.03, 1.06, M.cushionDark);
  pillow.rotation.z = 0.14;
  cylinder(0.44, 0.44, 0.07, -2.5, 0.55, 2.15, M.oak);
  cylinder(0.09, 0.13, 0.23, -2.5, 0.4, 2.15, M.frame);
  box(2.65, 0.016, 1.95, -2.5, 0.321, 1.45, M.cushionDark, architecture, false);
  const diningTop = roundedSolid(1.72, 1.04, 0.07, 0.33, M.oak);
  diningTop.rotation.x = -Math.PI / 2;
  diningTop.position.set(1.7, 1.0, 0.85);
  for (const x of [1.05, 2.35])
    for (const z of [0.48, 1.23]) box(0.045, 0.69, 0.045, x, 0.63, z, M.frame);
  for (const x of [0.62, 2.78]) {
    box(0.47, 0.07, 0.48, x, 0.7, 0.85, M.cushion);
    box(0.06, 0.55, 0.49, x + (x < 1 ? -0.22 : 0.22), 0.95, 0.85, M.cushion);
    for (const z of [0.67, 1.03]) box(0.035, 0.38, 0.035, x, 0.48, z, M.frame);
  }
  cylinder(0.19, 0.28, 0.23, 1.7, 2.84, 0.85, M.oak);
  cylinder(0.008, 0.008, 0.28, 1.7, 3.095, 0.85, M.frame, architecture, 6);
  box(5.3, 0.87, 0.63, -0.2, 0.75, -2.19, M.plasterShade);
  box(5.4, 0.07, 0.68, -0.2, 1.22, -2.17, M.concrete);
  for (const x of [-2.1, -1.25, -0.4, 0.45, 1.3, 2.15])
    box(0.012, 0.77, 0.012, x, 0.77, -1.862, M.frame, architecture, false);
  const interiorLights = [
    new THREE.PointLight("#ffd6a0", 0, 6, 1.4),
    new THREE.PointLight("#ffd6a0", 0, 5, 1.4),
  ];
  interiorLights[0].position.set(-2.2, 2.2, 0.8);
  interiorLights[1].position.set(1.5, 2.3, 1);
  interiorLights.forEach((l) => scene.add(l));

  // Gable roof: slate standing seam, raised rails, individual framed PV modules.
  const roofAssembly = new THREE.Group();
  architecture.add(roofAssembly);
  const southRoof = new THREE.Group();
  southRoof.position.set(0, 3.87, 1.56);
  southRoof.rotation.x = 0.43;
  const northRoof = new THREE.Group();
  northRoof.position.set(0, 3.87, -1.56);
  northRoof.rotation.x = -0.43;
  roofAssembly.add(southRoof, northRoof);
  const slopeLength = 3.43;
  for (const roof of [southRoof, northRoof]) {
    box(9.25, 0.13, slopeLength, 0, 0, 0, M.roof, roof);
    for (let i = 0; i < 24; i++)
      box(0.018, 0.028, slopeLength, -4.5 + i * 0.39, 0.077, 0, M.metal, roof);
    box(
      9.34,
      0.13,
      0.105,
      0,
      -0.005,
      roof === southRoof ? 1.715 : -1.715,
      M.frame,
      roof,
    );
  }
  box(9.34, 0.08, 0.14, 0, 4.594, 0, M.metal, roofAssembly);
  // Rainwater downpipe and shoe, consistently scaled architectural details.
  cylinder(0.028, 0.028, 2.9, 4.15, 1.72, 3.05, M.frame, architecture, 10);
  box(0.055, 0.055, 0.28, 4.15, 0.3, 3.15, M.frame);

  function cellTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 640;
    const c = canvas.getContext("2d");
    c.fillStyle = "#122938";
    c.fillRect(0, 0, 512, 640);
    const gap = 4,
      cols = 6,
      rows = 10,
      cw = 512 / cols,
      ch = 640 / rows;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const g = c.createLinearGradient(
          x * cw,
          y * ch,
          (x + 1) * cw,
          (y + 1) * ch,
        );
        const n = Math.round(random() * 6);
        g.addColorStop(0, `rgb(${30 + n},${54 + n},${70 + n})`);
        g.addColorStop(1, `rgb(${16 + n},${36 + n},${54 + n})`);
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(x * cw + gap / 2, y * ch + gap / 2, cw - gap, ch - gap, 3);
        c.fill();
        c.strokeStyle = "rgba(167,188,193,.18)";
        c.lineWidth = 0.6;
        for (let line = 1; line < 10; line++) {
          c.beginPath();
          c.moveTo(x * cw + gap, y * ch + (line * ch) / 10);
          c.lineTo((x + 1) * cw - gap, y * ch + (line * ch) / 10);
          c.stroke();
        }
        c.strokeStyle = "rgba(200,208,207,.40)";
        c.lineWidth = 0.8;
        for (const fraction of [0.28, 0.72]) {
          c.beginPath();
          c.moveTo(x * cw + fraction * cw, y * ch + gap);
          c.lineTo(x * cw + fraction * cw, (y + 1) * ch - gap);
          c.stroke();
        }
      }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(t);
    return t;
  }
  const photovoltaic = new THREE.MeshPhysicalMaterial({
    map: cellTexture(),
    roughness: 0.25,
    metalness: 0.27,
    clearcoat: 0.62,
    clearcoatRoughness: 0.16,
  });
  const solarPanels = new THREE.Group();
  southRoof.add(solarPanels);
  const panelGeometry = new THREE.PlaneGeometry(1.225, 1.435);
  for (const z of [-0.78, 0.78]) {
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 1.355;
      box(1.29, 0.065, 1.5, x, 0.155, z, M.panelEdge, solarPanels);
      const pane = new THREE.Mesh(panelGeometry, photovoltaic);
      pane.rotation.x = -Math.PI / 2;
      pane.position.set(x, 0.19, z);
      pane.receiveShadow = true;
      solarPanels.add(pane);
      for (const side of [-1, 1])
        box(
          0.065,
          0.045,
          0.09,
          x + side * 0.652,
          0.174,
          z,
          M.frame,
          solarPanels,
        );
    }
  }

  // Terrace timber uses one instanced draw call, avoiding dozens of expensive meshes.
  const terrace = new THREE.InstancedMesh(
    new THREE.BoxGeometry(9.4, 0.105, 0.13),
    M.oak,
    16,
  );
  for (let i = 0; i < 16; i++) {
    transform.position.set(-0.1, 0.19, 2.93 + i * 0.141);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    terrace.setMatrixAt(i, transform.matrix);
  }
  terrace.castShadow = true;
  terrace.receiveShadow = true;
  architecture.add(terrace);
  box(2.35, 0.105, 0.46, 2.1, 0.078, 5.1, M.concrete);
  for (let i = 0; i < 5; i++)
    box(0.64, 0.048, 0.83, 4.83 + i * 0.3, 0.041, 4.18 - i * 0.69, M.concrete);
  // Quiet outdoor furniture, with independent seat/leg geometry.
  function lounge(x, z, rotation) {
    const g = new THREE.Group();
    g.position.set(x, 0.23, z);
    g.rotation.y = rotation;
    architecture.add(g);
    box(0.65, 0.11, 0.67, 0, 0.45, 0, M.cushion, g);
    const backrest = box(0.65, 0.52, 0.085, 0, 0.73, -0.3, M.cushion, g);
    backrest.rotation.x = -0.15;
    for (const xx of [-0.27, 0.27])
      for (const zz of [-0.26, 0.26])
        box(0.035, 0.43, 0.035, xx, 0.22, zz, M.frame, g);
    for (const xx of [-0.35, 0.35])
      box(0.055, 0.07, 0.66, xx, 0.65, 0, M.oak, g);
  }
  lounge(-2.9, 4.0, -0.15);
  lounge(-1.4, 4.05, 0.15);
  cylinder(0.32, 0.32, 0.055, -2.15, 0.65, 4.2, M.concrete);
  cylinder(0.065, 0.1, 0.36, -2.15, 0.445, 4.2, M.frame);
  cylinder(0.045, 0.035, 0.1, -2.15, 0.725, 4.2, M.terracotta);

  // Unbranded battery and inverter: design concepts, not manufacturer products.
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(4.47, 1.5, -1.55);
  batteryGroup.rotation.y = Math.PI / 2;
  architecture.add(batteryGroup);
  const batteryCase = roundedSolid(
    0.89,
    1.44,
    0.23,
    0.1,
    M.plaster,
    batteryGroup,
  );
  batteryCase.position.z = 0.12;
  const batterySeam = roundedSolid(
    0.77,
    1.29,
    0.01,
    0.065,
    M.plasterShade,
    batteryGroup,
  );
  batterySeam.position.z = 0.243;
  const batteryFront = roundedSolid(
    0.75,
    1.26,
    0.014,
    0.06,
    M.plaster,
    batteryGroup,
  );
  batteryFront.position.z = 0.252;
  box(0.17, 0.024, 0.015, 0, 0.45, 0.268, glow, batteryGroup, false);
  box(0.25, 0.01, 0.015, 0, -0.51, 0.268, M.plasterShade, batteryGroup, false);
  for (let i = 0; i < 4; i++)
    box(
      0.012,
      0.013,
      0.1,
      0.443,
      -0.39 + i * 0.047,
      0.11,
      M.frame,
      batteryGroup,
      false,
    );
  const inverter = roundedSolid(0.37, 0.6, 0.13, 0.05, M.metal);
  inverter.rotation.y = Math.PI / 2;
  inverter.position.set(4.45, 1.74, -0.58);
  box(0.015, 0.025, 0.09, 4.53, 1.91, -0.58, glow);
  // Exterior conduit is explicit and thin, not a decorative magic energy beam.
  const conduitCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(4.5, 1.39, -0.58),
      new THREE.Vector3(4.53, 0.53, -0.58),
      new THREE.Vector3(4.56, 0.44, -0.88),
      new THREE.Vector3(4.56, 0.44, -1.55),
      new THREE.Vector3(4.55, 0.86, -1.55),
    ],
    false,
    "centripetal",
  );
  const conduit = new THREE.Mesh(
    new THREE.TubeGeometry(conduitCurve, 32, 0.018, 8, false),
    M.frame,
  );
  conduit.castShadow = true;
  architecture.add(conduit);
  const flowCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(4.75, 1.23, -1.55),
      new THREE.Vector3(4.83, 0.34, -1.55),
      new THREE.Vector3(4.84, 0.29, -0.5),
      new THREE.Vector3(4.84, 0.29, 1.2),
      new THREE.Vector3(4.5, 0.29, 2.92),
      new THREE.Vector3(3.2, 0.29, 3.1),
    ],
    false,
    "centripetal",
  );
  const energyPath = new THREE.Mesh(
    new THREE.TubeGeometry(flowCurve, 60, 0.018, 7, false),
    lineMaterial,
  );
  architecture.add(energyPath);
  const pearlGeometry = new THREE.SphereGeometry(0.041, 10, 6);
  const energyPearls = Array.from({ length: 3 }, () => {
    const p = new THREE.Mesh(pearlGeometry, glow);
    architecture.add(p);
    return p;
  });

  // Original botanical geometry: fine olive leaves rather than toy-like spheres.
  function branch(a, b, r1, r2, parent) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r2, r1, direction.length(), 7),
      M.bark,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    mesh.castShadow = true;
    parent.add(mesh);
  }
  function oliveTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.04, z);
    tree.scale.setScalar(scale);
    architecture.add(tree);
    branch(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.05, 2.2, 0.04),
      0.075,
      0.027,
      tree,
    );
    const ends = [];
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4,
        start = new THREE.Vector3(0.03, 1.15 + random() * 0.8, 0.03);
      const end = new THREE.Vector3(
        Math.cos(angle) * (0.4 + random() * 0.43),
        2.15 + random() * 1.0,
        Math.sin(angle) * (0.4 + random() * 0.43),
      );
      branch(start, end, 0.025, 0.006, tree);
      ends.push(end);
      const fork = end
        .clone()
        .add(
          new THREE.Vector3(
            (random() - 0.5) * 0.45,
            0.2,
            (random() - 0.5) * 0.45,
          ),
        );
      branch(end.clone().lerp(start, 0.25), fork, 0.01, 0.003, tree);
      ends.push(fork);
    }
    const count = mobileTier ? 850 : 1250,
      geo = new THREE.SphereGeometry(1, 5, 3),
      leaves = new THREE.InstancedMesh(geo, M.leaf, count);
    const leafColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const centre = ends[i % ends.length],
        angle = random() * Math.PI * 2,
        vertical = random() * 2 - 1,
        radius = Math.cbrt(random()) * 0.48;
      const radial = Math.sqrt(1 - vertical * vertical);
      transform.position.set(
        centre.x + Math.cos(angle) * radial * radius,
        centre.y + vertical * radius * 0.85,
        centre.z + Math.sin(angle) * radial * radius,
      );
      transform.rotation.set(random() * 3, random() * 6, random() * 3);
      transform.scale.set(
        0.095 + random() * 0.045,
        0.014,
        0.027 + random() * 0.019,
      );
      transform.updateMatrix();
      leaves.setMatrixAt(i, transform.matrix);
      leafColor.setHSL(
        0.2 + random() * 0.04,
        0.12 + random() * 0.12,
        0.31 + random() * 0.18,
      );
      leaves.setColorAt(i, leafColor);
    }
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    tree.add(leaves);
  }
  oliveTree(-5.55, -2.85, 1.03);
  oliveTree(5.55, -3.45, 0.91);
  function ornamentalGrass(x, z, size = 1, base = 0.065) {
    const count = 80,
      vertices = [],
      normals = [];
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2,
        radius = random() * 0.2,
        h = (0.23 + random() * 0.38) * size,
        lean = 0.14 + random() * 0.23,
        width = 0.013;
      const bx = x + Math.cos(angle) * radius,
        bz = z + Math.sin(angle) * radius;
      const tipx = bx + Math.cos(angle) * lean * size,
        tipz = bz + Math.sin(angle) * lean * size;
      vertices.push(
        bx - width,
        base,
        bz,
        bx + width,
        base,
        bz,
        tipx,
        base + h,
        tipz,
      );
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    const m = new THREE.MeshStandardMaterial({
      color: "#979e7c",
      side: THREE.DoubleSide,
      roughness: 1,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    architecture.add(mesh);
  }
  for (const [x, z, s] of [
    [-5.6, 1.0, 1],
    [-5.45, 2.5, 0.85],
    [-5.85, -0.3, 0.75],
    [5.6, -1.8, 0.8],
    [5.8, 0.2, 0.9],
    [5.5, 1.45, 0.75],
    [-4.9, -4.2, 0.8],
  ])
    ornamentalGrass(x, z, s);
  for (const [x, z] of [
    [-5.4, 3.8],
    [4.9, 3.4],
  ]) {
    cylinder(0.21, 0.16, 0.4, x, 0.25, z, M.terracotta);
    ornamentalGrass(x, z, 0.7, 0.45);
  }

  // Exploded view draws construction guide lines; normal mode hides them.
  const explodeGuides = new THREE.Group();
  architecture.add(explodeGuides);
  const guideMaterial = new THREE.LineDashedMaterial({
    color: "#c2b69c",
    dashSize: 0.09,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.6,
  });
  for (const x of [-4.4, 4.4])
    for (const z of [-2.8, 2.8]) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 3.3, z),
        new THREE.Vector3(x, 4.65, z),
      ]);
      const l = new THREE.Line(g, guideMaterial);
      l.computeLineDistances();
      explodeGuides.add(l);
    }
  explodeGuides.visible = false;

  const duskColour = new THREE.Color("#ffd29a"),
    daylightColour = new THREE.Color("#fff3dc");
  function updateLighting() {
    const daylight = Math.max(0, Math.sin(((eased.hour - 6) / 14) * Math.PI));
    const evening = THREE.MathUtils.smoothstep(eased.hour, 16.5, 19.5);
    const morning = 1 - THREE.MathUtils.smoothstep(eased.hour, 6, 9);
    const angle = ((eased.hour - 6) / 14) * Math.PI;
    // At the ends of the illustrative day, retain a high architectural key
    // light rather than projecting a horizon-length shadow across the UI.
    // The central daylight range (and its captured default view) is unchanged.
    sun.position.set(
      -Math.cos(angle) * 11,
      Math.max(7.5, 4 + daylight * 10),
      7 - Math.sin(angle) * 1.5,
    );
    const groundShadowVisibility = THREE.MathUtils.smoothstep(
      daylight,
      0.55,
      0.85,
    );
    shadowFloor.material.opacity = 0.12 * groundShadowVisibility;
    shadowFloor.visible = groundShadowVisibility > 0.005;
    sun.intensity = 1.45 + daylight * 1.65;
    sun.color
      .copy(daylightColour)
      .lerp(duskColour, Math.max(morning, evening) * 0.75);
    hemisphere.intensity = 1.85 + daylight * 0.3;
    fill.intensity = 0.9;
    warmGlass.opacity = evening * 0.56;
    warmGlass.emissiveIntensity = 0.65;
    glass.opacity = 0.27 - evening * 0.13;
    interiorLights.forEach((l) => (l.intensity = evening * 7.0));
    glow.emissiveIntensity = 0.55 + evening * 1.1;
    energyPath.visible = eased.battery > 0.02;
    energyPath.material.opacity = eased.battery * (0.52 + evening * 0.45);
    batteryGroup.scale.setScalar(Math.max(0.001, eased.battery));
    batteryGroup.visible = eased.battery > 0.015;
    conduit.visible = eased.battery > 0.015;
    roofAssembly.position.y = eased.explode * 1.15;
    solarPanels.position.y = eased.explode * 0.42;
    explodeGuides.visible = eased.explode > 0.1;
    camera.zoom = 1 - eased.explode * 0.09;
    camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }
  function updateCamera() {
    const horizontal = Math.cos(orbit.elevation) * orbit.radius;
    camera.position.set(
      Math.sin(orbit.azimuth) * horizontal,
      Math.sin(orbit.elevation) * orbit.radius + target.y,
      Math.cos(orbit.azimuth) * horizontal,
    );
    camera.lookAt(target);
  }
  function resize() {
    if (disposed) return;
    const rect = stage.getBoundingClientRect(),
      w = Math.max(1, rect.width),
      h = Math.max(1, rect.height),
      aspect = w / h;
    renderer.setSize(w, h, false);
    const vertical = Math.max(11.9, 17.0 / aspect);
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    requestRender(150);
  }
  function requestRender(duration = 1000) {
    if (disposed) return;
    dirty = true;
    animateUntil = Math.max(animateUntil, performance.now() + duration);
    if (!frame && visible && !document.hidden)
      frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    elapsed += dt;
    const speed = reducedMotion() ? 1 : 1 - Math.exp(-dt * 5.2);
    const beforeHour = eased.hour,
      beforeBattery = eased.battery,
      beforeExplode = eased.explode;
    eased.hour = THREE.MathUtils.lerp(eased.hour, state.hour, speed);
    eased.battery = THREE.MathUtils.lerp(
      eased.battery,
      state.battery ? 1 : 0,
      speed,
    );
    eased.explode = THREE.MathUtils.lerp(
      eased.explode,
      state.exploded ? 1 : 0,
      speed,
    );
    orbit.azimuth = THREE.MathUtils.lerp(orbit.azimuth, desired.azimuth, speed);
    orbit.elevation = THREE.MathUtils.lerp(
      orbit.elevation,
      desired.elevation,
      speed,
    );
    const changed =
      Math.abs(beforeHour - eased.hour) +
        Math.abs(beforeBattery - eased.battery) +
        Math.abs(beforeExplode - eased.explode) >
      0.0001;
    if (changed || dirty) updateLighting();
    updateCamera();
    const evening = eased.hour > 17;
    energyPearls.forEach((p, i) => {
      p.visible = eased.battery > 0.4;
      const progress = reducedMotion() ? i / 3 : (elapsed * 0.1 + i / 3) % 1;
      p.position.copy(flowCurve.getPointAt(evening ? progress : 1 - progress));
    });
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      renderer.domElement.style.opacity = "1";
      stage.classList.add("scene-ready");
      if (fallback) {
        fallback.style.opacity = "0";
        fallback.style.pointerEvents = "none";
        fallback.setAttribute("aria-hidden", "true");
      }
      if (status)
        status.textContent = "Interactive model ready. Drag to explore.";
      emit("solar:ready", {
        webgl: true,
        conceptual: true,
        version: "0.180.0",
      });
    }
    dirty = false;
    // A finite introduction/interaction animation avoids a permanent render loop.
    // Flow pearls settle after interaction; reduced motion renders static states.
    if (!reducedMotion() && (dragging || time < animateUntil))
      frame = requestAnimationFrame(render);
  }
  function applyState(change) {
    Object.assign(state, change);
    if (reducedMotion()) {
      eased.hour = state.hour;
      eased.battery = state.battery ? 1 : 0;
      eased.explode = state.exploded ? 1 : 0;
    }
    requestRender(reducedMotion() ? 0 : 2600);
  }
  function reportError(message) {
    if (status) status.textContent = message;
    stage.classList.add("scene-unavailable");
    if (fallback) {
      fallback.style.opacity = "1";
      fallback.removeAttribute("aria-hidden");
    }
    emit("solar:error", { message });
  }
  function resetView() {
    desired.azimuth = 0.64;
    desired.elevation = 0.5;
    if (reducedMotion()) {
      orbit.azimuth = desired.azimuth;
      orbit.elevation = desired.elevation;
    }
    requestRender(1800);
  }

  on(renderer.domElement, "keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      resetView();
      return;
    }
    if (event.key === "ArrowLeft") desired.azimuth -= 0.12;
    if (event.key === "ArrowRight") desired.azimuth += 0.12;
    if (event.key === "ArrowUp")
      desired.elevation = Math.min(0.92, desired.elevation + 0.07);
    if (event.key === "ArrowDown")
      desired.elevation = Math.max(0.24, desired.elevation - 0.07);
    if (reducedMotion()) {
      orbit.azimuth = desired.azimuth;
      orbit.elevation = desired.elevation;
    }
    requestRender(1400);
  });
  // Native pointer interaction keeps vertical page scrolling intact on touch.
  on(renderer.domElement, "pointerdown", (e) => {
    if (e.button !== 0) return;
    pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      type: e.pointerType,
      locked: e.pointerType !== "touch",
    };
    if (pointer.locked) {
      dragging = true;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    }
    requestRender(1000);
  });
  on(renderer.domElement, "pointermove", (e) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.lastX,
      dy = e.clientY - pointer.lastY;
    if (!pointer.locked) {
      const totalX = Math.abs(e.clientX - pointer.x),
        totalY = Math.abs(e.clientY - pointer.y);
      if (totalY > totalX && totalY > 8) {
        pointer = null;
        return;
      }
      if (totalX > 8 && totalX > totalY) {
        pointer.locked = true;
        dragging = true;
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    }
    if (pointer.locked) {
      desired.azimuth -= dx * 0.006;
      desired.elevation = THREE.MathUtils.clamp(
        desired.elevation + dy * 0.0035,
        0.24,
        0.92,
      );
      if (reducedMotion()) {
        orbit.azimuth = desired.azimuth;
        orbit.elevation = desired.elevation;
      }
      requestRender(1000);
    }
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
  });
  const release = () => {
    pointer = null;
    dragging = false;
    renderer.domElement.style.cursor = "grab";
    requestRender(1000);
  };
  on(renderer.domElement, "pointerup", release);
  on(renderer.domElement, "pointercancel", release);
  on(renderer.domElement, "lostpointercapture", release);
  on(renderer.domElement, "webglcontextlost", (event) => {
    event.preventDefault();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    reportError(
      "Interactive graphics paused. The architectural illustration is available.",
    );
  });
  on(renderer.domElement, "webglcontextrestored", () => {
    stage.classList.remove("scene-unavailable");
    ready = false;
    requestRender(1800);
  });
  on(document, "visibilitychange", () => {
    lastTime = 0;
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender(300);
  });
  on(motionQuery, "change", () => {
    if (reducedMotion()) {
      orbit.azimuth = desired.azimuth;
      orbit.elevation = desired.elevation;
      eased.hour = state.hour;
      eased.battery = state.battery ? 1 : 0;
      eased.explode = state.exploded ? 1 : 0;
    }
    requestRender(100);
  });
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      lastTime = 0;
      if (visible) requestRender(500);
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { threshold: 0.01 },
  );
  observer.observe(stage);
  cleanups.push(() => observer.disconnect());
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  cleanups.push(() => sizeObserver.disconnect());

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    cleanups.forEach((fn) => fn());
    const geometries = new Set(),
      mats = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material)
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((m) => mats.add(m));
    });
    geometries.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    if (fallback) {
      fallback.style.opacity = "1";
      fallback.removeAttribute("aria-hidden");
    }
    stage.classList.remove("scene-ready");
    delete window.solarScene;
  }
  window.solarScene = {
    setHour(hour) {
      const value = Number(hour);
      if (Number.isFinite(value))
        applyState({ hour: THREE.MathUtils.clamp(value, 6, 20) });
    },
    setBattery(value) {
      applyState({ battery: Boolean(value) });
    },
    setExploded(value) {
      applyState({ exploded: Boolean(value) });
    },
    resetView,
    captureFrame() {
      if (disposed || !ready) return null;
      // Synchronous render/capture works without retaining the drawing buffer.
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    dispose,
    getState() {
      return { ...state, ready, visible, reducedMotion: reducedMotion() };
    },
  };
  updateLighting();
  updateCamera();
  resize();
  requestRender(reducedMotion() ? 0 : 2400);
}
