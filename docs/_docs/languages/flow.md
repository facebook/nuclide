---
pageid: language-flow
title: Flow
layout: docs
permalink: /docs/languages/flow/
---

Nuclide has deep, built in support for [Flow-enabled](http://flowtype.org) JavaScript.

<br/>

* TOC
{:toc}

## Flow on Windows

Flow recently became supported on Windows.  See the [Windows is Supported!](https://flowtype.org/blog/2016/08/01/Windows-Support.html) Flow blog post for more information.

## Installing Flow

In order to fully use the integration of Flow, you must have Flow installed on your system:

1. [Install Flow](http://flowtype.org/docs/getting-started.html#installing-flow).
2. If you are new to Flow, you can [follow the steps for writing simple Flow programs](http://flowtype.org/docs/five-simple-examples.html). The
key items of note are:
   * `flow` is on your `$PATH`. If it is not on your `$PATH` for any reason, you can specify the
   path to the `flow` binary in `Settings | Packages | Nuclide | Settings |
   nuclide-flow: Path to Flow Executable`.
   * You have an empty `.flowconfig` file in the root of your project.
   * You have `/* @flow */` at the top of your JavaScript (`.js`) file.

## Features

Flow's integration into Nuclide provides you with productivity features such as:

* [Code Diagnostics](#features__code-diagnostics) (e.g., Flow errors inline)
* [Autocomplete](#features__autocomplete)
* [Jump to Definition](#features__jump-to-definition)
* [Inline (mouse over) typehinting](#features__type-hinting)

> These features will not work properly unless you are working with Flow-enabled JavaScript since
> they require a `.flowconfig` file in your project root and the ability to run the Flow
> typechecker (e.g., `flow`) from the project root.

### Code Diagnostics

If you write code that will not pass the Flow typechecker, Nuclide will provide you error details in
both its [code diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) pane and inline
within the [main text editor](/docs/editor/basics/#editing-area).

![](/static/images/docs/language-flow-code-diagnostics.png)

Hover over the sideways red triangle in the [gutter](/docs/editor/basics/#gutter) to see the Flow
error inline.

![](/static/images/docs/language-flow-code-diagnostics-gutter.png)

### Autocomplete
​​
Given that Nuclide has access to all of the type information within your project along with the
built-in types provided by Flow, autocomplete just works.

![](/static/images/docs/language-flow-autocomplete.png)

### Jump To Definition

Nuclide provides a jump to definition/symbol feature for Flow programs.

For example, if you want to go to the definition of `arr_length()`, you will hover over
`arr_length()`and either press `cmd-<mouse click>` (`ctrl-<mouse click>` on Linux) or
`cmd-option-Enter` (`ctrl-alt-Enter` on Linux).

![](/static/images/docs/language-flow-jump-to-definition-link.png)

![](/static/images/docs/language-flow-jump-to-definition-result.png)

### Type Hinting

If you hover over a variable in your Flow file, you can get the type of the variable directly
inline.

![](/static/images/docs/language-flow-typehint.png)

In fact, you can even pin that type hint so that it always shows as well. Just click on the pin
when hovering over a variable and it will be pinned.

​​![](/static/images/docs/language-flow-pinned-typehint.png)

The highlighted variables show that their type variables have been pinned. If you hover over the
type hint, its associated variable will have motion in its highlight.

Click the `x` to remove the pinned type hint.

> Pinned type hints can be moved anywhere within the editor.

## Debugging

The debugging of Flow through Node is a cornerstone of Nuclide. It serves as the example for
the [debugger](/docs/features/debugger/) at large, and is
[described there](/docs/features/debugger/#basics).
