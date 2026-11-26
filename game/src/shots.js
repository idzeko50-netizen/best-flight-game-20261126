// Deterministic screenshot scenes for Ridge Runner.
// ?shot=start | chase | cockpit | landing (with &seed=1) stages the
// game at a fixed moment — fixed seed, fixed plane pose, HUD live —
// then sets window.__shotReady once a frame is on screen, so the
// screenshot script can capture each scene reliably.
import { RUNWAY } from './terrain.js';
import { missionObjectiveText } from './missions.js';

export function parseShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return {
    scene: shot,
    seed: Number(q.get('seed') || 1),
    mission: q.get('mission') || 'ring-run',
  };
}

// Stage one scene. Called after the world is built and before the
// first rendered frame. Returns true when the scene is a shot scene.
export function stageShotScene(game, params) {
  const { plane, rings, ringMeshes, hud, rig } = game;
  const scene = params.scene;
  if (scene === 'start') {
    // Menu over the parked Kestrel on the strip, late sun behind it.
    game.state = 'menu';
    plane.x = 0; plane.y = RUNWAY.elevation + 1.9; plane.z = 60;
    plane.heading = 0.35; plane.pitch = 0; plane.roll = 0;
    plane.speed = 0; plane.throttle = 0.3;
    rig.mode = 'chase';
    rig.distance = 18;
    // The mission pill would peek out above the menu card; hide it.
    hud.refs.mission.style.visibility = 'hidden';
    return true;
  }

  // The flying scenes all start the Ring Run mission mid-course so the
  // HUD, the rings and the instruments are all live in the frame.
  game.startMission(params.mission === 'landing' ? 'landing' : 'ring-run');
  game.state = 'flying';

  if (scene === 'chase') {
    // Mid-course, closing on ring 3 over the river, rings ahead.
    // Heading 2.74 points the nose at ring 3 (-380, 65, -40).
    plane.x = -260; plane.y = 78; plane.z = -330;
    plane.heading = 2.74; plane.pitch = -0.02; plane.roll = -0.15;
    plane.speed = 64; plane.throttle = 0.72; plane.fuel = 82;
    rings[0].passed = true; rings[1].passed = true;
    plane.ringsPassed = 2;
    rig.mode = 'chase';
    rig.distance = 20;
  } else if (scene === 'cockpit') {
    // Cockpit view, valley and town ahead, sun low on the left.
    plane.x = 60; plane.y = 130; plane.z = 420;
    plane.heading = -0.35; plane.pitch = -0.04; plane.roll = 0.12;
    plane.speed = 58; plane.throttle = 0.6; plane.fuel = 71;
    rings[0].passed = true; rings[1].passed = true; rings[2].passed = true;
    plane.ringsPassed = 3;
    rig.mode = 'cockpit';
  } else if (scene === 'landing') {
    // On final: runway dead ahead and filling the frame, gear down.
    game.startMission('landing');
    plane.x = 8; plane.y = 68; plane.z = 620;
    plane.heading = 0.02; plane.pitch = -0.06; plane.roll = 0.02;
    plane.speed = 50; plane.throttle = 0.45; plane.fuel = 64;
    rig.mode = 'chase';
    rig.distance = 15;
  } else {
    return false;
  }

  // Snap the camera to the staged pose so the first frame is final.
  game.snapCamera();
  // Refresh the mission line and HUD once before the shot.
  hud.setMission(missionObjectiveText(game.missionState, plane, rings));
  hud.refs.view.textContent = rig.mode === 'chase' ? 'CHASE' : 'COCKPIT';
  // The mission toast would sit across the middle of the frame; shots
  // carry the mission line in the HUD pill instead.
  hud.refs.toast.classList.remove('show');
  if (scene === 'start') hud.refs.mission.style.visibility = 'hidden';
  hud.update(plane, game.missionState, game.missionState.elapsed, 0.016);
  resetRingsVisual(rings, ringMeshes, plane.ringsPassed);
  return true;
}

// Re-colour rings the staged plane has already flown, so the course
// reads as in progress rather than untouched.
function resetRingsVisual(rings, meshes, passedCount) {
  for (let i = 0; i < rings.length; i++) {
    if (i < passedCount) {
      rings[i].passed = true;
      meshes[i].mesh.material.color.set(0x37e08a);
      meshes[i].glow.material.color.set(0x37e08a);
      meshes[i].glow.material.opacity = 0.25;
    }
  }
}

export function markShotReady() {
  window.__shotReady = true;
}
