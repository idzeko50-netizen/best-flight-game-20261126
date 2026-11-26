// Ridge Runner — bootstrap and game loop.
// Builds the valley, the Kestrel and the ring course, runs the state
// machine (menu → flying → landed / crashed), and keeps the HUD, the
// camera and the engine sound in step with the flight model.
import { makeTerrain, RUNWAY } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { createPlane, resetPlane, updateFlight } from './flight.js';
import { makeRingCourse, buildRings, checkRingPass, resetRings } from './rings.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { MISSIONS, createMissionState, updateMission, finishMission, missionObjectiveText } from './missions.js';
import { createCameraRig, updateCamera } from './camera.js';
import { createAudio } from './audio.js';
import { parseShotParams, stageShotScene, markShotReady } from './shots.js';

const THREE = window.THREE;
const SEED = Number(new URLSearchParams(window.location.search).get('seed') || 20261126);
const SHOT = parseShotParams();

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);

const terrain = makeTerrain(SEED);
scene.add(terrain.buildTerrainMesh(THREE));
scene.add(terrain.buildRiver(THREE));
scene.add(terrain.buildRunway(THREE));
scene.add(terrain.buildTown(THREE));
scene.add(terrain.buildTrees(THREE));
terrain.buildSky(THREE, scene);

const rings = makeRingCourse(SEED, terrain.heightAt);
const ringParts = buildRings(THREE, rings);
scene.add(ringParts.group);

const aircraft = buildAircraft(THREE);
scene.add(aircraft.group);

const plane = createPlane();
const hud = createHud();
const { input, bindMouse, decay } = createInput();
bindMouse(canvas);
const rig = createCameraRig(THREE);
const audio = createAudio();

const game = {
  state: 'menu', // menu | flying | over
  missionState: createMissionState('ring-run'),
  missionId: 'ring-run',
  plane, rings, ringMeshes: ringParts.meshes, hud, rig,
  frozen: false,
  snapCamera,
  startMission,
};

let shotStaged = false;
let framesRendered = 0;

function snapCamera() {
  const view = updateCamera(rig, THREE, plane, input, 0.016, true);
  camera.position.copy(view.pos);
  camera.lookAt(view.look);
  camera.rotateZ(view.roll || 0);
}

function applyPlaneTransform() {
  aircraft.group.position.set(plane.x, plane.y, plane.z);
  aircraft.group.rotation.order = 'YXZ';
  aircraft.group.rotation.y = plane.heading;
  aircraft.group.rotation.x = plane.pitch;
  aircraft.group.rotation.z = -plane.roll;
  aircraft.prop.rotation.z = game.frozen ? 0.7 : aircraft.prop.rotation.z + plane.throttle * 0.55 + plane.speed * 0.004;
  // From the cockpit the prop is a blur, not a blade: a frozen blade
  // would sweep straight through the camera, so hide it there.
  aircraft.prop.visible = rig.mode !== 'cockpit';
}

function startMission(missionId) {
  const mission = MISSIONS[missionId];
  game.missionId = missionId;
  game.missionState = createMissionState(missionId);
  game.missionState.started = true;
  resetPlane(plane, mission.spawn);
  resetRings(rings, ringParts.meshes);
  plane.fuel = 100; plane.damage = 0;
  game.state = 'flying';
  hud.hideBanner();
  hud.refs.view.textContent = rig.mode === 'chase' ? 'CHASE' : 'COCKPIT';
  hud.setMission(missionObjectiveText(game.missionState, plane, rings));
  hud.showToast(mission.title + ' — ' + mission.blurb, 4200);
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  snapCamera();
}

