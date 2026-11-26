// The Kestrel — Ridge Runner's bush plane, built from primitives.
// Cream fuselage, terracotta trim, a spinning two-blade prop and a
// glass canopy. One group, nose pointing down -Z, so the flight model
// can pitch, roll and yaw it directly.
export function buildAircraft(THREE) {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xe8ddc4 });
  const terra = new THREE.MeshLambertMaterial({ color: 0xc96f3f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8dd, emissive: 0x223344 });

  // Fuselage: a tapered cylinder along Z, nose forward (-Z).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 7.2, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.6, 12), terra);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.3;
  plane.add(nose);
  // Canopy: a flattened glass dome over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), glass);
  canopy.scale.set(0.9, 0.62, 1.5);
  canopy.position.set(0, 0.85, -0.9);
  plane.add(canopy);
  // Main wing: long, slightly tapered box with terracotta tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.28, 2.1), cream);
  wing.position.set(0, -0.15, -0.4);
  wing.castShadow = true;
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 2.1), terra);
    tip.position.set(side * 6.2, -0.15, -0.4);
    plane.add(tip);
    // Navigation lights: red port, green starboard.
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff3b30 : 0x2ee06a }),
    );
    nav.position.set(side * 6.8, -0.1, -0.4);
    plane.add(nav);
  }
  // Tail: horizontal stabiliser and a tall fin with a terracotta stripe.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 1.3), cream);
  stab.position.set(0, 0.25, 3.4);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.7), terra);
  fin.position.set(0, 1.15, 3.5);
  plane.add(fin);
  // Fixed landing gear: two struts and wheels, so landings read.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), dark);
    strut.position.set(side * 1.1, -1.25, -1.2);
    strut.rotation.z = side * 0.25;
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.35, -1.85, -1.2);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.95, 3.4);
  plane.add(tailWheel);
  // Propeller group at the nose; main.js spins it with throttle.
  const prop = new THREE.Group();
  prop.position.z = -5.15;
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x3a2e26 });
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.12), bladeMat);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), terra);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.25;
  prop.add(spinner);
  plane.add(prop);
  // Registration stripe down the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.18, 5.6), terra);
  stripe.position.set(0, 0.35, 0.4);
  plane.add(stripe);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: plane, prop };
}
