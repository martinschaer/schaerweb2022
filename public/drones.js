(() => {
  // <stdin>
  console.log("Hello drones.ts");
  var data = [];
  var selectedKeys = /* @__PURE__ */ new Set();
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
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--titlebar-height));
  right: 0;
  position: fixed;
  top: var(--titlebar-height);
  transition-duration: 200ms;
  transition-property: width;
  width: 300px;
  z-index: 100;
}

@media screen and (min-width: 800px) {
  .drones-app {
    position: sticky;
    left: 0;
    right: auto;
  }
}

.drones-app.closed {
  width: 1.5rem;
}

.opener {
  background-color: var(--color-accent);
  box-sizing: border-box;
  color: var(--color-dark);
  cursor: pointer;
  flex-shrink: 0;
  height: 1.5rem;
  line-height: 1.5rem;
  overflow: hidden;
  padding: 0 0.5em;
}

.drones-app__total,
.categories {
  box-sizing: border-box;
  opacity: 1;
  overflow: hidden;
  padding: var(--spacer);
  transition-duration: 200ms;
  transition-property: opacity;
  width: 300px;
}

.drones-app.closed .drones-app__total,
.drones-app.closed .categories {
  opacity: 0;
}

.drones-app__total {
  background-color: var(--color-accent);
  color: var(--color-dark);
  text-align: right;
}

.categories {
  overflow-x: hidden;
  overflow-y: scroll;
}

.category {
  display: flex;
  flex-direction: column;
}

.category__title {
  box-sizing: border-box;
  display: block;
  margin: var(--spacer-50) 0;
  padding: var(--spacer-50) 0;
}

.category > ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.category > ul > li.item {
  align-items: center;
  display: flex;
}

.category > ul > li.item .item__amount {
  border: 1px solid var(--color-border);
  height: 1.5rem;
  line-height: 1.5rem;
  text-align: center;
  width: 1.5rem;
}

.category > ul > li.item .item__title {
  cursor: default;
  opacity: 0.2;
  padding: var(--spacer-50);
}

.category > ul > li.active .item__title {
  background-color: var(--color-paper);
  opacity: 1;
}
`;
  var template = document.createElement("template");
  var render = () => `
  <style>${style}</style>
  <div class="drones-app">
    <div class="opener">\u25E4 close</div>
    <div class="categories">Loading\u2026</div>
    <div class="drones-app__total">$ 0</div>
  </div>
`;
  var renderCategories = ({ categories }) => `
  ${categories.map(
    (cat) => `
  <div class="category">
    <h3 class="category__title" data-key="${cat}">${cat}</h3>
    <ul>
      ${data.filter((item) => item.Categories.includes(cat)).map(
      (item) => `
      <li class="item" data-key="${item.Key}">
        <div class="item__amount"></div>
        <div class="item__title">${item.Title}</div>
      </li>`
    ).join("")}
    </ul>
  </div>
      `
  ).join("")}
`;
  var getSelectedItems = () => {
    const result = [];
    data.forEach((item) => {
      if (selectedKeys.has(item.Key)) {
        result.push(item);
      }
    });
    return result;
  };
  var DronesComponent = class extends HTMLElement {
    constructor() {
      super();
      const tC = template.content;
      this.attachShadow({ mode: "open" }).appendChild(tC.cloneNode(true));
    }
    connectedCallback() {
      loadData().then(() => {
        if (!this.shadowRoot)
          return;
        this.shadowRoot.innerHTML = render();
        this.shadowRoot?.querySelector(".opener")?.addEventListener("click", () => this.toggleSidebar());
        const categories = /* @__PURE__ */ new Set();
        data.forEach((item) => {
          item.Categories.forEach((category) => {
            categories.add(category);
          });
        });
        const categoriesContainer = this.shadowRoot.querySelector(".categories");
        if (categoriesContainer)
          categoriesContainer.innerHTML = renderCategories({
            categories: [...categories]
          });
        this.injectItems();
        this.shadowRoot.querySelectorAll(".category > ul > li.item").forEach((li) => {
          const key = li.getAttribute("data-key") || "";
          const amount = li.querySelector(".item__amount");
          const title = li.querySelector(".item__title");
          amount?.addEventListener("click", () => {
            this.toggleItem(key);
          });
          title?.addEventListener("click", () => {
            const itemEl = document.querySelector(
              `.drone-item[data-key="${key}"]`
            );
            if (itemEl)
              itemEl.scrollIntoView({ behavior: "smooth" });
          });
        });
      });
    }
    openSidebar = () => {
      const el = this.shadowRoot?.querySelector(".drones-app");
      if (!el)
        return;
      el.classList.remove("closed");
    };
    toggleSidebar = () => {
      const el = this.shadowRoot?.querySelector(".drones-app");
      if (!el)
        return;
      if (el.classList.contains("closed")) {
        el.classList.remove("closed");
      } else {
        el.classList.add("closed");
      }
    };
    toggleItem = (key) => {
      if (selectedKeys.has(key)) {
        selectedKeys.delete(key);
      } else {
        selectedKeys.add(key);
      }
      this.openSidebar();
      this.update();
    };
    injectItems = () => {
      const container = document.querySelector(".article__content");
      container?.querySelectorAll(".drone-item").forEach((x) => {
        const injected = document.createElement("div");
        const btn = document.createElement("button");
        btn.innerText = "Add";
        btn.addEventListener("click", () => {
          this.toggleItem(x.getAttribute("data-key") || "");
        });
        injected.appendChild(btn);
        x.appendChild(injected);
      });
    };
    update = () => {
      this.shadowRoot?.querySelectorAll(".category > ul > li").forEach((li) => {
        const key = li.getAttribute("data-key") || "";
        const amount = li.querySelector(".item__amount");
        if (selectedKeys.has(key)) {
          li.classList.add("active");
          if (amount)
            amount.innerHTML = "1";
        } else {
          li.classList.remove("active");
          if (amount)
            amount.innerHTML = "";
        }
      });
      const totalEl = this.shadowRoot?.querySelector(".drones-app__total");
      if (totalEl)
        totalEl.innerHTML = `$ ${getSelectedItems().reduce((sum, x) => sum + +x.Price, 0).toLocaleString()}`;
    };
  };
  customElements.define("schaerweb-drones", DronesComponent);
  var mountEl = document.createElement("schaerweb-drones");
  document.querySelector("#app .paper")?.appendChild(mountEl);
})();
