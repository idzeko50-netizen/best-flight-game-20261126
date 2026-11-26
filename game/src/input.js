// Keyboard + mouse input for Ridge Runner.
// Keyboard flies the plane; the mouse looks around (drag to orbit the
// chase camera, or to look around from the cockpit). Nothing here
// reads the network or the DOM beyond the canvas and the keys.
export function createInput() {
  const keys = new Set();
  const input = {
    throttleUp: false, throttleDown: false,
    pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false,
    yawLeft: false, yawRight: false,
    // Mouse look offsets, in radians; they decay back to centre.
    lookYaw: 0, lookPitch: 0,
    dragging: false,
    // Edge-triggered actions, consumed by main.js each frame.
    pressed: new Set(),
  };

  const KEYMAP = {
    KeyW: 'throttleUp', ArrowUp: 'pitchUp',
    KeyS: 'throttleDown', ArrowDown: 'pitchDown',
    ArrowLeft: 'rollLeft', ArrowRight: 'rollRight',
    KeyA: 'yawLeft', KeyD: 'yawRight',
  };

  function refresh() {
    for (const [code, name] of Object.entries(KEYMAP)) {
      input[name] = keys.has(code);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    refresh();
  });

  function bindMouse(canvas) {
    let lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      input.dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!input.dragging) return;
      input.lookYaw -= (e.clientX - lastX) * 0.004;
      input.lookPitch = Math.max(-0.6, Math.min(0.6, input.lookPitch + (e.clientY - lastY) * 0.003));
      lastX = e.clientX; lastY = e.clientY;
    });
    const endDrag = () => { input.dragging = false; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      input.wheel = (input.wheel || 0) + Math.sign(e.deltaY);
    }, { passive: false });
  }

  function decay(dt) {
    if (!input.dragging) {
      input.lookYaw *= Math.exp(-dt * 1.5);
      input.lookPitch *= Math.exp(-dt * 1.5);
    }
    input.pressed.clear();
  }

  return { input, bindMouse, decay };
}
