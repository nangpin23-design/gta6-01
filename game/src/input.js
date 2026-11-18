// SUNSET RUN — keyboard and mouse, with edge detection.
//
// down(code) is true while a key is held. pressed(code) is true only on the
// frame the key went down, so a single tap of E enters a car exactly once.
// The mouse reports canvas pixels and, through the camera, world pixels — the
// aim point the pistol shoots toward. Clicks are consumed by whoever reads
// them, so one click never fires twice.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressedKeys: new Set(),
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, clicked: false },
    canvas,
  };

  window.addEventListener('keydown', (e) => {
    if (!input.keys.has(e.code)) input.pressedKeys.add(e.code);
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
    input.mouse.clicked = true;
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  // The same helpers as methods, so game code reads input.down('KeyW').
  input.down = (code) => input.keys.has(code);
  input.pressed = (code) => {
    if (input.pressedKeys.has(code)) {
      input.pressedKeys.delete(code);
      return true;
    }
    return false;
  };
  input.clearPressed = () => {
    input.pressedKeys.clear();
    input.mouse.clicked = false;
  };

  return input;
}

// True while the key is held down.
export function down(input, code) {
  return input.keys.has(code);
}

// True only on the frame the key went down; reading it consumes the edge.
export function pressed(input, code) {
  if (input.pressedKeys.has(code)) {
    input.pressedKeys.delete(code);
    return true;
  }
  return false;
}

// Drop every pending edge (used when the mode changes, so a stale E does not
// fire in the new mode).
export function clearPressed(input) {
  input.pressedKeys.clear();
  input.mouse.clicked = false;
}
