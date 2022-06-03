(() => {
  // <stdin>
  console.log("Hello drones.ts");
  var data = [];
  var loadData = async () => {
    const res = await fetch("/drone-parts/index.json");
    if (res.ok) {
      data = await res.json();
      return data;
    }
    throw Error();
  };
  var style = `
.drones-app {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  padding: var(--spacer-50);
  z-index: 100;
}

button.category {
  padding: var(--spacer-50);
  margin: var(--spacer-50);
}
`;
  var template = document.createElement("template");
  var render = ({ categories }) => `
  <style>${style}</style>
  <div class="drones-app">
    ${categories.map((x) => `<button class="category" data-key="${x}">${x}</button>`).join("")}
  </div>
`;
  var filterItems = (keys) => {
    const container = document.querySelector(".article__content");
    container.querySelectorAll(".drone-item").forEach((x) => x.classList.add("hide"));
    keys.forEach((x) => {
      container.querySelector(`.drone-item[data-key="${x}"]`).classList.remove("hide");
    });
  };
  var onClickCategory = (e) => {
    const category = e.target.getAttribute("data-key");
    const itemKeys = /* @__PURE__ */ new Set();
    data.forEach((item) => {
      if (item.Categories.includes(category))
        itemKeys.add(item.Key);
    });
    filterItems(itemKeys);
  };
  var DronesComponent = class extends HTMLElement {
    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }
    connectedCallback() {
      loadData().then((data2) => {
        const categories = /* @__PURE__ */ new Set();
        data2.forEach((item) => {
          item.Categories.forEach((category) => {
            categories.add(category);
          });
        });
        if (this.shadowRoot) {
          this.shadowRoot.innerHTML = render({ categories: [...categories] });
          filterItems([]);
          this.shadowRoot.querySelectorAll("button.category").forEach((btn) => {
            btn.addEventListener("click", onClickCategory);
          });
        }
      });
    }
  };
  customElements.define("schaerweb-drones", DronesComponent);
  var mountEl = document.createElement("schaerweb-drones");
  document.querySelector("#app .paper")?.appendChild(mountEl);
})();
