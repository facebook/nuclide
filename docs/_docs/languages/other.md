---
pageid: language-other
title: PHP, JS, OCaml
layout: docs
permalink: /docs/languages/other/
---

Nuclide provides support for other languages as well. Some of these are not as full-featured as
similar languages (e.g., Hack vs PHP); others are experimental.

* TOC
{:toc}

## PHP

Nuclide's PHP support is similar to its support for [Hack](/docs/languages/hack), except you will
not get as full-featured diagnostics, type hinting, etc. since there is no
[typechecker](https://docs.hhvm.com/hack/typechecker/introduction) to assist Nuclide with your project's metadata.

## JavaScript

Nuclide's JavaScript support is similar to its support for [Flow](/docs/languages/flow), except
you will not get as full-featured diagnostics, type hinting, etc. since there is no
[typechecker](http://flowtype.org/) to assist Nuclide with your project's metadata.
[Debugging through Node](/docs/features/debugger/#basics) is similar to
[Flow](/docs/languages/flow/#debugging) as well.

JavaScript is a primary language for [React Native](https://facebook.github.io/react-native/), and
Nuclide is a great IDE for [developing React Native applications](/docs/platforms/react-native).

## OCaml

This **experimental** feature provides rudimentary support for OCaml via
[ocamlmerlin](https://github.com/the-lambda-church/merlin). Merlin can be installed from source
or by installing the `merlin` OPAM package.

OCaml's integration into Nuclide provides you with productivity features such as:

* Autocomplete
* Jump to Definition

It requires that `ocamlmerlin` be installed on your system and properly configured for your
project. `ocamlmerlin` should be in your `$PATH` environment variable. If it is not, you may specify the path to
`ocamlmerlin` in the settings for the 'nuclide' package.

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-ocaml`, and enter the custom path in the **Path to Merlin Executable** text box.
