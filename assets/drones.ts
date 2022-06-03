// eslint-disable-next-line no-console
console.log('Hello drones.ts')

type Item = {
  Title: string
  Permalink: string
  Summary: string
  Cover: string
  Price: string
  Lastmod: string
  Categories: string[]
}

const loadData = async () => {
  const res = await fetch('/drone-parts/index.json')
  if (res.ok) {
    const data = await res.json()
    return data
  }
  throw Error()
}

const template = document.createElement('template')
// template.innerHTML = `<div></div>`

const render = ({ categories }: { categories: string[] }) => `
  <div>
  ${categories
    .map((x: string) => `<div>${x}</div>`)
    .join('')}
  </div>
`

class DateComponent extends HTMLElement {
  constructor() {
    super()
    const tC = template.content
    this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
  }

  connectedCallback() {
    loadData().then((data) => {
      const categories: string[] = []
      data.forEach((item: Item) => {
        item.Categories.forEach((category: string) => {
          if (!categories.includes(category)) categories.push(category)
        })
      })
      if (this.shadowRoot) this.shadowRoot.innerHTML = render({ categories })
    })
  }

  // disconnectedCallback() {}
}
customElements.define('schaerweb-drones', DateComponent)
