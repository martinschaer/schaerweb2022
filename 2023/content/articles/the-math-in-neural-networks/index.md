---
title: "The Math in Neural Networks"
date: 2022-12-16T16:30:13-06:00
images: []
tags:
- AI
---

These are quick notes about this topic that interests me. It's an evolving article, so bare with me while I gather my thoughts and stitch them all together.

## From [ChatGPT](https://chat.openai.com/chat)

There is no single mathematical proof that neural networks work in general. However, there are many mathematical results that provide theoretical guarantees for the performance of neural networks under certain conditions.

One of the key results in the theory of neural networks is the universal approximation theorem, which states that a feedforward neural network with a single hidden layer containing a sufficient number of units can approximate any continuous function to arbitrary accuracy. This theorem provides a theoretical guarantee for the ability of neural networks to learn a wide range of functions, but it does not guarantee that a particular neural network architecture or training algorithm will be able to successfully learn a particular function in practice.

Other mathematical results provide guarantees for the convergence of specific training algorithms for neural networks under certain conditions, such as the convergence of stochastic gradient descent for training feedforward neural networks with smooth loss functions. These results can provide theoretical support for the effectiveness of specific training techniques, but they do not necessarily guarantee the success of these techniques in all cases.

Overall, the mathematical theory of neural networks is an active area of research, and there are many open questions and challenges that remain to be addressed.

## From The Age of Spiritual Machines by Ray Kurzweil

Get cite from the book, where Ray states that you need at least 60% of accuracy in a training set to train a neural network.
