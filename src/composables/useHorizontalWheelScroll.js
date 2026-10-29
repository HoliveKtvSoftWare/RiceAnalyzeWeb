import { onUnmounted, ref } from 'vue';

/**
 * 横向卡片条的滚轮浏览。
 *
 * 滚轮增量先累加到目标位置，再由 requestAnimationFrame 逐帧逼近；
 * 直接改 scrollLeft 会一次瞬移一大段，观感很生硬。
 * 到达列表两端后不再拦截，滚轮交还给页面继续纵向滚动。
 */
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
    // 收尾阶段直接对齐：scrollLeft 只能落在整数像素上，小于 1px 的缓动没有意义
    if (Math.abs(distance) < 1) {
      el.scrollLeft = target;
      stop();
      return;
    }

    // 按帧间隔折算缓动系数：120Hz 屏上也不会比 60Hz 快一倍
    const dt = lastFrame ? Math.min(48, time - lastFrame) : 16.67;
    lastFrame = time;

    const before = el.scrollLeft;
    el.scrollLeft = before + distance * (1 - Math.pow(0.82, dt / 16.67));

    // 最后几像素的步长被取整抹平后，scrollLeft 不会变化；
    // 此时直接跳到目标，否则动画会一直停在原地、看起来「滚不回去」。
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

    // 触控板横向滑动优先用 deltaX，普通鼠标用 deltaY
    const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!raw) return;

    // Firefox 等浏览器以「行」为单位，换算成像素
    const delta = event.deltaMode === 1 ? raw * 16 : raw;

    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    // 动画进行中以目标位置为基准，多次滚动才能平滑叠加
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
