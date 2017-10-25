---
pageid: feature-outline-view
title: Outline
layout: docs
permalink: /docs/features/outline-view/
---

Nuclide provides a code outline to allow for quick navigation of a code file. This can be
particularly useful for lengthy files with many classes, functions, methods, etc.

<img src="/static/images/docs/feature-outline-view.png" align="middle" style="width:400px" />

* TOC
{:toc}

## Toggling

To toggle the **Outline** panel, you can:

- Press `Option-O` (`Alt-O` on Linux).
- Go to the `View` menu, and select `Toggle Outline`.
- Click on the **Outline** [button](/docs/features/toolbar/#buttons) within the Nuclide [toolbar](http://nuclide.io/docs/features/toolbar/).
- Use the **Try It** button associated with the **Outline** [Quick Launch](/docs/quick-start/getting-started/#quick-launch-menu) menu in the Nuclide Home tab.

## Navigation

Clicking on any entity in Outline will bring you to the line in Nuclide that represents the
beginning of the definition for that entity. For example, clicking on
`function withDestinationPath` in the outline view will bring you to line 44 in the file that
defines that function.

![](/static/images/docs/feature-outline-view-click.png)

> Outline currently supports Hack, PHP, Flow, JavaScript, Python, C++, JSON, and GraphQL files. If you
> have Outline opened for a file that is not supported, you will see a message similar to
> *"Outline does not currently support..."*

## Requirements

In order for the Outline to work correctly, the following are required for specific languages:

- **Hack**: The [Hack typechecker](/docs/languages/hack/#installing-hack), `hh_client`.
- **Flow**: The [Flow typechecker](/docs/languages/flow/#installing-flow), `flow`.
- **Python**: A working installation of [Python](https://www.python.org/), `python`.
- **C++**: One of the [compilers necessary for C++ Nuclide support](/docs/languages/cpp/#supported-compilers).
