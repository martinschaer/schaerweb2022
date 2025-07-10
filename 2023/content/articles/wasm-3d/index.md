---
title: "WASM 3D"
date: 2023-02-12
images: []
tags:
- Dev
- XR
- 3D
- Rust
---

## What is WASM?

WASM is short for Web Assembly.

JavaScript is a high-level interpreted programming language.

- High-level means it's convinient for humans, at the expense of performance (and security).
- An interpreted language differs from a compiled program, in the fact that it requires and intermediary to interpret it, while a compiled program speaks the language of the audience. By nature, a compiled program uses less resources.

For many years browsers were able to interpret JavaScript, making the World Wide Web a dynamic place.

Modern browsers run WASM programs. This opens up new possibilities:

- more performance = more power with the same hardware
- edge computing and edge AI (I believe this is underrated)
- next level SaaS, since more software applications will be able to run in a web environment (e.g. video editing, games, 3D printing)

## Languages

C++, Golang, Rust, or Python…

Rust was the one I chose to train myself into rencenly. Golang is my go-to for microservices that are not that performance dependant. But Rust is the right tool for performance, when finding unique skills is not a problem.

With Rust, I decided to try [three-d](https://github.com/asny/three-d) over [kiss3d](https://github.com/sebcrozet/kiss3d) just because it has a backer that relies on that technology. So far, it has been a very straighforward experience comming from Three.js –appart from the Rust learning curve which is unprecedented.
