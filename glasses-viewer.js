import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('glassesViewer');
if (canvas) {
  const stage = canvas.parentElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.15, 5.4);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9bbeb2, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc6f2e4, 1.7);
  fill.position.set(-4, 1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.0);
  rim.position.set(0, 3, -4); scene.add(rim);

  const modelPivot = new THREE.Group();
  scene.add(modelPivot);
  const loader = new STLLoader();
  loader.load('./base.stl', (geometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x244c43, metalness: 0.28, roughness: 0.3,
      clearcoat: 0.55, clearcoatRoughness: 0.25
    });
    const glasses = new THREE.Mesh(geometry, material);
    // STL is laid flat; stand it upright for a natural front-facing product view.
    glasses.rotation.x = -Math.PI / 2;
    const box = new THREE.Box3().setFromObject(glasses);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    glasses.scale.setScalar(2.65 / maxDim);
    modelPivot.add(glasses);
  }, undefined, (error) => {
    console.error('Could not load base.stl:', error);
    stage.classList.add('model-load-error');
  });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 3.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.15;
  controls.target.set(0, 0, 0);
  controls.update();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    // Auto-rotation pauses naturally while the user is dragging, then resumes.
    controls.update(delta);
    renderer.render(scene, camera);
  }
  animate();
}
