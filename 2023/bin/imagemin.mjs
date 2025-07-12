#!/usr/bin/env node

import imagemin from 'imagemin'
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminPngquant from 'imagemin-pngquant'

const plugins = [
  imageminMozjpeg(),
  imageminPngquant({
    quality: [0.6, 0.8],
  }),
]

const run = async () => {
  const files = await imagemin(['raw/*.{jpg,png}'], {
    destination: 'raw/optmized',
    plugins,
  })
  // eslint-disable-next-line no-console
  console.log(files)
}

run().then(() => process.exit())

