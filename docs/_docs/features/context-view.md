---
pageid: feature-context-view
title: Context View
layout: docs
permalink: /docs/features/context-view/
---

Nuclide provides a Context View to easily navigate between symbol's and their definitions in your code.

<img src="/static/images/docs/feature-context-view.png" align="middle" style="width:400px"/>

<br />

* TOC
{:toc}

## Toggling

To toggle the Context View panel, you can:

1. Press `Cmd-I` (`Ctrl-I` on Linux).
2. Go to the `Nuclide | Context View | Toggle` menu.
3. Click on the **Toggle Context View** [button](/docs/features/toolbar/#buttons) on the [Nuclide toolbar](/docs/features/toolbar).

## Definition Preview

When you click on a symbol in the [Editing Area](/docs/editor/basics/#editing-area), the symbol's definition will be highlighted in the Context View panel.

![](/static/images/docs/feature-context-view-highlight.png)

Clicking on the **Open in main editor** button at the bottom of the Context View panel moves the cursor to that definition be it in the current file or a different one.

> Context View currently supports [Hack](/docs/languages/hack), [Python](/docs/languages/python), [Objective-C](/docs/languages/objective-c/) and [C++](/docs/languages/cpp) files.
