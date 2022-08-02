const css = String.raw
const html = String.raw

const styleContent = css`
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
    height: var(--titlebar-height);
    left: 0;
    line-height: var(--titlebar-height);
    margin: 0;
    padding: 0 var(--spacer);
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 1000;
  }

  .close {
    background: transparent;
    border: 0;
    color: var(--fg);
    display: block;
    height: var(--titlebar-height);
    margin: 0;
    position: fixed;
    right: 0;
    top: 0;
    width: var(--titlebar-height);
    z-index: 1010;
  }
}
`

// Web Component
const templateEl = document.createElement('template')
templateEl.innerHTML = html`
  <style>${styleContent}</style>
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
    const tC = templateEl.content
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
