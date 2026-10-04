/* Layout overlap check for the records filter card — runs inside agent-browser eval. */
(() => {
  const card = [...document.querySelectorAll("main .grid")].find((g) => g.querySelector('[role=combobox]'));
  if (!card) return "FAIL: filter card not found";
  const cardRect = card.getBoundingClientRect();
  const controls = [...card.querySelectorAll('[role=combobox], input#rec-q, button[aria-label="پاک‌کردن فیلترها"]')];
  const rects = controls.map((el) => ({ el: el.getAttribute("aria-label") || el.id || el.textContent?.slice(0, 12), r: el.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, b = rects[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) overlaps.push(`${rects[i].el} × ${rects[j].el} (${ox.toFixed(0)}×${oy.toFixed(0)}px)`);
    }
  }
  const outside = rects.filter((x) => x.r.left < cardRect.left - 1 || x.r.right > cardRect.right + 1);
  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const minCell = Math.min(...rects.map((x) => x.r.width));
  return JSON.stringify({
    viewport: `${innerWidth}x${innerHeight}`,
    controls: rects.length,
    minWidthOfControls: Math.round(minCell),
    overlaps: overlaps.length ? overlaps : "none",
    controlsOutsideCard: outside.length ? outside.map((o) => o.el) : "none",
    pageHorizontalOverflowPx: overflowX,
    verdict: overlaps.length === 0 && outside.length === 0 && overflowX <= 0 ? "PASS" : "FAIL",
  }, null, 1);
})()
