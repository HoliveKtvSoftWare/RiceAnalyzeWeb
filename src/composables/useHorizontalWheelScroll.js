import { onUnmounted, ref } from 'vue';

export function useHorizontalWheelScroll() {
  const stripRef = ref(null);

  let target = 0;
  let raf = null;
  let lastFrame = 0;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function animate(time) {
    const el = stripRef.value;
    if (!el) {
      stop();
      return;
    }

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    target = Math.min(target, max);

    const distance = target - el.scrollLeft;
    if (Math.abs(distance) < 1) {
      el.scrollLeft = target;
      stop();
      return;
    }

    const dt = lastFrame ? Math.min(48, time - lastFrame) : 16.67;
    lastFrame = time;

    const before = el.scrollLeft;
    el.scrollLeft = before + distance * (1 - Math.pow(0.82, dt / 16.67));

    if (el.scrollLeft === before) {
      el.scrollLeft = target;
      stop();
      return;
    }

    raf = requestAnimationFrame(animate);
  }

  function onWheel(event) {
    const el = stripRef.value;
    if (!el || el.scrollWidth <= el.clientWidth) return;

    const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!raw) return;

    const delta = event.deltaMode === 1 ? raw * 16 : raw;

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const base = raf ? target : el.scrollLeft;
    const next = Math.max(0, Math.min(max, base + delta));
    if (next === base) return;

    event.preventDefault();
    target = next;
    if (!raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(animate);
    }
  }

  onUnmounted(stop);

  return { stripRef, onWheel };
}