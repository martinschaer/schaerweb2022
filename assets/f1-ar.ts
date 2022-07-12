import 'aframe'

const carAnimation =
  'property: rotation; to: 0 360 0; loop: true; dur: 40000; easing: linear;'

const renderAFrame = () => {
  const scene = `
<a-assets>
  <a-asset-item id="carModel" src="/f1.gltf"></a-asset-item>
</a-assets>
<a-entity id="car" position="0 0 -4" rotation="0 -45 0" gltf-model="#carModel" animation="${carAnimation}"></a-entity>
    `
  return `<a-scene embedded webxr="optionalFeatures: hit-test;" ar-hit-test="target:#car;" style="height: 400px">${scene}</a-scene>`
}
const generate = async () => {
  let html = ''
  const container = document.querySelector('#ar-container')

  html += renderAFrame()

  const mountEl = document.createElement('div')
  if (container) {
    container.appendChild(mountEl)
  }
  mountEl.innerHTML = html
}

generate()
