import { t } from '../i18n'

const template = document.createElement('template')
template.innerHTML = `<span></span>`

const formatStr = (str: string, ...args: (string | number)[]) =>
  str.replace(/{(\d+)}/g, (match, number) =>
    typeof args[number] !== 'undefined' ? args[number].toString() : match
  )

class DateComponent extends HTMLElement {
  constructor() {
    super()
    const tC = template.content
    this.attachShadow({ mode: 'open' }).appendChild(tC.cloneNode(true))
  }

  connectedCallback() {
    const date = new Date(+this.getAttribute('unix') * 1000)
    const dateStr = date.toLocaleString()
    const diff = new Date().getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / (3600000 * 24))
    const weeks = Math.floor(diff / (3600000 * 24 * 7))
    const months = Math.floor(diff / (3600000 * 24 * 30))
    // eslint-disable-next-line no-console
    // console.table({ weeks, days, hours, minutes, seconds })
    let formatted: string
    if (seconds < 60) {
      formatted = formatStr(t('{0} seconds ago'), seconds)
    } else if (minutes < 60) {
      formatted = formatStr(t('{0} minutes ago'), minutes)
    } else if (hours < 24) {
      formatted = formatStr(t('{0} hours ago'), hours)
    } else if (days < 7) {
      formatted = formatStr(t('{0} days ago'), days)
    } else if (weeks < 5) {
      formatted = formatStr(t('{0} weeks ago'), weeks)
    } else if (months < 12) {
      formatted = formatStr(t('{0} months ago'), months)
    } else {
      formatted = dateStr
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
    `
  }

  // disconnectedCallback() {}
}
customElements.define('schaerweb-date', DateComponent)
