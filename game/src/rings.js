// The ring course: a string of glowing amber rings threaded down the
// valley, over the river and around the town, for the Ring Run mission.
import { mulberry32 } from './rng.js';

export const RING_RADIUS = 14;

export function makeRingCourse(seed, heightAt) {
  const rand = mulberry32(seed ^ 0x51ab);
  const rings = [];
  // Start above the runway, then swing west over the river, south past
  // the town, and back up the valley to a finish over the strip.
  const path = [
    [0, 60, -260], [-160, 75, -420], [-330, 70, -260],
    [-380, 65, -40], [-300, 80, 200], [-120, 95, 380],
    [120, 110, 420], [260, 95, 240], [220, 80, 0],
    [0, 70, -160],
  ];
  for (let i = 0; i < path.length; i++) {
    const [x, y, z] = path[i];
    const ground = heightAt(x, z);
    const next = path[(i + 1) % path.length];
    // Unit normal of the ring's disc: the ring faces the next ring.
    const nx = next[0] - x, ny = next[1] - y, nz = next[2] - z;
    const len = Math.hypot(nx, ny, nz) || 1;
    rings.push({
      index: i,
      x, y: Math.max(y, ground + 30), z,
      nx: nx / len, ny: ny / len, nz: nz / len,
      passed: false,
      prevD: null,
      jitter: rand() * Math.PI * 2,
    });
  }
  return rings;
}

export function buildRings(THREE, rings) {
  const group = new THREE.Group();
  const meshes = [];
  const geo = new THREE.TorusGeometry(RING_RADIUS, 1.1, 10, 40);
  for (const ring of rings) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb03a });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    // Face the ring along the course: toward the next ring.
    const next = rings[(ring.index + 1) % rings.length];
    mesh.lookAt(next.x, next.y, next.z);
    group.add(mesh);
    // A soft glow disc inside the ring so it reads at a glance.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(RING_RADIUS - 2, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb03a, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
      }),
    );
    glow.position.copy(mesh.position);
    glow.quaternion.copy(mesh.quaternion);
    group.add(glow);
    meshes.push({ mesh, glow, ring });
  }
  return { group, meshes };
}

// Returns the ring just flown through, or null.
// A pass counts when the plane crosses the ring's disc — the plane of
// the ring, within its radius — so threading the ring anywhere counts,
// not only a bullseye through its centre.
export function checkRingPass(plane, rings, meshes) {
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.passed) continue;
    // Only the next ring in sequence counts.
    if (i !== rings.findIndex((r) => !r.passed)) continue;
    const dx = plane.x - ring.x, dy = plane.y - ring.y, dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < RING_RADIUS - 2) {
      ring.passed = true;
      colourPassed(meshes[i]);
      return ring;
    }
    // Signed distance along the ring's normal: crossing zero means the
    // plane passed through the ring's plane.
    const d = dx * ring.nx + dy * ring.ny + dz * ring.nz;
    if (ring.prevD !== null && ring.prevD > 0 !== d > 0) {
      // Distance from the ring's centre within its plane.
      const px = dx - d * ring.nx, py = dy - d * ring.ny, pz = dz - d * ring.nz;
      const offCentre = Math.sqrt(px * px + py * py + pz * pz);
      if (offCentre < RING_RADIUS) {
        ring.passed = true;
        colourPassed(meshes[i]);
        return ring;
      }
    }
    ring.prevD = d;
  }
  return null;
}

function colourPassed(mesh) {
  mesh.mesh.material.color.set(0x37e08a);
  mesh.glow.material.color.set(0x37e08a);
  mesh.glow.material.opacity = 0.25;
}

export function nextRing(rings) {
  return rings.find((r) => !r.passed) || null;
}

export function resetRings(rings, meshes) {
  for (let i = 0; i < rings.length; i++) {
    rings[i].passed = false;
    rings[i].prevD = null;
    meshes[i].mesh.material.color.set(0xffb03a);
    meshes[i].glow.material.color.set(0xffb03a);
    meshes[i].glow.material.opacity = 0.1;
  }
}

export function ringCourseLength(rings) {
  let total = 0;
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1], b = rings[i];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}
