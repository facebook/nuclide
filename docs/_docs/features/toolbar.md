---
pageid: feature-toolbar
title: Toolbar
layout: docs
permalink: /docs/features/toolbar/
---

Nuclide customizes the [tool-bar community Atom package](https://atom.io/packages/tool-bar) for its
specific use. The Nuclide Toolbar provides quick launch access to many common features including
the [Debugger](), Diagnostics, etc.

By default, the Nuclide Toolbar is not installed.

> Internally to Facebook the Toolbar is installed, by default. However, at this point, we did not
> want to presume to install other community packages without the user opting in.

<br />

* TOC
{:toc}

## Installing

The Nuclide Toolbar can be installed as part of installing the
[recommended packages](/docs/editor/setup/#post-installation__recommended-packages) through the
Nuclide package settings or it can be installed separately through the normal Atom package
installation process.

### Singular package

If you would prefer not to have all of the recommended Nuclide packages installed, you can install
the Toolbar separately.

1. Go to `Packages | Settings View | Install Packages/Themes`.
2. In the `Search packages` text box, type "tool-bar".<br /><br />
![](/static/images/docs/feature-toolbar-find-package.png)

3. Click the **Install** button for the `tool-bar` package.

The Toolbar will be added to your Nuclide environment (normally either at the top or along the left side of your Atom window).

### Toggling

You can toggle the Nuclide Toolbar either through `Packages | Tool Bar | Toggle` or by pressing `Cmd-Option-T`
(`Ctrl-Alt-T` on Linux).

## Buttons

The Nuclide Toolbar has buttons that, when clicked, take you to a specific feature of Nuclide.

| ![](/static/images/docs/feature-toolbar-button-diagnostics.png) | Toggle [Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) Table |
| ![](/static/images/docs/feature-toolbar-button-outline-view.png) | Toggle [Outline View](/docs/features/outline-view/) |
| <img src="/static/images/docs/feature-toolbar-button-context-view.png" style="width: 60px"/> | Toggle [Context View](/docs/features/context-view) |
| <img src="/static/images/docs/feature-toolbar-button-task-runner.png" style="width: 60px;"/> | Toggle [Task Runner Toolbar](/docs/features/task-runner) |
| <img src="/static/images/docs/feature-toolbar-button-debugger.png" style="width: 60px"/> | Toggle [Debugger](/docs/features/debugger/) |
| ![](/static/images/docs/feature-toolbar-button-test-runner.png) | Toggle Test Runner |
| <img src="/static/images/docs/feature-toolbar-button-console.png" style="width: 60px;"/> | Toggle [Console](/docs/features/debugger/#basics__evaluation) |
| <img src="/static/images/docs/feature-toolbar-button-distraction-free-mode.png" style="width:60px"/> | Toggle [Distraction-Free Mode](/docs/editor/basics/#distraction-free-mode) |
| ![](/static/images/docs/feature-toolbar-button-nuclide-settings.png) | Open [Nuclide Settings](/docs/editor/basics/#preferences-pane) |
| ![](/static/images/docs/feature-toolbar-button-nuclide-health.png) | Toggle [Nuclide health stats](/docs/features/health-statistics/) |


## Uninstalling

You can uninstall the Nuclide Toolbar by following the normal Atom package uninstall mechanism.

1. Go to `Packages | Settings View | Update Packages/Themes`.
2. Click the **Uninstall** button under the `tool-bar` package.

> If you [uninstall Nuclide](/docs/editor/uninstall/), the `tool-bar` package is *not* uninstalled.
