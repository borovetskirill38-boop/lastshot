/** Fit the fixed 960×540 world into the space left by the responsive game UI. */
export function observeGameLayout(
  viewport: HTMLElement,
  frame: HTMLElement,
  resize: (width: number, height: number) => void,
) {
  let pending = 0;
  const fit = () => {
    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;
    if (!availableWidth || !availableHeight) return;
    const width = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * 16 / 9)));
    frame.style.width = `${width}px`;
    frame.style.height = `${width * 9 / 16}px`;
    // Phaser also refreshes canvas bounds so pointer/touch coordinates stay aligned.
    resize(frame.clientWidth, frame.clientHeight);
  };
  const requestFit = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      fit();
    });
  };
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(requestFit);
  observer?.observe(viewport);
  window.addEventListener("resize", requestFit);
  window.visualViewport?.addEventListener("resize", requestFit);
  requestFit();
  return {
    fit,
    destroy() {
      cancelAnimationFrame(pending);
      observer?.disconnect();
      window.removeEventListener("resize", requestFit);
      window.visualViewport?.removeEventListener("resize", requestFit);
    },
  };
}
