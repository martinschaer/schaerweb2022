---
title: "Vim First Steps"
date: 2022-12-16T16:41:50-06:00
tags:
- vim
- dev
---

[Jump to the cheat sheet!](#your-first-cheat-sheet)

## First step, option A: Vim in VS Code

Contrary to the popular belief, learn vim by installing this [VIM extension in VS Code](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim).

## First step, option B

Install an [neovim](https://neovim.io/), or a preconfigured setup like [LunarVim](https://www.lunarvim.org/) (this is the one I'm currently using).

{{< youtube X6AR2RMB5tE >}}

There's a whole [playlist from ThePrimeagen](https://www.youtube.com/playlist?list=PLm323Lc7iSW_wuxqmKx_xxNtJC_hJbQ7R).

## Don't use it to code just yet

Use vim to take notes. Create a Markdown file to write down your daily to-do's. I use it instead of Word with [a plugin that allows me to preview Markdown](https://github.com/iamcco/markdown-preview.nvim) in the browser, from where I can export a PDF.

## Your first cheat sheet:

### Normal mode

- <kbd>A</kbd>: enters insert mode at the end of the line
- <kbd>dd</kbd>: delete the while line
- <kbd>gg</kbd> and <kbd>G</kbd>: go to the top and the bottom of the document
- <kbd>control+u</kbd> y<kbd>control+d</kbd>: jump a few lines to the top and the bottom
- <kbd>*</kbd>: mark the word under the cursor, and with <kbd>n</kbd> jumps to the next occurrence of the same word
- <kbd>o</kbd> and <kbd>O</kbd>: insert new line after and before the current one
- <kbd>yy</kbd>: yanks the whole line, thus <kbd>yyp</kbd> is for duplicating a line
- <kbd>ciw</kbd>: (read it like: Change Inside Word) to delete the word under the cursor and enter insert mode. Use <kbd>ci"</kbd> to Change Inside Quotes, <kbd>ci(</kbd> to Change Inside Parenthesis, etc… You can also delete instead of change by doing <kbd>di"</kbd>.

### Select mode

- <kbd>o</kbd>: jumps to the other end of the selection
- <kbd>c</kbd>: to delete the current selection and enter insert mode

