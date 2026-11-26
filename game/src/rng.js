// Seeded random numbers for Ridge Runner.
// Every random choice in the valley (terrain, town, rings) comes from
// here so a fixed seed rebuilds the exact same world for screenshots.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 2D value noise: smooth, repeatable, no lookup tables.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = hash(ix, iz), b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    const ux = smooth(fx), uz = smooth(fz);
    return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
  }

  // Fractal sum of a few octaves.
  return function fbm(x, z, octaves) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise2(x * freq, z * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2.03;
    }
    return sum / norm;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function degToRad(d) { return (d * Math.PI) / 180; }
export function radToDeg(r) { return (r * 180) / Math.PI; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
