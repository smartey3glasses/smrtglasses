const viewer = document.getElementById('glassesViewer');

if (viewer) {
  const loading = document.getElementById('glassesLoading');
  const errorBox = document.getElementById('glassesError');
  const hint = document.getElementById('glassesHint');

  let renderer, scene, camera, controls, modelPivot, frameId;
  let disposed = false;
  let pointerInside = false;
  let interacting = false;
  let lastInteraction = 0;
  let resizeObserver;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = { last: 0 };

  function setError(message) {
    if (loading) loading.classList.add('hidden');
    if (errorBox) {
      errorBox.textContent = message || 'The 3D model could not be loaded. Please refresh the page.';
      errorBox.classList.remove('hidden');
    }
    if (hint) hint.textContent = 'Device preview unavailable';
    console.error('[Smart Eyeglasses viewer]', message);
  }

  function loginIsVisible() {
    const login = document.getElementById('loginView');
    return !!login && !login.classList.contains('hidden') && !document.hidden;
  }

  async function start() {
    try {
      // Dynamic imports let us show a useful error instead of leaving the loader spinning
      // forever if the CDN, import map, or browser module support is unavailable.
      const THREE = await import('three');
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

      if (disposed) return;

      const width = Math.max(viewer.clientWidth, 1);
      const height = Math.max(viewer.clientHeight, 1);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(34, width / height, 0.01, 100);
      camera.position.set(0, 0.15, 5);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      viewer.prepend(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xc3d9df, 2.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.8);
      key.position.set(3.5, 4.5, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xc5efff, 1.25);
      fill.position.set(-4, 1.5, 2.5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0x8fd5c0, 1.7);
      rim.position.set(0, 2, -4);
      scene.add(rim);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.minDistance = 2.4;
      controls.maxDistance = 8;
      controls.rotateSpeed = 0.65;
      controls.zoomSpeed = 0.75;
      controls.target.set(0, 0, 0);
      controls.addEventListener('start', () => {
        interacting = true;
        lastInteraction = performance.now();
      });
      controls.addEventListener('end', () => {
        lastInteraction = performance.now();
      });

      viewer.addEventListener('pointerenter', () => { pointerInside = true; });
      viewer.addEventListener('pointerleave', () => {
        pointerInside = false;
        lastInteraction = performance.now();
      });
      viewer.addEventListener('pointerdown', () => {
        interacting = true;
        lastInteraction = performance.now();
      });
      window.addEventListener('pointerup', () => {
        interacting = false;
        lastInteraction = performance.now();
      });

      const modelUrl = new URL('./assets/models/base.stl', document.baseURI);
      const response = await fetch(modelUrl.href, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Could not fetch base.stl (${response.status} ${response.statusText}). Check that assets/models/base.stl was deployed.`);
      }
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) throw new Error('base.stl was downloaded but is empty.');

      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      if (!geometry || !geometry.attributes || !geometry.attributes.position || !geometry.attributes.position.count) {
        throw new Error('base.stl loaded, but it does not contain usable triangle geometry.');
      }

      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const bounds = geometry.boundingBox;
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      const maxDimension = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
        throw new Error('The STL model has invalid dimensions.');
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x244b55,
        metalness: 0.32,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(2.55 / maxDimension);

      modelPivot = new THREE.Group();
      modelPivot.add(mesh);
      scene.add(modelPivot);

      // Fit the full model inside the viewer regardless of the STL's original units.
      const radius = Math.max(geometry.boundingSphere.radius * mesh.scale.x, 0.5);
      const distance = Math.max(3.8, radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.12);
      camera.position.set(0, 0.12, distance);
      camera.near = Math.max(0.01, distance / 100);
      camera.far = distance * 30;
      camera.updateProjectionMatrix();
      controls.minDistance = Math.max(2.2, radius * 1.15);
      controls.maxDistance = Math.max(7, radius * 5.5);
      controls.update();

      if (loading) loading.classList.add('hidden');
      if (hint) hint.textContent = reducedMotion
        ? 'Drag to rotate · Scroll to zoom'
        : 'Drag to explore · Scroll to zoom';

      function animate(now) {
        if (disposed) return;
        frameId = requestAnimationFrame(animate);

        if (!loginIsVisible()) {
          clock.last = now;
          return;
        }

        const delta = clock.last ? Math.min((now - clock.last) / 1000, 0.05) : 0;
        clock.last = now;

        const recentlyInteracted = now - lastInteraction < 900;
        if (modelPivot && !reducedMotion && !pointerInside && !interacting && !recentlyInteracted) {
          modelPivot.rotation.y += delta * 0.22;
        }

        controls.update();
        renderer.render(scene, camera);
      }

      frameId = requestAnimationFrame(animate);

      resizeObserver = new ResizeObserver(() => {
        if (!renderer || !camera) return;
        const w = Math.max(viewer.clientWidth, 1);
        const h = Math.max(viewer.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(viewer);

    } catch (err) {
      setError(err && err.message ? err.message : String(err));
    }
  }

  start();

  window.addEventListener('pagehide', () => {
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    controls?.dispose();
    modelPivot?.traverse(object => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    renderer?.dispose();
  }, { once: true });
}
