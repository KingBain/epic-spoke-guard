import { createOpenSCAD } from 'openscad-wasm-prebuilt';

const headerSize = 84;
const facetSize = 50;

function cleanBinaryStl(stl) {
  const bytes = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const count = stl.length >= headerSize && bytes.getUint32(80, true);
  if (!count || stl.length !== headerSize + count * facetSize) {
    throw new Error('OpenSCAD did not produce a valid STL.');
  }

  // Distinct OpenSCAD vertices can round to the same coordinates in the STL's
  // float32 storage. Drop those collapsed facets before preview and download.
  const matchesVertex = (a, b) =>
    bytes.getFloat32(a, true) === bytes.getFloat32(b, true) &&
    bytes.getFloat32(a + 4, true) === bytes.getFloat32(b + 4, true) &&
    bytes.getFloat32(a + 8, true) === bytes.getFloat32(b + 8, true);

  let end = headerSize;
  for (let offset = headerSize; offset < stl.length; offset += facetSize) {
    const a = offset + 12;
    const b = a + 12;
    const c = b + 12;
    if (matchesVertex(a, b) || matchesVertex(b, c) || matchesVertex(c, a)) continue;
    stl.copyWithin(end, offset, offset + facetSize);
    end += facetSize;
  }

  const triangleCount = (end - headerSize) / facetSize;
  if (!triangleCount) throw new Error('OpenSCAD produced an empty STL.');
  bytes.setUint32(80, triangleCount, true);
  return { stl: stl.slice(0, end).buffer, triangleCount };
}

self.onmessage = async ({ data: { source, settings } }) => {
  const errors = [];
  try {
    const engine = await createOpenSCAD({
      print: () => {},
      printErr: (line) => {
        if (/^(ERROR|WARNING):/.test(line)) errors.push(line);
      },
    });
    const { FS, callMain } = engine.getInstance();
    FS.writeFile('/guard.scad', source);
    const definitions = Object.entries(settings).flatMap(([name, value]) => [
      '-D', `${name}=${JSON.stringify(value)}`,
    ]);
    const exitCode = callMain([
      '/guard.scad', '--backend=Manifold', '--export-format=binstl',
      '-o', '/guard.stl', ...definitions,
    ]);
    if (exitCode || errors.some((line) => line.startsWith('ERROR:'))) {
      throw new Error('OpenSCAD could not render this model.');
    }
    const result = cleanBinaryStl(FS.readFile('/guard.stl'));
    self.postMessage(result, [result.stl]);
  } catch (error) {
    self.postMessage({ error: errors.join(' ') || error.message });
  }
};
