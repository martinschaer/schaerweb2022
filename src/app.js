import decomp from 'poly-decomp'
import './styles/main.scss'
import './components/game.component.ts'

window.decomp = decomp

// eslint-disable-next-line no-console
console.log('Hello World')

document.querySelector('.layout__main').innerHTML = '<schaerweb-game />'
