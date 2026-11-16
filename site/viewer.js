import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export function createViewer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 5000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xf7faff, 0x7d8b8d, 2.2));
  const key = new THREE.DirectionalLight(0xfff5e0, 2.4);
  key.position.set(-150, -120, 290);
  scene.add(key);

  const loader = new STLLoader();
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.76,
    color: 0x646e74,
  });
  // Colour the raised lettering in the complete mesh. Keep a small margin
  // above the 1.818 mm ridge tops to avoid highlighting them at the boundary.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 modelPoint;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nmodelPoint = position;',
    );
    shader.fragmentShader = 'varying vec3 modelPoint;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       if (length(modelPoint.xy) > 65.0 && modelPoint.z > 1.85) {
         diffuseColor.rgb = vec3(0.88, 0.85, 0.77);
       }`,
    );
  };

  const partMaterials = {
    'Complete guard': material,
    'Black body': new THREE.MeshStandardMaterial({ color: 0x646e74, roughness: 0.76 }),
    'White letter faces': new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.76 }),
  };

  let mesh;
  let modelSize = 210;
  const draw = () => renderer.render(scene, camera);
  controls.addEventListener('change', draw);

  function resize() {
    const { clientWidth, clientHeight } = host;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
    draw();
  }

  new ResizeObserver(resize).observe(host);
  resize();

  function frame(direction) {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfAngle = Math.atan(Math.tan(halfFov) * Math.min(camera.aspect, 1));
    const distance = modelSize * 0.58 / Math.sin(halfAngle);
    camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance));
    controls.maxDistance = Math.max(1350, distance * 2);
    controls.update();
    draw();
  }

  const reset = () => frame(new THREE.Vector3(0.12, -0.52, 1));
  reset();

  return {
    reset,
    top: () => frame(new THREE.Vector3(0, -0.00001, 1)),
    show(stl, part) {
      const geometry = loader.parse(stl);
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox;
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      mesh = new THREE.Mesh(geometry, partMaterials[part]);
      scene.add(mesh);
      controls.target.set(0, 0, (min.z + max.z) / 2);
      modelSize = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
      reset();
    },
  };
}
