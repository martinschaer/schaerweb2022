import decomp from 'poly-decomp'
import './components/game.component'
// import './main.ts'

window.decomp = decomp

// eslint-disable-next-line no-console
console.log('Hello game.ts')

const app = document.querySelector('#app')
if (app) app.appendChild(document.createElement('schaerweb-game'))

