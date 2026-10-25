type Line = { speaker: string; name: string; text: string };
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Native modality keeps mouse, touch and keyboard input away from the canvas. */
export class IntroDialogue {
  private readonly dialog = element<HTMLDialogElement>("intro-dialog");
  private readonly next = element<HTMLButtonElement>("dialogue-next");
  private lines: Line[] = [];
  private index = 0;
  private complete?: () => void;
  private cancelled?: () => void;

  constructor() {
    this.next.onclick = () => this.advance();
    element("dialogue-skip").onclick = () => this.finish();
    element("dialogue-back").onclick = () => {
      const cancel = this.cancelled;
      this.close();
      cancel?.();
    };
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      element("dialogue-back").click();
    });
    this.dialog.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest("button")) this.advance();
    });
  }

  open(context: string, lines: Line[], complete: () => void, cancelled: () => void) {
    this.close();
    if (!lines.length) {
      complete();
      return;
    }
    this.lines = lines;
    this.index = 0;
    this.complete = complete;
    this.cancelled = cancelled;
    const boss = lines.some((line) => line.speaker === "boss");
    this.dialog.dataset.opponent = boss ? "boss" : "bandit";
    element("dialogue-enemy-name").textContent = boss ? "Главарь" : "Бандит";
    element("dialogue-enemy-portrait").setAttribute("aria-label", boss ? "Портрет главаря" : "Портрет бандита");
    element("dialogue-context").textContent = context;
    this.render();
    document.body.classList.add("in-dialogue");
    this.dialog.showModal();
    this.next.focus({ preventScroll: true });
  }

  close() {
    this.complete = undefined;
    this.cancelled = undefined;
    this.lines = [];
    this.dialog.close();
    document.body.classList.remove("in-dialogue");
  }

  private render() {
    const line = this.lines[this.index];
    this.dialog.dataset.speaker = line.speaker;
    element("dialogue-hero").setAttribute("aria-current", String(line.speaker === "hero"));
    element("dialogue-enemy").setAttribute("aria-current", String(line.speaker !== "hero"));
    element("dialogue-speaker").textContent = line.name;
    element("dialogue-line").textContent = line.text;
    element("dialogue-progress").textContent = `${this.index + 1} / ${this.lines.length}`;
    this.next.textContent = this.index === this.lines.length - 1 ? "Начать перестрелку" : "Дальше →";
  }

  private advance() {
    if (!this.dialog.open) return;
    if (++this.index === this.lines.length) this.finish();
    else this.render();
  }

  private finish() {
    if (!this.dialog.open) return;
    const complete = this.complete;
    this.close();
    complete?.();
  }
}
