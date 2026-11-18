// NEON TIDE — keyboard and mouse state. Keys are tracked by code, so WASD and
// arrows both work; the mouse reports canvas-relative position and clicks, which
// the player uses to aim and shoot.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once, on the frame the key went down. Call once per frame per key.
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
