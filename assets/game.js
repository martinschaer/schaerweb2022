import decomp from 'poly-decomp'
import './components/game.component.ts'
// import './main.ts'

window.decomp = decomp

// eslint-disable-next-line no-console
console.log('Hello game.js')

document.querySelector('#app').appendChild(document.createElement('schaerweb-game'))

