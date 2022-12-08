(() => {
  // ns-hugo:/Users/martinschaer/Projects/schaerweb/schaerweb2022/assets/i18n.ts
  var dict = {
    en: {
      "{0} seconds ago": "{0} seconds ago",
      "{0} minutes ago": "{0} minutes ago",
      "{0} hours ago": "{0} hours ago",
      "{0} days ago": "{0} days ago",
      "{0} weeks ago": "{0} weeks ago"
    },
    es: {
      "{0} seconds ago": "hace {0} segundos",
      "{0} minutes ago": "hace {0} minutos",
      "{0} hours ago": "hace {0} horas",
      "{0} days ago": "hace {0} d\xEDas",
      "{0} weeks ago": "hace {0} semanas"
    }
  };
  var I18n;
  ((I18n2) => {
    let language = "en";
    I18n2.setLanguage = (lang) => {
      language = lang;
    };
    I18n2.t = (s, lang) => {
      let l = lang ?? language;
      const sepIndex = l.indexOf("-");
      if (dict[l] === void 0 && sepIndex !== -1) {
        l = l.substring(0, sepIndex);
      }
      const translated = dict[l]?.[s];
      if (!translated) {
        console.warn(`i18n|${s}|${l}`);
      }
      return translated ?? s;
    };
  })(I18n || (I18n = {}));
  var { t, setLanguage } = I18n;

  // ns-hugo:/Users/martinschaer/Projects/schaerweb/schaerweb2022/assets/components/date.component.ts
  var template = document.createElement("template");
  template.innerHTML = `<span></span>`;
  var formatStr = (str, ...args) => str.replace(
    /{(\d+)}/g,
    (match, number) => typeof args[number] !== "undefined" ? args[number].toString() : match
  );
  var DateComponent = class extends HTMLElement {
    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }
    connectedCallback() {
      const date = new Date(+this.getAttribute("unix") * 1e3);
      const dateStr = date.toLocaleString();
      const diff = new Date().getTime() - date.getTime();
      const seconds = Math.floor(diff / 1e3);
      const minutes = Math.floor(diff / 6e4);
      const hours = Math.floor(diff / 36e5);
      const days = Math.floor(diff / (36e5 * 24));
      const weeks = Math.floor(diff / (36e5 * 24 * 7));
      const months = Math.floor(diff / (36e5 * 24 * 30));
      let formatted;
      if (seconds < 60) {
        formatted = formatStr(t("{0} seconds ago"), seconds);
      } else if (minutes < 60) {
        formatted = formatStr(t("{0} minutes ago"), minutes);
      } else if (hours < 24) {
        formatted = formatStr(t("{0} hours ago"), hours);
      } else if (days < 7) {
        formatted = formatStr(t("{0} days ago"), days);
      } else if (weeks < 5) {
        formatted = formatStr(t("{0} weeks ago"), weeks);
      } else if (months < 12) {
        formatted = formatStr(t("{0} months ago"), months);
      } else {
        formatted = dateStr;
      }
      this.shadowRoot.innerHTML = `
      <style>
      .print\\:block {
        display: none;
      }

      @media print {
        .print\\:hidden {
          display: none;
        }
        .print\\:block {
          display: block;
        }
      }
      </style>
      <span class="print:hidden">${formatted}</span>
      <span class="print:block">${dateStr}</span>
    `;
    }
  };
  customElements.define("schaerweb-date", DateComponent);

  // ns-hugo:/Users/martinschaer/Projects/schaerweb/schaerweb2022/assets/components/titlebar.component.ts
  var css = String.raw;
  var html = String.raw;
  var styleContent = css`
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
`;
  var templateEl = document.createElement("template");
  templateEl.innerHTML = html`
  <style>${styleContent}</style>
  <div class="brand">
    <a href="/">Martin Schaer Web</a>
  </div>
  <slot name="nav"></slot>
  <button class="close">≡</button>
`;
  var TitleBarComponent = class extends HTMLElement {
    $close;
    close;
    constructor() {
      super();
      const tC = templateEl.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
      this.classList.add("closed");
      this.$close = this.shadowRoot && this.shadowRoot.querySelector(".close") || null;
      this.close = () => {
        if (this.classList.contains("closed")) {
          this.classList.remove("closed");
        } else {
          this.classList.add("closed");
        }
      };
    }
    connectedCallback() {
      if (this.$close) {
        this.$close.addEventListener("click", this.close);
      }
    }
    disconnectedCallback() {
      if (this.$close) {
        this.$close.removeEventListener("click", this.close);
      }
    }
  };
  customElements.define("schaerweb-titlebar", TitleBarComponent);

  // <stdin>
  console.log("Hello main.ts");
})();
