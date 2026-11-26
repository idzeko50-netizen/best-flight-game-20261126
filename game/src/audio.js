// Engine sound for Ridge Runner: a tiny WebAudio synth — one
// oscillator whose pitch follows the throttle, plus filtered noise
// for wind. No audio files, no network. Created on the first user
// gesture; silent in screenshot mode and when the tab is muted.
export function createAudio() {
  const audio = {
    ctx: null, osc: null, gain: null, wind: null, windGain: null,
    muted: false, started: false,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.osc = audio.ctx.createOscillator();
      audio.osc.type = 'sawtooth';
      audio.osc.frequency.value = 55;
      const low = audio.ctx.createBiquadFilter();
      low.type = 'lowpass'; low.frequency.value = 320;
      audio.gain = audio.ctx.createGain();
      audio.gain.gain.value = 0;
      audio.osc.connect(low); low.connect(audio.gain); audio.gain.connect(audio.ctx.destination);
      audio.osc.start();
      // Wind: looped white-noise buffer through a bandpass.
      const len = audio.ctx.sampleRate * 2;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = audio.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const band = audio.ctx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 500; band.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      src.connect(band); band.connect(audio.windGain); audio.windGain.connect(audio.ctx.destination);
      src.start();
      audio.started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function update(plane, flying) {
    if (audio.muted || !flying) {
      if (audio.gain) audio.gain.gain.value = 0;
      if (audio.windGain) audio.windGain.gain.value = 0;
      return;
    }
    if (!ensure()) return;
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    const t = audio.ctx.currentTime;
    audio.osc.frequency.setTargetAtTime(48 + plane.throttle * 70 + plane.speed * 0.35, t, 0.1);
    audio.gain.gain.setTargetAtTime(0.05 + plane.throttle * 0.05, t, 0.1);
    audio.windGain.gain.setTargetAtTime(Math.min(0.12, plane.speed * 0.0012), t, 0.2);
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.gain) audio.gain.gain.value = 0;
    if (audio.windGain) audio.windGain.gain.value = 0;
    return audio.muted;
  }

  return { update, toggleMute, ensure };
}
