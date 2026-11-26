// Arcade flight model for Ridge Runner.
// Throttle sets speed, pitch and bank steer, lift comes from speed —
// so flying well means throttle and turn discipline, not just holding
// a key. Fuel drains with throttle; hard contact with the ground
// costs damage; a gentle touchdown on the strip is a landing.
import { clamp, lerp, wrapAngle } from './rng.js';
import { RUNWAY } from './terrain.js';

export const MIN_SPEED = 26;   // below this the wing stops flying
export const MAX_SPEED = 95;
export const CRUISE_SPEED = 62;

export function createPlane() {
  return {
    // Position in metres; heading 0 = north (-Z), pitch/roll in radians.
    x: 0, y: RUNWAY.elevation + 1.9, z: 120,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    verticalSpeed: 0,
    fuel: 100, damage: 0,
    onGround: true, airborne: false, airTime: 0, landed: false, crashed: false,
    ringsPassed: 0,
  };
}

export function resetPlane(plane, spawn) {
  Object.assign(plane, createPlane(), spawn);
}

export function updateFlight(plane, input, dt, heightAt) {
  if (plane.crashed || plane.landed) return 'done';

  // Throttle: W/S, eased toward the target so the engine feels heavy.
  const targetThrottle = plane.fuel <= 0 ? 0 : clamp(
    plane.throttle + (input.throttleUp ? dt * 0.55 : 0) - (input.throttleDown ? dt * 0.7 : 0),
    0, 1,
  );
  plane.throttle = lerp(plane.throttle, targetThrottle, 1 - Math.exp(-dt * 4));

  // Speed chases the throttle setting; drag grows with speed squared.
  const targetSpeed = plane.throttle * MAX_SPEED;
  const accel = plane.throttle > 0 ? 14 : 6;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
  plane.speed = Math.max(0, plane.speed);

  // Pitch and roll answer the keys at every speed, but authority
  // fades near a standstill so the plane cannot hover on its tail.
  const authority = clamp(plane.speed / 40, 0.15, 1);
  const pitchRate = (input.pitchUp ? 0.85 : 0) - (input.pitchDown ? 0.85 : 0);
  // Left arrow banks left (negative roll), right arrow banks right:
  // a left bank turns the nose left, a right bank turns it right.
  const rollRate = (input.rollRight ? 1.5 : 0) - (input.rollLeft ? 1.5 : 0);
  plane.pitch = clamp(plane.pitch + pitchRate * authority * dt, -0.55, 0.55);
  plane.roll = clamp(plane.roll + rollRate * authority * dt, -1.1, 1.1);
  // The wing levels itself when the stick is released.
  if (!input.rollLeft && !input.rollRight) {
    plane.roll = lerp(plane.roll, 0, 1 - Math.exp(-dt * 1.1));
  }
  if (!input.pitchUp && !input.pitchDown) {
    plane.pitch = lerp(plane.pitch, 0, 1 - Math.exp(-dt * 0.7));
  }
  // Rudder yaws gently; a banked turn is the real way around.
  const yawRate = (input.yawLeft ? 0.35 : 0) - (input.yawRight ? 0.35 : 0);
  plane.heading += (yawRate - Math.sin(plane.roll) * 0.65) * dt;
  plane.heading = wrapAngle(plane.heading);

  // Velocity: forward along heading and pitch, plus sink when slow.
  // The sink only bites when the plane is genuinely off the ground —
  // rolling over a hill crest at walking pace is not a stall.
  const forward = plane.speed;
  const lift = clamp(plane.speed / MIN_SPEED, 0, 1.4);
  const groundHere = heightAt(plane.x, plane.z);
  const onStripHere = Math.abs(plane.x - RUNWAY.x) < RUNWAY.width / 2 - 2
    && Math.abs(plane.z - RUNWAY.z) < RUNWAY.length / 2;
  const groundYHere = onStripHere ? RUNWAY.elevation : groundHere;
  const clearance = plane.y - groundYHere;
  let vy = Math.sin(plane.pitch) * forward;
  if (lift < 1 && clearance > 2) vy -= (1 - lift) * 22; // stall sink
  if (plane.onGround && plane.speed < MIN_SPEED * 0.9) vy = Math.max(0, vy);
  plane.verticalSpeed = vy;

  const dx = Math.sin(plane.heading) * Math.cos(plane.pitch) * forward * dt * -1;
  const dz = Math.cos(plane.heading) * Math.cos(plane.pitch) * forward * dt * -1;
  plane.x += dx;
  plane.z += dz;
  plane.y += vy * dt;

  // Fuel: thirsty at full throttle, sipping at cruise — a full tank
  // lasts about four minutes of mixed flying, enough for the course.
  plane.fuel = Math.max(0, plane.fuel - dt * (0.10 + plane.throttle * 0.40));

  // Stay inside the valley; the rim pushes the pilot back.
  const edge = Math.max(Math.abs(plane.x), Math.abs(plane.z));
  if (edge > 1150) {
    plane.heading = wrapAngle(plane.heading + Math.PI);
    plane.x = clamp(plane.x, -1150, 1150);
    plane.z = clamp(plane.z, -1150, 1150);
  }
  if (plane.y > 520) { plane.y = 520; plane.pitch = Math.min(plane.pitch, 0); }

  // Ground contact. justTouched is true only on the frame the wheels
  // meet the ground, so a takeoff roll or a rollout after touchdown
  // is never judged as a landing or a crash.
  const ground = heightAt(plane.x, plane.z);
  const onRunway = Math.abs(plane.x - RUNWAY.x) < RUNWAY.width / 2 - 1
    && Math.abs(plane.z - RUNWAY.z) < RUNWAY.length / 2;
  const groundY = onRunway ? RUNWAY.elevation : ground;
  if (plane.y <= groundY + 1.9) {
    const justTouched = !plane.onGround;
    plane.y = groundY + 1.9;
    plane.onGround = true;
    const hard = -plane.verticalSpeed;
    const banked = Math.abs(plane.roll) > 0.5;
    if (justTouched && plane.airborne) {
      if (!onRunway) {
        // A touchdown off the strip at speed is a crash; a slow
        // belly landing in a field is damage and a stop.
        if (plane.speed > 18 || hard > 6) {
          plane.crashed = true;
          return 'crashed';
        }
        plane.damage = Math.min(100, plane.damage + 25);
      } else {
        if (hard > 7 || banked) {
          plane.damage = Math.min(100, plane.damage + 30);
          plane.crashed = true;
          return 'crashed';
        }
        if (hard > 3.5) plane.damage = Math.min(100, plane.damage + 12);
        // A touchdown only counts as a landing after a real flight;
        // a bounce a second after liftoff is a bump, not the end.
        if (plane.airTime > 3) {
          plane.landed = true;
          return 'landed';
        }
      }
    }
    if (!onRunway) {
      // Rolling through a field brakes hard — but not so hard that a
      // bush plane that veered off the strip can never build speed
      // again and take off from the grass.
      plane.speed = Math.max(0, plane.speed - 10 * dt);
      if (plane.airborne && plane.speed < 2) {
        plane.landed = true;
        return 'landed-field';
      }
    } else if (plane.airborne && plane.speed < 2 && plane.throttle < 0.05) {
      plane.landed = true;
      return 'landed';
    }
  } else {
    plane.onGround = false;
    // A slow plane a couple of metres above the ground settles onto
    // it instead of hovering there forever on a stalled wing.
    if (plane.speed < 5 && plane.y - groundY < 3) {
      plane.y = groundY + 1.9;
      plane.onGround = true;
    }
  }
  // Once the wheels have left the ground, the sortie counts as flown:
  // without this, a plane parked on the strip would "land" on frame one.
  if (!plane.onGround) {
    plane.airborne = true;
    plane.airTime += dt;
  }
  return 'flying';
}

// Landing quality, 0..100, for the landing challenge score.
export function landingScore(plane, touchdown) {
  const soft = clamp(1 - Math.max(0, -touchdown.vs) / 6, 0, 1);
  const centre = clamp(1 - Math.abs(plane.x - RUNWAY.x) / (RUNWAY.width / 2), 0, 1);
  const aligned = clamp(1 - Math.abs(wrapAngle(plane.heading)) / 0.4, 0, 1);
  const slow = clamp(1 - Math.max(0, plane.speed - 45) / 40, 0, 1);
  return Math.round(100 * (soft * 0.4 + centre * 0.25 + aligned * 0.2 + slow * 0.15));
}
