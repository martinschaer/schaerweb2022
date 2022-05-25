import decomp from 'poly-decomp'
import './components/game.component.ts'
import './main'

window.decomp = decomp

// eslint-disable-next-line no-console
console.log('Hello game.js')

document.querySelector('.layout__main').innerHTML =
  '<schaerweb-game></schaerweb-game>'
