---
title: "F1 3D model for WebXR"
date: 2022-07-05T07:53:21-06:00
images: ["008.png"]
script: f1-ar.ts
tags:
- F1
- WebXR
- Blender
- 3D
summary: From Blender to WebXR with aframe.io
---

{{< toc >}}

## AR/VR

Notes:

- AR is not available in iOS
- Use WASD to move around
- Click and drag to look around

<div id="ar-container"></div>

## 3D Model

Progress:

{{< figure src="001.png" title="First 3D model iteration" >}}
{{< figure src="002.png" title="Second 3D model iteration" >}}
{{< figure src="003.png" title="Third 3D model iteration" >}}

At this point the mesh was a mess. I wanted to have a cleaner mesh, because that would make it easier to adjust.

So I turned to YouTube and found this amazing tutorial:

{{< youtube VGPvxIrobFE >}}

Then started from scratch and in no time I made this (also I went for a *zero-sidepods* look like the Mercedes team):

{{< figure src="004.png" title="Fourth 3D model iteration" >}}
{{< figure src="005.png" title="Fifth 3D model iteration" >}}
{{< figure src="f1-wireframe-solid.png" title="Wireframe" >}}
{{< figure src="f1-wireframe.png" title="Quads" >}}

{{< figure src="006.png" title="More detail to the side pods" >}}
{{< figure src="007.png" title="Halo and environment image" >}}
{{< figure src="008.png" title="Larger sidepods and some textures" >}}

## F1 VR Room

I used the F1 model to decorate my F1 VR Room: [F1 VR Room](/f1)
