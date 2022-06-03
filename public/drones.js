(() => {
  // <stdin>
  console.log("Hello drones.ts");
  var loadData = async () => {
    const res = await fetch("/drone-parts/index.json");
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    throw Error();
  };
  var template = document.createElement("template");
  var render = ({ categories }) => `
  <div>
  ${categories.map((x) => `<div>${x}</div>`).join("")}
  </div>
`;
  var DateComponent = class extends HTMLElement {
    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }
    connectedCallback() {
      loadData().then((data) => {
        const categories = [];
        data.forEach((item) => {
          item.Categories.forEach((category) => {
            if (!categories.includes(category))
              categories.push(category);
          });
        });
        if (this.shadowRoot)
          this.shadowRoot.innerHTML = render({ categories });
      });
    }
  };
  customElements.define("schaerweb-drones", DateComponent);
})();
