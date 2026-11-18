const viewer = document.getElementById('glassesViewer');

if (viewer) {
  const loading = document.getElementById('glassesLoading');
  const errorBox = document.getElementById('glassesError');
  const hint = document.getElementById('glassesHint');

  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let modelPivot = null;
  let resizeObserver = null;
  let animationId = 0;
  let disposed = false;
  let pointerInside = false;
  let dragging = false;
  let lastInteraction = 0;
  let lastFrame = 0;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fail(message) {
    if (loading) loading.classList.add('hidden');
    if (errorBox) {
      errorBox.textContent = message || 'The 3D model could not be loaded. Please refresh the page.';
      errorBox.classList.remove('hidden');
    }
    if (hint) hint.textContent = 'Device preview unavailable';
    console.error('[Smart Eyeglasses 3D viewer]', message);
  }

  function loginIsVisible() {
    const login = document.getElementById('loginView');
    return !document.hidden && !!login && !login.classList.contains('hidden');
  }

  async function initialize() {
    try {
      // Use the import map in index.html. Errors are caught and shown in the viewer.
      const THREE = await import('three');
      const [{ STLLoader }, { OrbitControls }] = await Promise.all([
        import('three/addons/loaders/STLLoader.js'),
        import('three/addons/controls/OrbitControls.js')
      ]);

      if (disposed) return;

      const width = Math.max(viewer.clientWidth, 1);
      const height = Math.max(viewer.clientHeight, 1);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(34, width / height, 0.01, 1000);
      camera.position.set(0, 0.1, 5);

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
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D model of the Smart Eyeglasses');
      viewer.prepend(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xc3d9df, 1.8));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
      keyLight.position.set(3.5, 4.5, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xc5efff, 1.2);
      fillLight.position.set(-4, 1.5, 2.5);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x8fd5c0, 1.6);
      rimLight.position.set(0, 2, -4);
      scene.add(rimLight);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.rotateSpeed = 0.7;
      controls.zoomSpeed = 0.8;
      controls.minDistance = 2.4;
      controls.maxDistance = 12;
      controls.target.set(0, 0, 0);

      controls.addEventListener('start', () => {
        dragging = true;
        lastInteraction = performance.now();
      });
      controls.addEventListener('end', () => {
        dragging = false;
        lastInteraction = performance.now();
      });

      viewer.addEventListener('pointerenter', () => { pointerInside = true; });
      viewer.addEventListener('pointerleave', () => {
        pointerInside = false;
        lastInteraction = performance.now();
      });
      viewer.addEventListener('pointerdown', () => {
        dragging = true;
        lastInteraction = performance.now();
      });
      window.addEventListener('pointerup', () => {
        dragging = false;
        lastInteraction = performance.now();
      });

      // Fetch with an explicit path and status check; this catches missing Vercel assets.
      const modelPath = new URL('./assets/models/base.stl', document.baseURI);
      const response = await fetch(modelPath.href, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`STL file request failed (${response.status}). Confirm assets/models/base.stl exists in the deployed project.`);
      }

      const stlBuffer = await response.arrayBuffer();
      if (stlBuffer.byteLength < 84) {
        throw new Error('The STL file is missing, empty, or incomplete.');
      }

      const geometry = new STLLoader().parse(stlBuffer);
      if (!geometry?.attributes?.position?.count) {
        throw new Error('The STL file loaded but contains no renderable 3D geometry.');
      }

      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const bounds = geometry.boundingBox;
      const dimensions = new THREE.Vector3();
      const center = new THREE.Vector3();
      bounds.getSize(dimensions);
      bounds.getCenter(center);

      const largestDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
      if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
        throw new Error('The STL model has invalid dimensions.');
      }

      geometry.translate(-center.x, -center.y, -center.z);

      const material = new THREE.MeshStandardMaterial({
        color: 0x244b55,
        metalness: 0.28,
        roughness: 0.42
      });

      const mesh = new THREE.Mesh(geometry, material);

      // The supplied STL is authored with its height on Z and temple depth on Y.
      // Reorient it so Z becomes the viewer's vertical Y axis and the front faces
      // the camera along +Z. This keeps the glasses upright during Y-axis turntable rotation.
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(2.45 / largestDimension);

      modelPivot = new THREE.Group();
      modelPivot.add(mesh);
      scene.add(modelPivot);

      const modelRadius = Math.max((geometry.boundingSphere?.radius || largestDimension / 2) * mesh.scale.x, 0.5);
      const fitDistance = Math.max(
        3.7,
        modelRadius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.18
      );

      camera.position.set(0, 0.12, fitDistance);
      camera.near = Math.max(0.01, fitDistance / 100);
      camera.far = fitDistance * 30;
      camera.updateProjectionMatrix();

      controls.minDistance = Math.max(2.3, modelRadius * 1.1);
      controls.maxDistance = Math.max(8, modelRadius * 5.5);
      controls.update();

      if (loading) loading.classList.add('hidden');
      if (errorBox) errorBox.classList.add('hidden');
      if (hint) {
        hint.textContent = reducedMotion
          ? 'Drag to rotate · Scroll to zoom'
          : 'Drag to explore · Scroll to zoom';
      }
      viewer.dataset.viewerState = 'ready';

      function animate(now) {
        if (disposed) return;
        animationId = requestAnimationFrame(animate);

        if (!loginIsVisible()) {
          lastFrame = now;
          return;
        }

        const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
        lastFrame = now;

        const recentlyTouched = now - lastInteraction < 850;
        if (modelPivot && !reducedMotion && !pointerInside && !dragging && !recentlyTouched) {
          modelPivot.rotation.y += delta * 0.2;
        }

        controls.update();
        renderer.render(scene, camera);
      }

      animationId = requestAnimationFrame(animate);

      resizeObserver = new ResizeObserver(() => {
        if (!renderer || !camera) return;
        const w = Math.max(viewer.clientWidth, 1);
        const h = Math.max(viewer.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(viewer);

    } catch (error) {
      viewer.dataset.viewerState = 'error';
      fail(error?.message || String(error));
    }
  }

  initialize();

  window.addEventListener('pagehide', () => {
    disposed = true;
    if (animationId) cancelAnimationFrame(animationId);
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
