---
pageid: feature-outline-view
title: Outline View
layout: docs
permalink: /docs/features/outline-view/
---

Nuclide provides an Outline View to allow for quick navigation of a code file. This can be
particularly useful for lengthy files with many classes, functions, methods, etc.

![](/static/images/docs/feature-outline-view.png)

* TOC
{:toc}

## Toggling

To toggle the **Outline View** panel, you can:

- Press `Option-O` (`Alt-O` on Linux).
- Go to the `Nuclide | Outline View | Toggle` menu.
- Click on the **Outline View** [button](/docs/features/toolbar/#buttons) within the Nuclide [toolbar](http://nuclide.io/docs/features/toolbar/).
- Use the **Try It** button associated with the **Outline View** [Quick Launch](/docs/quick-start/getting-started/#quick-launch-menu) menu in the Nuclide Home tab.

## Navigation

Clicking on any entity in the Outline View will bring you to the line in Nuclide that represents the
beginning of the definition for that entity. For example, clicking on
`function withDestinationPath` in the outline view will bring you to line 44 in the file that
defines that function.

![](/static/images/docs/feature-outline-view-click.png)

> Outline View currently supports Hack, PHP, Flow, JavaScript, Python, C++ and JSON files. If you
> have Outline View opened for a file that is not supported, you will see a message similar to
> *"Outline view does not currently support..."*

## Requirements

In order for the Outline View to work correctly, the following are required for specific languages:

- **Hack**: The [Hack typechecker](/docs/languages/hack/#installing-hack), `hh_client`.
- **Flow**: The [Flow typechecker](/docs/languages/flow/#installing-flow), `flow`.
- **Python**: A working installation of [Python](https://www.python.org/), `python`.
- **C++**: One of the [compilers necessary for C++ Nuclide support](/docs/languages/cpp/#supported-compilers).
