import { copyFile } from 'node:fs/promises';

await Promise.all([
  copyFile('LICENSE', 'dist/epic-spoke-guard-license.txt'),
  copyFile('node_modules/openscad-wasm-prebuilt/COPYING', 'dist/openscad-copying.txt'),
  copyFile('node_modules/three/LICENSE', 'dist/three-license.txt'),
]);
