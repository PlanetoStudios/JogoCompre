import * as THREE from 'three';

let renderer, scene, camera, cube, animationId;
const container = document.getElementById('obsidian3d');

function createObsidianMaterial() {
  // simple physically-plausible obsidian-like material using standard material
  return new THREE.MeshStandardMaterial({
    color: 0x0b0710,
    metalness: 0.1,
    roughness: 0.45,
    emissive: 0x0a0210,
    emissiveIntensity: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5
  });
}

function onWindowResize() {
  if (!renderer || !camera || !container) return;
  const rect = container.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(Math.max(64, Math.floor(rect.width)), Math.max(64, Math.floor(rect.height)));
}

export function initObsidianBlock() {
  if (!container) return;

  // avoid double-init
  if (renderer) return;

  const rect = container.getBoundingClientRect();
  const width = Math.max(200, Math.floor(rect.width));
  const height = Math.max(140, Math.floor(rect.height));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(1.8, 1.2, 2.6);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.physicallyCorrectLights = true;

  // remove previous canvas if any
  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(renderer.domElement);

  // lighting: soft rim and key light
  const hemi = new THREE.HemisphereLight(0x443344, 0x080810, 0.6);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 6, 2);
  dir.castShadow = false;
  scene.add(dir);

  // subtle fill
  const fill = new THREE.PointLight(0x222233, 0.4);
  fill.position.set(-2, -1, -1);
  scene.add(fill);

  // create a slightly rounded cube (box geometry)
  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  // small bevel effect by applying a subdivision-like normal perturbation (lightweight)
  const mat = createObsidianMaterial();
  cube = new THREE.Mesh(geo, mat);
  cube.rotation.set(0.3, 0.6, 0.05);
  cube.castShadow = false;
  cube.receiveShadow = false;
  scene.add(cube);

  // subtle glossy highlight via an extra dark translucent plane behind for contrast
  const baseGeo = new THREE.PlaneGeometry(6, 6);
  const baseMat = new THREE.MeshBasicMaterial({ color: 0x050407, transparent: true, opacity: 0.6 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(0, -1.8, 0);
  base.rotation.x = -Math.PI / 2;
  scene.add(base);

  // responsive listener
  window.addEventListener('resize', onWindowResize, { passive: true });
  onWindowResize();

  // animation loop: gentle rotation
  let last = performance.now();
  function animate(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (cube) {
      // rotate smoothly; clamp speed for perf
      cube.rotation.y += dt * 0.45;
      cube.rotation.x += dt * 0.12;
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }
  animationId = requestAnimationFrame(animate);
}

// cleanup helper if needed
export function disposeObsidianBlock() {
  try {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onWindowResize);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    // free references
    renderer = null;
    scene = null;
    camera = null;
    cube = null;
  } catch (_) {}
}

// auto-init when DOM ready (safe to call multiple times)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    initObsidianBlock();
  }, 50);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => initObsidianBlock(), 50));
}