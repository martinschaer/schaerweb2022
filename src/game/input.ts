// Replaces p5's keyIsDown(). The physics step polls held keys rather than
// reacting to events, because steering is applied once per fixed step (see
// step() in game.ts) and not once per keydown repeat.

export default class Input {
  private held = new Set<string>();

  private onKeyDown = (event: KeyboardEvent) => {
    this.held.add(event.key);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.held.delete(event.key);
  };

  // Without this, holding an arrow key while switching tabs or windows leaves
  // it "down" forever: the keyup lands on whatever took focus, not on us.
  private onBlur = () => {
    this.held.clear();
  };

  attach() {
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.held.clear();
  }

  isDown(key: string): boolean {
    return this.held.has(key);
  }
}
