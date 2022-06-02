console.log("Hello drones.ts")

const loadData = async () => {
  const res = await fetch("/drone-parts/index.json")
  if (res.ok) {
    const data = await res.json()
    console.log(data)
  }
}

loadData()
