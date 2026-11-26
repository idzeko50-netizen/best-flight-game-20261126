// HUD and lit instruments for Ridge Runner.
// The top bar carries altitude, speed and heading as big numerals; the
// bottom cluster is a 2D canvas of glowing gauges — artificial horizon,
// airspeed, altimeter and compass — drawn to look flown, not flat.
import { clamp, wrapAngle, radToDeg } from './rng.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const refs = {
    alt: el('hud-alt'), spd: el('hud-spd'), hdg: el('hud-hdg'),
    thr: el('hud-thr-fill'), fuel: el('hud-fuel-fill'),
    dmg: el('hud-dmg-fill'), score: el('hud-score'),
    mission: el('hud-mission'), banner: el('hud-banner'),
    toast: el('hud-toast'), clock: el('hud-clock'),
    view: el('hud-view'),
  };
  const canvas = el('instruments');
  const ctx = canvas.getContext('2d');
  let toastTimer = 0;

  function showToast(text, ms) {
    refs.toast.textContent = text;
    refs.toast.classList.add('show');
    toastTimer = ms || 2400;
  }

  function showBanner(text, sub) {
    refs.banner.innerHTML = text + (sub ? '<span>' + sub + '</span>' : '');
    refs.banner.classList.add('show');
  }
  function hideBanner() { refs.banner.classList.remove('show'); }

  function setMission(text) { refs.mission.textContent = text; }

  function drawGauges(plane, missionState, dt) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = '#ffb03a';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffd9a0';
    ctx.fillStyle = '#ffd9a0';
    ctx.lineWidth = 1.5;

    // --- Artificial horizon (left) ---
    const cx = 74, cy = H / 2, r = 52;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#0d1b26'; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll);
    const pitchPx = clamp(plane.pitch, -0.6, 0.6) * 110;
    ctx.fillStyle = '#2f6f8f';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = '#f5f2e8'; ctx.lineWidth = 1;
    for (const d of [-30, -15, 15, 30]) {
      const y = -pitchPx - d * 1.1; // ladder ticks above/below the horizon
      ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 12, cy); ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 34, cy); ctx.stroke();

    // --- Airspeed dial (centre) ---
    const ax = W / 2 - 4, ay = H / 2;
    ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.fillStyle = '#0d1b26'; ctx.fill();
    ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 1.5; ctx.stroke();
    const spdFrac = clamp(plane.speed / 100, 0, 1);
    ctx.beginPath(); ctx.arc(ax, ay, r - 8, -Math.PI * 0.75, -Math.PI * 0.75 + spdFrac * Math.PI * 1.5);
    ctx.strokeStyle = '#37e08a'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#f5f2e8'; ctx.font = 'bold 26px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(plane.speed)), ax, ay + 4);
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#9fb8c8';
    ctx.fillText('KT', ax, ay + 22);

    // --- Altimeter dial (right) ---
    const bx = W - 74, by = H / 2;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fillStyle = '#0d1b26'; ctx.fill();
    ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 1.5; ctx.stroke();
    const altFrac = clamp(plane.y / 500, 0, 1);
    ctx.beginPath(); ctx.arc(bx, by, r - 8, -Math.PI * 0.75, -Math.PI * 0.75 + altFrac * Math.PI * 1.5);
    ctx.strokeStyle = '#ff8a5c'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#f5f2e8'; ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.fillText(String(Math.round(plane.y)), bx, by + 4);
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#9fb8c8';
    ctx.fillText('METRES', bx, by + 22);

    // --- Compass strip (top centre) ---
    const headingDeg = (Math.round(radToDeg(wrapAngle(plane.heading))) + 360) % 360;
    ctx.font = 'bold 13px ui-monospace, monospace'; ctx.textAlign = 'center';
    const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    for (const [deg, name] of labels) {
      let diff = wrapAngle((deg - headingDeg) * Math.PI / 180);
      const x = W / 2 + diff * 260;
      if (Math.abs(diff) > 0.6) continue;
      ctx.fillStyle = deg === 0 ? '#ffb03a' : '#9fb8c8';
      ctx.fillText(name, x, 18);
    }
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath(); ctx.moveTo(W / 2 - 5, 22); ctx.lineTo(W / 2 + 5, 22); ctx.lineTo(W / 2, 28); ctx.fill();
    ctx.restore();
  }

  function update(plane, missionState, elapsed, dt) {
    const headingDeg = (Math.round(radToDeg(wrapAngle(plane.heading))) + 360) % 360;
    refs.alt.textContent = String(Math.max(0, Math.round(plane.y))).padStart(4, '0');
    refs.spd.textContent = String(Math.round(plane.speed)).padStart(3, '0');
    refs.hdg.textContent = String(headingDeg).padStart(3, '0');
    refs.thr.style.width = Math.round(plane.throttle * 100) + '%';
    refs.fuel.style.width = Math.round(plane.fuel) + '%';
    refs.fuel.classList.toggle('low', plane.fuel < 25);
    refs.dmg.style.width = Math.round(plane.damage) + '%';
    refs.dmg.classList.toggle('bad', plane.damage > 50);
    refs.score.textContent = 'SCORE ' + (missionState.score || 0);
    const mins = Math.floor(elapsed / 60), secs = Math.floor(elapsed % 60);
    refs.clock.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    if (toastTimer > 0) {
      toastTimer -= dt * 1000;
      if (toastTimer <= 0) refs.toast.classList.remove('show');
    }
    drawGauges(plane, missionState, dt);
  }

  return { update, showToast, showBanner, hideBanner, setMission, refs };
}
