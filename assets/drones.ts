// eslint-disable-next-line no-console
console.log('Hello drones.ts')

type Item = {
  Title: string
  Permalink: string
  Key: string
  Summary: string
  Cover: string
  Price: string
  Lastmod: string
  Categories: string[]
}

let data: Item[] = []
const selectedKeys = new Set<string>()

const loadData = async () => {
  const res = await fetch('/drone-parts/index.json')
  if (res.ok) {
    data = await res.json()
    return data
  }
  throw Error()
}

const style = `
.drones-app {
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--titlebar-height));
  left: 0;
  position: sticky;
  top: var(--titlebar-height);
  transition-duration: 200ms;
  transition-property: width;
  width: 300px;
  z-index: 100;
}

.drones-app.closed {
  width: 1.5rem;
}

.opener {
  background-color: var(--color-accent);
  box-sizing: border-box;
  color: var(--color-dark);
  cursor: pointer;
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
`

const template = document.createElement('template')
// template.innerHTML = `<div></div>`

const render = () => `
  <style>${style}</style>
  <div class="drones-app">
    <div class="opener">◤ close</div>
    <div class="categories">Loading…</div>
    <div class="drones-app__total">$ 0</div>
  </div>
`

const renderCategories = ({ categories }: { categories: string[] }) => `
  ${categories
    .map(
      (cat: string) => `
  <div class="category">
    <h3 class="category__title" data-key="${cat}">${cat}</h3>
    <ul>
      ${data
        .filter((item) => item.Categories.includes(cat))
        .map(
          (item) => `
      <li class="item" data-key="${item.Key}">
        <div class="item__amount"></div>
        <div class="item__title">${item.Title}</div>
      </li>`
        )
        .join('')}
    </ul>
  </div>
      `
    )
    .join('')}
`

const getSelectedItems = () => {
  const result: Item[] = []
  data.forEach((item) => {
    if (selectedKeys.has(item.Key)) {
      result.push(item)
    }
  })
  return result
}

class DronesComponent extends HTMLElement {
  constructor() {
    super()
    const tC = template.content
    this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
  }

  connectedCallback() {
    loadData().then(() => {
      if (!this.shadowRoot) return
      this.shadowRoot.innerHTML = render()

      // opener
      this.shadowRoot
        ?.querySelector('.opener')
        ?.addEventListener('click', () => this.toggleSidebar())

      // categories
      //
      const categories = new Set<string>()
      data.forEach((item: Item) => {
        item.Categories.forEach((category: string) => {
          categories.add(category)
        })
      })
      const categoriesContainer = this.shadowRoot.querySelector('.categories')
      if (categoriesContainer)
        categoriesContainer.innerHTML = renderCategories({
          categories: [...categories],
        })
      this.injectItems()
      this.shadowRoot
        .querySelectorAll('.category > ul > li.item')
        .forEach((li) => {
          const key = li.getAttribute('data-key') || ''
          const amount = li.querySelector('.item__amount')
          const title = li.querySelector('.item__title')

          amount?.addEventListener('click', () => {
            this.toggleItem(key)
          })

          title?.addEventListener('click', () => {
            const itemEl = document.querySelector(
              `.drone-item[data-key="${key}"]`
            )
            if (itemEl) itemEl.scrollIntoView({ behavior: 'smooth' })
          })
        })
    })
  }

  openSidebar = () => {
    const el = this.shadowRoot?.querySelector('.drones-app')
    if (!el) return
    el.classList.remove('closed')
  }

  toggleSidebar = () => {
    const el = this.shadowRoot?.querySelector('.drones-app')
    if (!el) return
    if (el.classList.contains('closed')) {
      el.classList.remove('closed')
    } else {
      el.classList.add('closed')
    }
  }

  toggleItem = (key: string) => {
    if (selectedKeys.has(key)) {
      selectedKeys.delete(key)
    } else {
      selectedKeys.add(key)
    }
    this.openSidebar()
    this.update()
  }

  injectItems = () => {
    const container = document.querySelector('.article__content')
    container?.querySelectorAll('.drone-item').forEach((x) => {
      const injected = document.createElement('div')
      const btn = document.createElement('button')
      btn.innerText = 'Add'
      btn.addEventListener('click', () => {
        this.toggleItem(x.getAttribute('data-key') || '')
      })
      injected.appendChild(btn)
      x.appendChild(injected)
    })
  }

  // Update
  //
  update = () => {
    // selected items
    //
    this.shadowRoot?.querySelectorAll('.category > ul > li').forEach((li) => {
      const key = li.getAttribute('data-key') || ''
      const amount = li.querySelector('.item__amount')
      if (selectedKeys.has(key)) {
        li.classList.add('active')
        if (amount) amount.innerHTML = '1'
      } else {
        li.classList.remove('active')
        if (amount) amount.innerHTML = ''
      }
    })

    // total
    //
    const totalEl = this.shadowRoot?.querySelector('.drones-app__total')
    if (totalEl)
      totalEl.innerHTML = `$ ${getSelectedItems()
        .reduce((sum: number, x: Item) => sum + +x.Price, 0)
        .toLocaleString()}`
  }

  // disconnectedCallback() {}
}
customElements.define('schaerweb-drones', DronesComponent)

const mountEl = document.createElement('schaerweb-drones')
document.querySelector('#app .paper')?.appendChild(mountEl)
