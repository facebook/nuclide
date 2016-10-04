---
pageid: language-flow
title: Flow
layout: docs
permalink: /docs/languages/flow/
---

Nuclide has deep, built-in support for [Flow-enabled](http://flowtype.org) JavaScript.

>Flow recently became supported on Windows.  See the [Windows is Supported!](https://flowtype.org/blog/2016/08/01/Windows-Support.html) Flow blog post for more information.

<br/>

* TOC
{:toc}

## Installing Flow

In order to fully use the integration of Flow, you must have Flow installed on your system:

1. [Install Flow](http://flowtype.org/docs/getting-started.html#installing-flow).
2. If you are new to Flow, [five simple example](http://flowtype.org/docs/five-simple-examples.html) can get you started writing Flow programs. The
key items of note are:
   * The `flow` path is in your `$PATH` environment variable. If it is not in your `$PATH` environment variable for any reason, you can specify the
   path to the `flow` binary in `Settings | Packages | Nuclide | Settings | nuclide-flow: Path to Flow Executable`.
   * You have an empty `.flowconfig` file in the root of your project.
   * You have `/* @flow */` at the top of your JavaScript (`.js`) file.

## Features

Flow's integration into Nuclide provides you with productivity features such as:

* [Code Diagnostics](#features__code-diagnostics) (e.g., inline Flow errors)
* [Autocomplete](#features__autocomplete)
* [Jump to Definition](#features__jump-to-definition)
* [Inline (mouseover) type hinting](#features__type-hinting)

> These features will not work properly unless you are working with Flow-enabled JavaScript since
> they require a `.flowconfig` file in your project root and the ability to run the Flow
> typechecker (e.g., `flow`) from the project root.

### Code Diagnostics

If you write code that doesn't pass the Flow typechecker, Nuclide will provide you error details in
both its [Code Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) pane and inline
within the [Editing Area](/docs/editor/basics/#editing-area).

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

For example, if you want to go to the definition of `arr_length()`, hover over
`arr_length()`and either press `Cmd-<mouse click>` (`Ctrl-<mouse click>` on Linux) or
`Cmd-Option-Enter` (`Ctrl-Alt-Enter` on Linux).

![](/static/images/docs/language-flow-jump-to-definition-link.png)

![](/static/images/docs/language-flow-jump-to-definition-result.png)

### Type Hinting

If you hover over a variable in your Flow file, you can get the type of the variable directly
inline.

![](/static/images/docs/language-flow-typehint.png)

In fact, you can even pin that type hint so that it always displays. Just click on the pin icon
when hovering over a variable to pin it.

​​![](/static/images/docs/language-flow-pinned-typehint.png)

The highlighted variables show that their type variables have been pinned. If you hover over the
type hint, its associated variable will have motion in its highlight.

Click the `x` icon of a pinned type hint to remove it.

> Pinned type hints can be moved anywhere within the editor.

## Debugging

The debugging of Flow through Node is a cornerstone of Nuclide. It serves as the example for
the [Debugger](/docs/features/debugger/) at large and is described in the [Debugger Basics](/docs/features/debugger/#basics).
