// Missions for Ridge Runner: three sorties out of Alder Field, each
// with its own goal, scoring and end screen.
//   ring-run  — take off, fly the amber ring course, land back.
//   landing   — start on final approach; one clean touchdown, scored.
//   tour      — free flight over the valley; fly as far as the fuel lasts.
import { RUNWAY } from './terrain.js';
import { landingScore } from './flight.js';
import { nextRing } from './rings.js';

export const MISSIONS = {
  'ring-run': {
    id: 'ring-run',
    title: 'Ring Run',
    blurb: 'Take off from Alder Field, thread all 10 amber rings down the valley, then bring the Kestrel home.',
    spawn: { x: 0, y: RUNWAY.elevation + 1.9, z: 120, heading: 0, speed: 0, throttle: 0, onGround: true },
  },
  landing: {
    id: 'landing',
    title: 'Landing Challenge',
    blurb: 'You are on final approach, 800 m out at 120 m. Grease it on the centreline — soft, slow, straight.',
    spawn: { x: 6, y: 120, z: 800, heading: 0, speed: 55, throttle: 0.45, onGround: false },
  },
  tour: {
    id: 'tour',
    title: 'Valley Tour',
    blurb: 'No rings, no clock. Cruise the valley, find the river and the town, and land before the tanks run dry.',
    spawn: { x: 0, y: RUNWAY.elevation + 1.9, z: 120, heading: 0, speed: 0, throttle: 0, onGround: true },
  },
};

export function createMissionState(missionId) {
  return {
    id: missionId,
    score: 0,
    elapsed: 0,
    started: false,
    finished: false,
    result: null, // 'complete' | 'crashed' | 'landed' | 'landed-field' | 'out-of-fuel'
    detail: '',
    touchdown: null,
  };
}

export function missionObjectiveText(state, plane, rings) {
  if (state.id === 'ring-run') {
    const next = nextRing(rings);
    if (!next) return 'Course complete — land on the runway';
    return 'Ring ' + (next.index + 1) + ' of ' + rings.length + ' — ' + plane.ringsPassed + ' flown';
  }
  if (state.id === 'landing') {
    if (plane.landed) return 'Touchdown — see your score';
    return 'Land on runway 36 — soft, slow, on the centreline';
  }
  return 'Free flight — fuel ' + Math.round(plane.fuel) + '%';
}

// Called every frame while flying; returns an event string or null.
export function updateMission(state, plane, rings, dt, events) {
  if (!state.started || state.finished) return null;
  state.elapsed += dt;

  if (state.id === 'ring-run') {
    const passed = events.ringPassed;
    if (passed) {
      state.score += 100;
      plane.ringsPassed++;
      if (plane.ringsPassed === rings.length) {
        state.score += Math.max(0, Math.round(600 - state.elapsed * 2));
        return 'course-complete';
      }
      return 'ring';
    }
  }
  if (state.id === 'tour') {
    state.score = Math.round(state.elapsed * 2);
  }
  return null;
}

// Called when the flight model reports a landing or a crash.
export function finishMission(state, plane, outcome, rings) {
  if (state.finished) return;
  state.finished = true;
  state.result = outcome;
  if (outcome === 'landed' && state.id === 'ring-run') {
    const allRings = plane.ringsPassed === rings.length;
    state.score += allRings ? 250 : 0;
    state.detail = allRings
      ? 'Course flown and a clean landing — the valley is yours.'
      : 'Landed safely, but ' + (rings.length - plane.ringsPassed) + ' ring(s) unflown.';
    state.result = 'complete';
  } else if (outcome === 'landed' && state.id === 'landing') {
    const q = landingScore(plane, state.touchdown || { vs: 0 });
    state.score = q;
    state.detail = 'Touchdown quality ' + q + '/100 — softness, centreline and alignment all counted.';
    state.result = 'complete';
  } else if (outcome === 'landed' && state.id === 'tour') {
    state.detail = 'Down safe after ' + Math.round(state.elapsed) + ' s in the air.';
    state.result = 'complete';
  } else if (outcome === 'landed-field') {
    state.detail = 'Down in a field, off the strip — the Kestrel will need a tow.';
  } else if (outcome === 'crashed') {
    state.detail = 'The Kestrel is a write-off. Walk back to Alder Field and try again.';
  }
  return state;
}
