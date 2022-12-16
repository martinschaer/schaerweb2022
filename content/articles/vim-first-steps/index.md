---
title: "Vim First Steps"
date: 2022-12-16T16:41:50-06:00
tags:
- vim
- dev
---

## Normal mode

- <kbd>A</kbd>: enters insert mode at the end of the line
- <kbd>dd</kbd>: delete the while line
- <kbd>gg</kbd> and <kbd>G</kbd>: go to the top and the bottom of the document
- <kbd>control+u</kbd> y<kbd>control+d</kbd>: jump a few lines to the top and the bottom
- <kbd>*</kbd>: mark the word under the cursor, and with <kbd>n</kbd> jumps to the next occurrence of the same word
- <kbd>o</kbd> and <kbd>O</kbd>: insert new line after and before the current one
- <kbd>yy</kbd>: yanks the whole line, thus <kbd>yyp</kbd> is for duplicating a line
- <kbd>ciw</kbd>: (read it like: Change Inside Word) to delete the word under the cursor and enter insert mode. Use <kbd>ci"</kbd> to Change Inside Quotes, <kbd>ci(</kbd> to Change Inside Parenthesis, etc… You can also delete instead of change by doing <kbd>di"</kbd>.

## Select mode

- <kbd>o</kbd>: jumps to the other end of the selection
- <kbd>c</kbd>: to delete the current selection and enter insert mode

