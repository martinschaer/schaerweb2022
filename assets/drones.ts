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
`

const template = document.createElement('template')
// template.innerHTML = `<div></div>`

const render = ({ categories }: { categories: string[] }) => `
  <style>${style}</style>
  <div class="drones-app">
    ${categories
      .map(
        (x: string) => `<button class="category" data-key="${x}">${x}</button>`
      )
      .join('')}
  </div>
`

const filterItems = (keys: string[]) => {
  const container = document.querySelector('.article__content')
  container
    .querySelectorAll('.drone-item')
    .forEach((x) => x.classList.add('hide'))
  keys.forEach((x) => {
    container
      .querySelector(`.drone-item[data-key="${x}"]`)
      .classList.remove('hide')
  })
}

const onClickCategory = (e: MouseEvent) => {
  const category = (e.target as HTMLButtonElement).getAttribute('data-key')
  const itemKeys = new Set<string>()
  data.forEach((item: Item) => {
    if (item.Categories.includes(category)) itemKeys.add(item.Key)
  })
  filterItems(itemKeys)
}

class DronesComponent extends HTMLElement {
  constructor() {
    super()
    const tC = template.content
    this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
  }

  connectedCallback() {
    loadData().then((data) => {
      const categories = new Set<string>()
      data.forEach((item: Item) => {
        item.Categories.forEach((category: string) => {
          categories.add(category)
        })
      })
      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = render({ categories: [...categories] })
        filterItems([])
        this.shadowRoot.querySelectorAll('button.category').forEach((btn) => {
          btn.addEventListener('click', onClickCategory)
        })
      }
    })
  }

  // disconnectedCallback() {}
}
customElements.define('schaerweb-drones', DronesComponent)

const mountEl = document.createElement('schaerweb-drones')
document.querySelector('#app .paper')?.appendChild(mountEl)
