// Procedural valley terrain for Ridge Runner: rolling hills, a river,
// a small town, a mountain rim, and the Alder Field runway.
// One pure height function drives both the mesh and the flight model,
// so the ground the pilot sees is the ground the pilot can hit.
import { makeNoise, mulberry32, clamp, lerp } from './rng.js';

export const WORLD_SIZE = 2400;      // terrain spans -1200 .. +1200
export const RUNWAY = {
  x: 0, z: 0, length: 420, width: 34, heading: 0, // runs north-south
  elevation: 6,
};

const RIVER_X = -380; // river meanders around this line

function riverOffset(z) {
  return Math.sin(z * 0.0016) * 90 + Math.sin(z * 0.00043 + 1.7) * 60;
}

function riverDistance(x, z) {
  return Math.abs(x - (RIVER_X + riverOffset(z)));
}

export function makeTerrain(seed) {
  const fbm = makeNoise(seed);
  const rand = mulberry32(seed ^ 0x9e3779b9);

  // Height in metres at world (x, z). Kept in sync with the mesh.
  function heightAt(x, z) {
    const edge = Math.max(Math.abs(x), Math.abs(z)) / (WORLD_SIZE / 2);
    // Mountain rim rises toward the edges of the map.
    const rim = Math.pow(Math.max(0, edge - 0.55) / 0.45, 2) * 260;
    // Rolling hills in the valley floor.
    let h = fbm(x * 0.0016, z * 0.0016, 3) * 26
      + fbm(x * 0.006, z * 0.006, 2) * 7;
    h += rim * (0.6 + 0.4 * fbm(x * 0.004 + 9, z * 0.004 + 3, 2));
    // Carve the river channel down to water level.
    const rd = riverDistance(x, z);
    const carve = clamp(1 - rd / 70, 0, 1);
    h = lerp(h, -4, carve * carve);
    // Flatten a corridor around the runway so it sits on level ground,
    // with a long clear approach from the south and room past the
    // northern threshold — an airfield needs a clear final, not a hill.
    const south = RUNWAY.length / 2 + 500;
    const north = RUNWAY.length / 2 + 300;
    const across = RUNWAY.width / 2 + 90;
    const along = z > -north && z < south;
    const isAcross = Math.abs(x) < across;
    if (along && isAcross) {
      const t = clamp(Math.min(
        (south - z) / 120,
        (z + north) / 120,
        (across - Math.abs(x)) / 90,
      ), 0, 1);
      h = lerp(RUNWAY.elevation, h, 1 - t * t);
    }
    return h;
  }

  function buildTerrainMesh(THREE) {
    const segments = 180;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = [0.32, 0.48, 0.22];
    const meadow = [0.45, 0.55, 0.25];
    const rock = [0.42, 0.4, 0.38];
    const snow = [0.93, 0.94, 0.96];
    const sand = [0.72, 0.64, 0.45];
    const c = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.02, z * 0.02, 2) * 0.5 + 0.5;
      if (riverDistance(x, z) < 26) {
        c[0] = sand[0]; c[1] = sand[1]; c[2] = sand[2];
      } else if (h > 150) {
        const t = clamp((h - 150) / 90, 0, 1);
        c[0] = lerp(rock[0], snow[0], t); c[1] = lerp(rock[1], snow[1], t); c[2] = lerp(rock[2], snow[2], t);
      } else if (h > 70) {
        c[0] = rock[0]; c[1] = rock[1]; c[2] = rock[2];
      } else {
        c[0] = lerp(grass[0], meadow[0], n); c[1] = lerp(grass[1], meadow[1], n); c[2] = lerp(grass[2], meadow[2], n);
      }
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildRiver(THREE) {
    // A flat ribbon following the river's meander, just above water level.
    const points = [];
    for (let z = -WORLD_SIZE / 2; z <= WORLD_SIZE / 2; z += 40) {
      points.push(new THREE.Vector3(RIVER_X + riverOffset(z), 0.6, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const width = 46;
    const steps = 90;
    const verts = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      verts.push(p.x - side.x * width / 2, p.y, p.z - side.z * width / 2);
      verts.push(p.x + side.x * width / 2, p.y, p.z + side.z * width / 2);
      if (i < steps) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({
      color: 0x2f6f8f, transparent: true, opacity: 0.92,
    });
    return new THREE.Mesh(geo, mat);
  }

  function buildRunway(THREE) {
    const group = new THREE.Group();
    const y = RUNWAY.elevation + 0.15;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: 0x2e2e33 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(RUNWAY.x, y, RUNWAY.z);
    strip.receiveShadow = true;
    group.add(strip);
    // Centreline dashes and threshold bars, terracotta-edged.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
    for (let z = -RUNWAY.length / 2 + 30; z < RUNWAY.length / 2 - 10; z += 40) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 18), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(RUNWAY.x, y + 0.05, RUNWAY.z + z);
      group.add(dash);
    }
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xc96f3f });
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.2, RUNWAY.length), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(RUNWAY.x + side * (RUNWAY.width / 2 - 0.8), y + 0.05, RUNWAY.z);
      group.add(edge);
    }
    // Threshold lights: green at the north end, red at the south.
    const lightGeo = new THREE.SphereGeometry(1.1, 8, 8);
    for (let i = -3; i <= 3; i++) {
      const g = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x37e08a }));
      g.position.set(RUNWAY.x + i * 5, y + 0.6, RUNWAY.z - RUNWAY.length / 2 + 4);
      group.add(g);
      const r = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xe04a3a }));
      r.position.set(RUNWAY.x + i * 5, y + 0.6, RUNWAY.z + RUNWAY.length / 2 - 4);
      group.add(r);
    }
    // Windsock and a small hangar beside the strip.
    const sockPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x888888 }),
    );
    sockPole.position.set(26, RUNWAY.elevation + 4.5, -150);
    group.add(sockPole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xe07840 }),
    );
    sock.rotation.z = Math.PI / 2.4;
    sock.position.set(28.5, RUNWAY.elevation + 8.6, -150);
    group.add(sock);
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(26, 10, 18),
      new THREE.MeshLambertMaterial({ color: 0x8a6f52 }),
    );
    hangar.position.set(34, RUNWAY.elevation + 5, 120);
    group.add(hangar);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x6b5640 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(34, RUNWAY.elevation + 10, 120);
    group.add(roof);
    return group;
  }

  function buildTown(THREE) {
    // Alderton: a cluster of small houses with lit windows, east of the strip.
    const group = new THREE.Group();
    const count = 46;
    const houseGeo = new THREE.BoxGeometry(1, 1, 1);
    const houseMat = new THREE.MeshLambertMaterial({ color: 0xd8c9a8 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a4a38 });
    const houses = new THREE.InstancedMesh(houseGeo, houseMat, count);
    const roofs = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 4), roofMat, count,
    );
    const dummy = new THREE.Object3D();
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 1.1), windowMat, count * 2);
    let placed = 0, w = 0;
    let guard = 0;
    while (placed < count && guard++ < 500) {
      const x = 180 + rand() * 320;
      const z = 60 + rand() * 420;
      if (Math.abs(x) < 60) continue;
      const h = heightAt(x, z);
      const s = 7 + rand() * 7;
      dummy.position.set(x, h + s * 0.45, z);
      dummy.scale.set(s, s * 0.8, s * 0.9);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      houses.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = h + s * 0.8 + s * 0.25;
      dummy.scale.set(s * 1.05, s * 0.55, s * 1.0);
      dummy.updateMatrix();
      roofs.setMatrixAt(placed, dummy.matrix);
      for (let k = 0; k < 2; k++) {
        dummy.position.set(x + (k ? 2 : -2), h + s * 0.45, z + s * 0.46);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        windows.setMatrixAt(w++, dummy.matrix);
      }
      placed++;
    }
    houses.count = placed; roofs.count = placed; windows.count = w;
    group.add(houses, roofs, windows);
    return group;
  }

  function buildTrees(THREE) {
    const count = 260;
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.8, 4, 5),
      new THREE.MeshLambertMaterial({ color: 0x5a4230 }), count,
    );
    const crown = new THREE.InstancedMesh(
      new THREE.ConeGeometry(3.2, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x3d7040 }), count,
    );
    const dummy = new THREE.Object3D();
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 2000) {
      const x = (rand() * 2 - 1) * 1100;
      const z = (rand() * 2 - 1) * 1100;
      if (Math.abs(x) < RUNWAY.width / 2 + 40 && Math.abs(z) < RUNWAY.length / 2 + 40) continue;
      if (riverDistance(x, z) < 40) continue;
      if (x > 150 && x < 520 && z > 40 && z < 500) continue; // keep the town clear
      const h = heightAt(x, z);
      if (h > 120) continue;
      const s = 0.8 + rand() * 0.9;
      dummy.position.set(x, h + 2 * s, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      trunk.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = h + (4 + 4.5) * s;
      dummy.updateMatrix();
      crown.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    trunk.count = placed; crown.count = placed;
    const group = new THREE.Group();
    group.add(trunk, crown);
    return group;
  }

  function buildSky(THREE, scene) {
    // Late-afternoon sky: warm horizon, teal-blue above, low sun.
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
    sun.position.set(-600, 320, -400);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 2000;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x9fc4e0, 0x4a5a3a, 0.85));
    scene.fog = new THREE.Fog(0xcfe0e8, 500, 2100);
    scene.background = new THREE.Color(0x9fc8dd);
    // A few soft clouds: flattened white puffs drifting high, unlit
    // so they stay bright against the sky.
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const clouds = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const puff = new THREE.Group();
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rand() * 16, 8, 6), cloudMat);
        s.position.set((rand() - 0.5) * 50, (rand() - 0.5) * 6, (rand() - 0.5) * 20);
        s.scale.y = 0.45;
        puff.add(s);
      }
      puff.position.set((rand() * 2 - 1) * 1000, 260 + rand() * 90, (rand() * 2 - 1) * 1000);
      clouds.add(puff);
    }
    scene.add(clouds);
    return { sun, clouds };
  }

  return { heightAt, riverDistance, buildTerrainMesh, buildRiver, buildRunway, buildTown, buildTrees, buildSky };
}