function endFlight(outcome) {
  const state = finishMission(game.missionState, plane, outcome, rings);
  game.state = 'over';
  hud.hideBanner();
  hud.refs.toast.classList.remove('show');
  const title = state.result === 'complete' ? 'Sortie complete'
    : state.result === 'crashed' ? 'Crashed'
    : state.result === 'landed-field' ? 'Down in a field' : 'Flight over';
  hud.showBanner(title, 'Score ' + state.score + ' — ' + state.detail);
  const end = document.getElementById('end');
  end.querySelector('h2').textContent = title;
  end.querySelector('p').textContent = state.detail;
  end.querySelector('.end-score').textContent = 'Score ' + state.score;
  end.classList.remove('hidden');
}

function step(dt) {
  const now = performance.now();
  const pressed = input.pressed;

  if (pressed.has('KeyC') && game.state === 'flying') {
    rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase';
    hud.refs.view.textContent = rig.mode === 'chase' ? 'CHASE' : 'COCKPIT';
    snapCamera();
  }
  if (pressed.has('KeyM')) {
    const muted = audio.toggleMute();
    hud.showToast(muted ? 'Sound off' : 'Sound on', 1200);
  }
  if (pressed.has('KeyR') && game.state !== 'menu') startMission(game.missionId);
  if (pressed.has('Enter') && game.state === 'menu') startMission(game.missionId);
  if (pressed.has('Escape') && game.state !== 'menu') {
    game.state = 'menu';
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('end').classList.add('hidden');
  }

  if (game.state === 'flying' && !game.frozen) {
    const beforeVs = plane.verticalSpeed;
    const outcome = updateFlight(plane, input, dt, terrain.heightAt);
    if (outcome === 'landed' || outcome === 'landed-field' || outcome === 'crashed') {
      game.missionState.touchdown = { vs: beforeVs };
      endFlight(outcome);
    } else {
      const ring = checkRingPass(plane, rings, ringParts.meshes);
      const event = updateMission(game.missionState, plane, rings, dt, { ringPassed: ring });
      if (event === 'ring') {
        hud.showToast('Ring ' + plane.ringsPassed + ' of ' + rings.length + ' — +100', 1600);
      } else if (event === 'course-complete') {
        hud.showToast('Course complete — bring her home to Alder Field', 3000);
      }
      hud.setMission(missionObjectiveText(game.missionState, plane, rings));
      if (plane.fuel <= 0 && plane.speed < 30 && plane.onGround) {
        endFlight('landed-field');
      }
    }
  }

  applyPlaneTransform();
  const view = updateCamera(rig, THREE, plane, input, dt, false);
  camera.position.copy(view.pos);
  camera.lookAt(view.look);
  camera.rotateZ(view.roll || 0);
  hud.update(plane, game.missionState, game.missionState.elapsed, dt);
  audio.update(plane, game.state === 'flying');
  decay(dt);
  renderer.render(scene, camera);
  framesRendered++;
  if (shotStaged && framesRendered >= 3) markShotReady();
}

// Menu wiring.
for (const btn of document.querySelectorAll('[data-mission]')) {
  btn.addEventListener('click', () => {
    audio.ensure();
    startMission(btn.dataset.mission);
  });
}
document.getElementById('fly-btn').addEventListener('click', () => {
  audio.ensure();
  startMission(game.missionId);
});
document.getElementById('again-btn').addEventListener('click', () => startMission(game.missionId));
document.getElementById('menu-btn').addEventListener('click', () => {
  game.state = 'menu';
  document.getElementById('menu').classList.remove('hidden');
  document.getElementById('end').classList.add('hidden');
});
for (const card of document.querySelectorAll('.mission-card')) {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mission-card').forEach((c) => c.classList.remove('picked'));
    card.classList.add('picked');
    game.missionId = card.dataset.mission;
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot scenes freeze the flight model so the frame is deterministic.
if (SHOT) {
  shotStaged = stageShotScene(game, SHOT);
  if (shotStaged && SHOT.scene !== 'start') game.frozen = true;
  if (SHOT.scene === 'start') {
    document.getElementById('menu').classList.remove('hidden');
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  step(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Exposed for the headless play-test: no game logic depends on it.
window.__game = game;
