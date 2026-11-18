import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const viewer = document.getElementById('glassesViewer');
if (viewer) {
  const loading = document.getElementById('glassesLoading');
  const error = document.getElementById('glassesError');
  const hint = document.getElementById('glassesHint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer, scene, camera, controls, modelPivot, frameId;
  let isRunning = false;
  let pointerInside = false;
  let interacting = false;
  let disposed = false;

  const sceneBackground = 0xe4f2f8;

  function showError() {
    loading?.classList.add('hidden');
    error?.classList.remove('hidden');
    if (hint) hint.textContent = 'Device preview unavailable';
  }

  function pageIsVisible() {
    const login = document.getElementById('loginView');
    return !document.hidden && login && !login.classList.contains('hidden');
  }

  function renderLoop() {
    if (disposed || !renderer) return;
    if (!pageIsVisible()) {
      isRunning = false;
      frameId = null;
      return;
    }
    const delta = Math.min(clock.getDelta(), 0.05);
    if (modelPivot && !pointerInside && !interacting && !reducedMotion) {
      modelPivot.rotation.y += delta * 0.22;
    }
    controls?.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(renderLoop);
  }

  function startRenderLoop() {
    if (disposed || isRunning || !modelPivot || !pageIsVisible()) return;
    isRunning = true;
    clock.getDelta();
    frameId = requestAnimationFrame(renderLoop);
  }

  const clock = new THREE.Clock();

  function initRenderer() {
    const width = Math.max(viewer.clientWidth, 1);
    const height = Math.max(viewer.clientHeight, 1);
    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(32, width / height, 0.01, 100);
    camera.position.set(0, 0.15, 5.2);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    viewer.prepend(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc3d9df, 2.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(3.5, 4.5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5efff, 1.4);
    fill.position.set(-4, 1.5, 2.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8fd5c0, 2.0);
    rim.position.set(0, 2, -4);
    scene.add(rim);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2.6;
    controls.maxDistance = 8.5;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', () => { interacting = true; });
    controls.addEventListener('end', () => {
      interacting = false;
      // A short pause after drag feels calmer before the turntable resumes.
      window.setTimeout(() => { interacting = false; }, 650);
    });

    viewer.addEventListener('pointerenter', () => { pointerInside = true; });
    viewer.addEventListener('pointerleave', () => {
      pointerInside = false;
      interacting = false;
    });
    viewer.addEventListener('pointerdown', () => { interacting = true; });
    viewer.addEventListener('pointerup', () => {
      window.setTimeout(() => { interacting = false; }, 650);
    });
  }

  function fitModel(geometry) {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scale = 2.65 / maxDimension;

    const material = new THREE.MeshStandardMaterial({
      color: 0x244b55,
      metalness: 0.42,
      roughness: 0.34
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(scale);
    mesh.rotation.x = 0;
    mesh.rotation.z = 0;

    modelPivot = new THREE.Group();
    modelPivot.add(mesh);
    scene.add(modelPivot);

    const sphere = new THREE.Sphere();
    geometry.boundingSphere?.clone().getCenter(sphere.center);
    sphere.radius = (geometry.boundingSphere?.radius || maxDimension * 0.5) * scale;
    const distance = Math.max(3.8, sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 1.12);
    camera.position.set(0, 0.12, distance);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 30;
    camera.updateProjectionMatrix();
    controls.minDistance = Math.max(2.2, sphere.radius * 1.15);
    controls.maxDistance = Math.max(7, sphere.radius * 5.5);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  try {
    initRenderer();
    const loader = new STLLoader();
    loader.load(
      new URL('./assets/models/base.stl', import.meta.url).href,
      geometry => {
        if (disposed) { geometry.dispose(); return; }
        fitModel(geometry);
        loading?.classList.add('hidden');
        if (hint) hint.textContent = reducedMotion
          ? 'Drag to rotate · Scroll to zoom'
          : 'Drag to explore · Scroll to zoom';
        startRenderLoop();
      },
      undefined,
      () => showError()
    );

    const resizeObserver = new ResizeObserver(() => {
      if (!renderer || !camera) return;
      const w = Math.max(viewer.clientWidth, 1);
      const h = Math.max(viewer.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    });
    resizeObserver.observe(viewer);

    const visibilityObserver = new MutationObserver(() => {
      startRenderLoop();
    });
    document.addEventListener('visibilitychange', startRenderLoop);

    visibilityObserver.observe(document.getElementById('loginView'), {
      attributes: true,
      attributeFilter: ['class']
    });

    window.addEventListener('pagehide', () => {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', startRenderLoop);
      controls?.dispose();
      renderer?.dispose();
      modelPivot?.traverse(object => {
        if (object.isMesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
    }, { once: true });
  } catch (err) {
    console.error('Smart Eyeglasses 3D viewer initialization failed:', err);
    showError();
  }
}
