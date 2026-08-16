import Game from "../game/game";

const style = `
:host {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  overflow: hidden;
}

#hud {
  position: absolute;
  top: 3rem;
  right: 0;
  background-color: var(--color-accent-alpha-50);
  padding: 1rem;
  min-width: 10rem;
}

#handling {
  margin-top: 0.5rem;
}

#handling label {
  display: block;
}

#handling input[type="number"] {
  width: 6rem;
}

#presets {
  display: flex;
  gap: 0.25rem;
}
`;

// Web Component
(function register() {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>${style}</style>
    <div id="hud">
      <div>
        <select id="circuit">
          <option disabled="disabled">⤹ ▞▞▞ Select a circuit ▞▞▞</option>
        </select>
      </div>
      <div>Last lap: <span id="last-lap">–</span></div>
      <div>Best lap: <span id="best-lap">–</span></div>
      <div>Current: <span id="curr-lap">–</span></div>
      <details id="handling">
        <summary>Handling</summary>
        <label>Turn
          <input type="number" id="turn-factor" min="0.005" max="0.05" step="0.001">
        </label>
        <label>Accel
          <input type="number" id="acc-factor" min="0.001" max="0.008" step="0.0001">
        </label>
        <div id="presets"></div>
      </details>
    </div>
`;

  class GameComponent extends HTMLElement {
    game?: Game;

    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }

    connectedCallback() {
      if (!this.shadowRoot) return;
      this.game = new Game(this.shadowRoot);
      this.game.run();
    }

    disconnectedCallback() {
      this.game?.destroy();
    }
  }
  customElements.define("schaerweb-game", GameComponent);
})();
