import { prologueSlides } from "./prologue-data.js";

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** A modal, page-local opening: returning from a level never interrupts the menu. */
export class OpeningStory {
  active = true;
  private index = 0;
  private readonly dialog = element<HTMLDialogElement>("prologue-dialog");
  private readonly next = element<HTMLButtonElement>("prologue-next");
  private readonly back = element<HTMLButtonElement>("prologue-back");
  private readonly listeners = new AbortController();

  constructor(private readonly complete: () => void) {
    const options = { signal: this.listeners.signal };
    this.next.addEventListener("click", () => this.advance(), options);
    this.back.addEventListener("click", () => this.previous(), options);
    element("prologue-skip").addEventListener("click", () => this.finish(), options);
    this.dialog.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!(event.target as HTMLElement).closest("button")) this.advance();
    }, options);
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.finish();
    }, options);
    document.addEventListener("keydown", (event) => {
      if (!this.active) return;
      if (event.key === "ArrowRight") { event.preventDefault(); this.advance(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); this.previous(); }
    }, options);
    this.render();
    this.dialog.showModal();
    this.next.focus({ preventScroll: true });
  }

  destroy() {
    this.listeners.abort();
    this.dialog.close();
  }

  private render() {
    const slide = prologueSlides[this.index];
    this.dialog.dataset.slide = String(this.index + 1);
    element("prologue-kicker").textContent = slide.kicker;
    element("prologue-title").textContent = slide.title;
    element("prologue-text").textContent = slide.text;
    element("prologue-art").style.backgroundPosition = slide.position;
    element("prologue-art").setAttribute("aria-label", slide.imageLabel);
    element("prologue-progress").textContent = `${this.index + 1} / ${prologueSlides.length}`;
    this.back.disabled = this.index === 0;
    this.next.textContent = this.index === prologueSlides.length - 1 ? "В главное меню →" : "Дальше →";
    this.dialog.scrollTop = 0;
  }

  private previous() {
    if (!this.active || this.index === 0) return;
    this.index--;
    this.render();
    if (this.back.disabled) this.next.focus({ preventScroll: true });
  }

  private advance() {
    if (!this.active) return;
    if (++this.index === prologueSlides.length) this.finish();
    else this.render();
  }

  private finish() {
    if (!this.active) return;
    this.active = false;
    this.dialog.close();
    document.body.classList.remove("in-prologue");
    element("app").hidden = false;
    element("app").inert = false;
    this.complete();
    (document.querySelector<HTMLButtonElement>(".level:not(:disabled)") ?? element("sound")).focus({ preventScroll: true });
  }
}
