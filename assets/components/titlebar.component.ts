const style = `
:host {
  align-items: center;
  display: flex;
  height: var(--titlebar-height);
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  font-size: 0.8rem;
  background-color: var(--color-bg);
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);
}

:host > * {
  margin: var(--spacer);
}

.brand {
  font-weight: bolder;
}

.brand a {
  text-decoration: none;
  color: var(--color-accent);
}

.close {
  display: none;
}

@media screen and (max-width: 800px) {
  :host {
    flex-direction: column;
    font-size: 1rem;
    height: auto;
    position: relative;
  }

  :host(.closed) slot[name=nav] {
    display: none;
  }

  .brand {
    background-color: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    box-sizing: border-box;
    position: fixed;
    height: var(--titlebar-height);
    left: 0;
    margin: 0;
    line-height: var(--titlebar-height);
    padding: 0 var(--spacer);
    top: 0;
    width: 100%;
  }

  .close {
    display: block;
    position: absolute;
    top: 0;
    right: 0;
    margin: 0;
    height: var(--titlebar-height);
    width: var(--titlebar-height);
    border: 0;
    background: transparent;
    color: var(--fg);
  }
}
`

// Web Component
const template = document.createElement('template')
template.innerHTML = `
  <style>${style}</style>
  <div class="brand">
    <a href="/">Martin Schaer Web</a>
  </div>
  <slot name="nav"></slot>
  <button class="close">≡</button>
`

class TitleBarComponent extends HTMLElement {
  $close: HTMLButtonElement | null

  close: () => void

  constructor() {
    super()
    const tC = template.content
    this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
    this.classList.add('closed')

    this.$close =
      (this.shadowRoot &&
        this.shadowRoot.querySelector<HTMLButtonElement>('.close')) ||
      null

    this.close = () => {
      if (this.classList.contains('closed')) {
        this.classList.remove('closed')
      } else {
        this.classList.add('closed')
      }
    }
  }

  connectedCallback() {
    if (this.$close) {
      this.$close.addEventListener('click', this.close)
    }
  }

  disconnectedCallback() {
    if (this.$close) {
      this.$close.removeEventListener('click', this.close)
    }
  }
}

customElements.define('schaerweb-titlebar', TitleBarComponent)
