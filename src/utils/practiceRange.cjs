const clamp = (value, min, max) => Math.max(min, Math.min(Number.isFinite(value) ? value : min, max));

function movePoint({ a, b, target, value, min, max, fps = 30 }) {
  const step = 1 / fps;
  const snapped = Math.round(value * fps) / fps;
  if (target === 'a') return { a: clamp(snapped, min, Math.max(min, b - step)), b };
  return { a, b: clamp(snapped, Math.min(max, a + step), max) };
}

function playbackBounds(trimStart, trimEnd, duration) {
  const end = duration > 0 ? clamp(trimEnd > 0 ? trimEnd : duration, 0, duration) : Math.max(0, trimEnd || 0);
  return { start: clamp(trimStart, 0, Math.max(0, end - 1 / 60)), end };
}

function preciseTime(value) {
  const millis = Math.round(Math.max(0, value || 0) * 1000);
  return `${Math.floor(millis / 60000)}:${String(Math.floor(millis / 1000) % 60).padStart(2, '0')}.${String(millis % 1000).padStart(3, '0')}`;
}

module.exports = { clamp, movePoint, playbackBounds, preciseTime };
