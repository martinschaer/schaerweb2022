import 'aframe'

const renderAFrame = () => {
  const scene = `<a-plane position="0 0 -4" rotation="-90 0 0" width="6" height="6" color="#1c221f"></a-plane>
<a-assets>
  <a-asset-item id="carModel" src="/f1.gltf"></a-asset-item>
</a-assets>
<a-entity id="car" position="0 0 -4" rotation="0 -45 0" gltf-model="#carModel"></a-entity>
    `
  return `<a-scene stats embedded webxr="optionalFeatures:  hit-test;" ar-hit-test="target:#car;" style="height: 400px">${scene}</a-scene>`
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
