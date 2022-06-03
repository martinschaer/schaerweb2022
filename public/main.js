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
  var formatStr = (str, ...args) => str.replace(/{(\d+)}/g, (match, number) => typeof args[number] !== "undefined" ? args[number].toString() : match);
  var DateComponent = class extends HTMLElement {
    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }
    connectedCallback() {
      const date = new Date(+this.getAttribute("unix") * 1e3);
      const diff = new Date().getTime() - date.getTime();
      const seconds = Math.floor(diff / 1e3);
      const minutes = Math.floor(diff / 6e4);
      const hours = Math.floor(diff / 36e5);
      const days = Math.floor(diff / (36e5 * 24));
      const weeks = Math.floor(diff / (36e5 * 24 * 7));
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
      } else {
        formatted = date.toLocaleString();
      }
      this.shadowRoot.innerHTML = formatted;
    }
  };
  customElements.define("schaerweb-date", DateComponent);

  // <stdin>
  console.log("Hello main.ts");
})();
