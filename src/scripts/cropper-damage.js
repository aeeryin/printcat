// Rectangles to repaint in CSS pixels. Full redraws are reserved for setup,
// fading and annotations; ordinary selection updates touch only changed strips.
(function (root) {
  function damage(previous, current, width, height) {
    if (!previous || previous.opacity !== current.opacity || previous.annotated || current.annotated) {
      return [{ x: 0, y: 0, w: width, h: height }];
    }
    const regions = [];
    function add(x, y, w, h) {
      const left = Math.max(0, Math.floor(x));
      const top = Math.max(0, Math.floor(y));
      const right = Math.min(width, Math.ceil(x + w));
      const bottom = Math.min(height, Math.ceil(y + h));
      if (right > left && bottom > top) regions.push({ x: left, y: top, w: right - left, h: bottom - top });
    }
    function subtract(a, b) {
      if (!a) return;
      if (!b) return add(a.x, a.y, a.w, a.h);
      const l = Math.max(a.x, b.x), t = Math.max(a.y, b.y);
      const r = Math.min(a.x + a.w, b.x + b.w), bottom = Math.min(a.y + a.h, b.y + b.h);
      if (r <= l || bottom <= t) return add(a.x, a.y, a.w, a.h);
      add(a.x, a.y, a.w, t - a.y);
      add(a.x, bottom, a.w, a.y + a.h - bottom);
      add(a.x, t, l - a.x, bottom - t);
      add(r, t, a.x + a.w - r, bottom - t);
    }
    subtract(previous.rect, current.rect);
    subtract(current.rect, previous.rect);
    for (const state of [previous, current]) {
      const r = state.rect;
      if (r) {
        // Handles, ruler labels and the dimension badge extend past the edge.
        add(r.x - 18, r.y - 30, r.w + 36, 60);
        add(r.x - 18, r.y + r.h - 18, r.w + 36, 36);
        add(r.x - 18, r.y - 18, 76, r.h + 36);
        add(r.x + r.w - 18, r.y - 18, 36, r.h + 36);
        add(r.x + r.w / 2 - 150, r.y - 30, 300, 65);
      }
      if (state.cursor) {
        // The crosshair is rendered on a compositor layer by cropper.js.
        // Repainting full-width and full-height canvas strips on every mouse
        // move makes ultrawide selections expensive.
        add(state.cursor.x - 12, state.cursor.y - 12, 180, 40);
      }
      if (state.brushBounds) {
        // A brush stroke can jump several pixels between pointer events. Dirty
        // the complete accumulated path so no old segment is left behind while
        // the canvas is being clipped to small repaint regions.
        add(
          state.brushBounds.x,
          state.brushBounds.y,
          state.brushBounds.w,
          state.brushBounds.h
        );
      }
    }
    return regions;
  }
  if (typeof module !== 'undefined') module.exports = damage;
  else root.cropperDamage = damage;
})(globalThis);
