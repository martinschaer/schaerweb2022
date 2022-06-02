import Game from '../game/game'

const style = `
:host {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

#hud {
  position: absolute;
  top: 3rem;
  right: 0;
  background-color: var(--color-accent-alpha-50);
  padding: 1rem;
  min-width: 10rem;
}
`

// Web Component
;(function register() {
  const template = document.createElement('template')
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
    </div>
`

  class GameComponent extends HTMLElement {
    game: Game

    constructor() {
      super()
      const tC = template.content
      this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
    }

    connectedCallback() {
      this.game = new Game(this.shadowRoot)
      this.game.run()
    }

    // disconnectedCallback() {}
  }
  customElements.define('schaerweb-game', GameComponent)
})()
