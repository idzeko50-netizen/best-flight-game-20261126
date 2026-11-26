// Chase and cockpit cameras for Ridge Runner.
// The chase camera trails the Kestrel on a spring so it never snaps,
// and the cockpit camera sits where the pilot sits. The mouse drags
// the view around; when the mouse is released the camera eases back.
import { clamp, lerp } from './rng.js';

export function createCameraRig(THREE) {
  const rig = {
    mode: 'chase', // 'chase' | 'cockpit'
    distance: 16,
    height: 5,
    pos: new THREE.Vector3(0, 20, 140),
    look: new THREE.Vector3(0, 10, 0),
  };
  return rig;
}

export function updateCamera(rig, THREE, plane, input, dt, snap) {
  const heading = plane.heading;
  // Forward vector from heading (0 = north, -Z).
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  const rx = -fz, rz = fx; // right vector

  if (rig.mode === 'cockpit') {
    // Pilot's seat: just behind the canopy, high enough to see over
    // the cowling, looking forward.
    const px = plane.x + fx * 0.9;
    const pz = plane.z + fz * 0.9;
    const py = plane.y + 1.6;
    rig.pos.set(px, py, pz);
    const lookYaw = input.lookYaw, lookPitch = input.lookPitch;
    const lx = fx * Math.cos(lookYaw) + rx * Math.sin(lookYaw);
    const lz = fz * Math.cos(lookYaw) - rx * Math.sin(lookYaw);
    rig.look.set(
      px + lx * 40,
      py + Math.sin(plane.pitch + lookPitch) * 40,
      pz + lz * 40,
    );
    if (snap) {
      // nothing to ease in cockpit view
    }
    return { pos: rig.pos, look: rig.look, up: null, roll: plane.roll };
  }

  // Chase: behind and above the tail, pulled by a spring.
  let dist = rig.distance + (input.wheel || 0) * 0.4;
  dist = clamp(dist, 10, 26);
  rig.distance = dist;
  const orbitYaw = input.lookYaw;
  const orbitPitch = clamp(0.32 + input.lookPitch, 0.05, 0.9);
  // Orbit the camera around the plane's heading when the mouse drags.
  const bx = -fx * Math.cos(orbitYaw) - rx * Math.sin(orbitYaw);
  const bz = -fz * Math.cos(orbitYaw) + rx * Math.sin(orbitYaw);
  const target = new THREE.Vector3(
    plane.x + bx * Math.cos(orbitPitch) * dist,
    plane.y + Math.sin(orbitPitch) * dist + 1.5,
    plane.z + bz * Math.cos(orbitPitch) * dist,
  );
  const k = snap ? 1 : 1 - Math.exp(-dt * 5);
  rig.pos.lerp(target, k);
  const lookTarget = new THREE.Vector3(
    plane.x + fx * 12,
    plane.y + Math.sin(plane.pitch) * 8 + 1,
    plane.z + fz * 12,
  );
  rig.look.lerp(lookTarget, snap ? 1 : 1 - Math.exp(-dt * 7));
  return { pos: rig.pos, look: rig.look, up: null, roll: plane.roll * 0.35 };
}
