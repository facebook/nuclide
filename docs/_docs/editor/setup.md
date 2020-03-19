---
pageid: editor-setup
title: Setup
layout: docs
permalink: /docs/editor/setup/
---

There are two supported platforms for Nuclide, [Linux](#linux) and [macOS](#macos).

> Nuclide can be installed on [Windows](#windows), but it is
> [not fully supported](https://github.com/facebook/nuclide/issues/321).

These instructions are for installing the released package of Nuclide. For advanced users, you can
[build from source](/docs/advanced-topics/building-from-source), but this is not officially
supported and stability is not guaranteed.

* TOC
{:toc}

## Quick Install

<p class="atom"></p>

Assuming you have met all the prerequisites for your platform, the easiest way to install Nuclide is within Atom itself:

1. Open Atom.
2. Choose `Atom | Preferences` (`Edit | Preferences` on Linux and `File | Settings` on Windows) to bring up the **Settings** tab.
3. In the **Settings** tab, select **Install** from the list at the left.
4. In the search box, type "Nuclide" and press the `Enter` key.
5. Click the **Install** button for the `nuclide` package.

> Installing Nuclide within the Atom Packages UI is the recommended method, however you can install Nuclide from the command-line, if you wish, using:
>
```bash
$ apm install nuclide
```
>

Otherwise, see your installation platform below for detailed installation instructions, including
prerequisites.

## macOS

### Prerequisites

<p class="atom"></p>

You can follow the [instructions on the Atom website](http://flight-manual.atom.io/getting-started/sections/installing-atom/#platform-mac). Essentially,
if you go to [Atom.io](https://atom.io/), there will be direct link to download Atom.

### Installation

Install Nuclide through the Atom Packages UI:

1. Open Atom.
2. Choose `Atom | Preferences` to bring up the **Settings** tab.
3. In the **Settings** tab, select **Install** from the list at the left.
4. In the search box, type "Nuclide" and press the `Enter` key.
5. Click the **Install** button for the `nuclide` package.

![](/static/images/docs/editor-setup-atom-install-nuclide.png)

> Installing Nuclide within the Atom Packages UI is the recommended method, however you can install Nuclide from the command-line, if you wish, using:
>
```bash
$ apm install nuclide
```
>

## Linux

### Prerequisites

<p class="atom"></p>

>Git is required to install Atom on Linux.

There are [instructions on the Atom website](http://flight-manual.atom.io/getting-started/sections/installing-atom/#platform-linux) for installing Atom on Linux, but it doesn't mention the Git requirement.

Instead, follow the command-line process below which shows you the installation of all the
necessary prerequisites, including Git.

This is an installation on Ubuntu. If you are using an RPM-based distro, you should replace the
`apt-get` commands with the appropriate `rpm` or `yum` commands. Depending on your permissions, you
may need to prefix these commands with `sudo`.

```bash
$ sudo apt-get update
# optional
$ sudo apt-get upgrade
$ sudo apt-get install git
$ sudo add-apt-repository ppa:webupd8team/atom
$ sudo apt-get update
$ sudo apt-get install atom
# Run atom from the command-line if you want
$ atom
```

### Installation

Install Nuclide through the Atom Packages UI:

1. Open Atom.
2. Choose `Edit | Preferences` to bring up the **Settings** tab.
3. In the **Settings** tab, select **Install** from the list at the left.
4. In the search box, type "Nuclide" and press the `Enter` key.
5. Click the **Install** button for the `nuclide` package.

> Installing Nuclide within the Atom Packages UI is the recommended method, however you can install Nuclide from the command-line, if you wish, using:
>
```bash
$ apm install nuclide
```
>

## Windows

### Prerequisites

Atom can be installed on Windows.

<p class="atom"></p>

You can follow the [instructions on the Atom website](http://flight-manual.atom.io/getting-started/sections/installing-atom/#platform-windows). Essentially,
if you go to [Atom.io](https://atom.io/), there will be direct link to download Atom.

>Some features of Nuclide may work on Windows, but the full Nuclide experience is [not yet supported](https://github.com/facebook/nuclide/issues/321).
>
>[Remote development](/docs/features/remote) functionality (seeing the directory tree, editing remote files, etc.) is generally successful on Windows. If you have [Hack](/docs/languages/hack) or [Flow](/docs/languages/flow) on a remote server, it is possible that you could get some of those language integrations to work as well.
>
>However, local projects may run into issues.

### Installation

Install Nuclide through the Atom Packages UI:

1. Open Atom.
2. Choose `File | Settings` to bring up the **Settings** tab.
3. In the **Settings** tab, select **Install** from the list at the left.
4. In the search box, type "Nuclide" and press the `Enter` key.
5. Click the **Install** button for the `nuclide` package.

![](/static/images/docs/editor-setup-atom-install-windows.png)

## Post Installation

After installation, running Atom will automatically load Nuclide.

### Recommended Packages

By default, Nuclide does not install all of the recommended Atom packages that enhance the Nuclide
experience. This was done purposely in order to ensure that users have to opt-in to some features
rather than obtrusively modify their work environment.

Recommended packages include:

- [`tool-bar`](https://atom.io/packages/tool-bar) to enable the [Nuclide toolbar](/docs/features/toolbar/).
- [`sort-lines`](https://atom.io/packages/sort-lines) to enable sorting lines of text.
- [`language-ocaml`](https://atom.io/packages/language-ocaml) to enable [OCaml](/docs/languages/other/#ocaml) language syntax highlighting.
- [`language-babel`](https://atom.io/packages/language-babel) to enable language grammar for [JS, Flow and React JS](/docs/languages/flow/), etc.
- ...and [others](https://github.com/facebook/nuclide/blob/master/package.json) under `package-deps`.

<br />
In order to install all of the recommended packages:

1. Go to `Packages | Settings View | Manage Packages`.
2. Search for the `nuclide` package, and click on the package's **Settings** button.
3. Select the **Install Recommended Packages on Startup** checkbox.

![](/static/images/docs/editor-setup-recommended-packages.png)

### Installing Nuclide Server

If you want to use Nuclide for remote development, you'll also need to set up the `npm nuclide`
package. Instructions can be found in the [Remote Development docs](/docs/features/remote/).

### Other Installations

To benefit from all of Nuclide's features, we recommend you also install the following:

* [Watchman](https://facebook.github.io/watchman/) - version 3.2 or above. It must be in `/usr/local/bin/` or in your `$PATH` environment variable.

>Without Watchman, Nuclide will lose some functionality of its [Mercurial](/docs/features/hg), [Remote Development](/docs/features/remote), and [Quick Open](/docs/quick-start/getting-started/#quick-open) features.

<br />

* [Flow](/docs/languages/flow/)
* [Hack](/docs/languages/hack/)
* [Mercurial](/docs/features/hg/)
