/**
 * Shared drag-to-reposition behavior for the module's standalone HUD widgets
 * (Party Overview, Countdown Tracker) — both anchor `bottom`/`left` instead
 * of Foundry's own `top`/`left` window positioning, so dragging tracks
 * distance from the viewport's bottom/left edges rather than its top/left
 * one. Position is clamped so the element can never be dragged fully
 * offscreen. Each drag session's `mousemove`/`mouseup` listeners are fresh
 * closures added and removed by the same reference within this function, so
 * there's no bound-method identity to manage on the caller's side.
 */
export function attachHudDragHandle(handle, element, { getLocked, onDragStart, onDragEnd } = {}) {
  handle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (getLocked?.()) return;
    event.preventDefault();

    const rect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left;
    const startBottom = window.innerHeight - rect.bottom;
    const width = rect.width;
    const height = rect.height;

    onDragStart?.();

    const onMove = (moveEvent) => {
      const maxLeft = Math.max(0, window.innerWidth - width);
      const maxBottom = Math.max(0, window.innerHeight - height);
      const newLeft = Math.max(0, Math.min(startLeft + (moveEvent.clientX - startX), maxLeft));
      const newBottom = Math.max(0, Math.min(startBottom - (moveEvent.clientY - startY), maxBottom));
      element.style.left = `${newLeft}px`;
      element.style.bottom = `${newBottom}px`;
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const finalRect = element.getBoundingClientRect();
      onDragEnd?.({ left: finalRect.left, bottom: window.innerHeight - finalRect.bottom });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}
