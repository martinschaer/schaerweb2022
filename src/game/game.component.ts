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
  color: var(--color-light);
  background-color: var(--color-dark);
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

#leaderboard {
  margin-top: 0.5rem;
  border-top: 1px solid currentColor;
  padding-top: 0.5rem;
}

#board-list {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  counter-reset: rank;
  max-height: 14rem;
  overflow-y: auto;
}

#board-list li {
  counter-increment: rank;
  display: grid;
  grid-template-columns: 1.5rem 1fr auto auto;
  align-items: baseline;
  gap: 0.25rem;
}

#board-list li::before {
  content: counter(rank) ".";
  opacity: 0.6;
}

/* Names come from the database, so they get a hard ceiling rather than being
   trusted to be a sensible width. */
.board-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-time {
  font-variant-numeric: tabular-nums;
}

.board-race,
#board-refresh,
#ghost-own {
  background: none;
  border: 1px solid currentColor;
  color: inherit;
  font: inherit;
  font-size: 0.8em;
  cursor: pointer;
  padding: 0 0.25rem;
}

.board-race[disabled] {
  opacity: 0.5;
  cursor: progress;
}

#board-status,
#ghost-label,
#name-error {
  font-size: 0.85em;
  opacity: 0.8;
}

#ghost-label:empty {
  display: none;
}

#name-entry {
  margin-top: 0.5rem;
  border-top: 1px solid currentColor;
  padding-top: 0.5rem;
}

#name-entry-title {
  font-weight: bold;
}

#name-input {
  width: 100%;
  box-sizing: border-box;
  margin: 0.25rem 0;
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
      <div id="leaderboard" hidden>
        <div>Leaderboard <button type="button" id="board-refresh" title="Refresh">&#8635;</button></div>
        <div id="board-status"></div>
        <ol id="board-list"></ol>
        <div id="ghost-label"></div>
        <button type="button" id="ghost-own" hidden>Race your own ghost</button>
      </div>
      <form id="name-entry" hidden>
        <div id="name-entry-title">New record: <span id="name-entry-time">–</span></div>
        <label>Name
          <input type="text" id="name-input" autocomplete="off" spellcheck="false">
        </label>
        <div id="name-error"></div>
        <button type="submit">Save</button>
        <button type="button" id="name-skip">Skip</button>
      </form>
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
