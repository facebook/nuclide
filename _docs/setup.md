---
id: setup
title: Setup
layout: docs
permalink: /docs/setup/
---

There are two supported platforms for Nuclide, Linux and Mac OS X. Nuclide can be installed on
Windows, but it is not fully supported; work is in progress.

These instructions are for installing the released package of Nuclide. For advanced users, you can
[build from source](/docs/advanced-topics/building-from-source), but this is not officially supported and
stability is not guaranteed.

Assuming you have met all the prerequisites for your platform, culminating with **Atom 1.4.0 or
greater** being installed, the easiest way to install Nuclide is either at the command line:

```bash
$ apm install nuclide
```

or within Atom itself:

1. Open Atom.
+ Choose `Atom | Preferences` to bring up the `Settings` pane. (on Linux this will be
  `Edit | Preferences`).
+ In the `Settings` pane, click on `Install`.
+ In the search box, type *Nuclide* and press the *enter* key.
+ The package you are looking for is called `nuclide` and should be version `0.111.0` or greater.
+ Click the *Install* button for that package.

Otherwise, choose your installation platform for detailed installation instructions, including
prerequisites:

- [Mac](#mac)
- [Linux](#linux)
- [Windows](#windows)

## Mac

### Prerequisites

Nuclide requires Atom 1.4.0+. You can follow the [instructions on the Atom website](https://atom.io/docs/v0.191.0/getting-started-installing-atom#atom-on-mac). Essentially,
if you go to Atom.io, there will be direct link to download Atom.

### Installation

Installing Nuclide is a one-line command at the command-line:

```bash
$ apm install nuclide
```

Or you can go through the Atom Packages UI to install Atom:

1. Open Atom.
2. Choose `Atom | Preferences` to bring up the `Settings` pane. (on Linux this will be
  `Edit | Preferences`).
3. In the `Settings` pane, click on `Install`.
4. In the search box, type *Nuclide* and press the *enter* key.
5. The package you are looking for is called `nuclide` and should be version `0.111.0` or greater.
6. Click the *Install* button for that package.

## Linux

### Prerequisites

Nuclide requires Atom 1.4.0+ (which requires Git). There are [instructions on the Atom website](https://atom.io/download/deb#atom-on-linux)
to install Atom, but it doesn't mention the Git requirement.

Instead, follow the command line process below which shows you the installation of all the
necessary prerequisites, including Git.

This is an installation on Ubuntu. If you are using an RPM-based distro, you will have replace the
`apt-get` commands with the appropriate `rpm` or `yum` commands. Depending on your permissions, you
may need to prefix these commands with `sudo`.

```bash
$ sudo apt-get update
# optional
$ sudo apt-get upgrade
$ sudo apt-get install git
$ wget https://atom.io/download/deb
$ mv deb atom-amd64.deb  
$ dpkg -i atom-amd64.deb
# Run atom from the command line if you want
$ atom
```

### Installation

Installing Nuclide is a one-line command at the command-line:

```bash
$ apm install nuclide
```

Or you can go through the Atom Packages UI to install Atom:

1. Open Atom.
2. Choose `Edit | Preferences` to bring up the `Settings` pane. (on Linux this will be
  `Edit | Preferences`).
3. In the `Settings` pane, click on `Install`.
4. In the search box, type *Nuclide* and press the *enter* key.
5. The package you are looking for is called `nuclide` and should be version `0.111.0` or greater.
6. Click the *Install* button for that package.

## Windows

Detailed instructions for Windows coming soon.

## Post Installation

After installation, running `Atom` will automatically load Nuclide.

### Installing Nuclide Server

If you want to use Nuclide for remote development, you'll also need to setup the NPM `nuclide`
package. Instructions can be found in the [Remote Development docs](/docs/remote/).

### Other Installations

To benefit from all of Nuclide's features, we recommend you also install the following:

* [Flow](/docs/languages/flow/)
* [Hack](/docs/languages/hack/)
* [Mercurial](/docs/hg/)
* [Watchman](https://facebook.github.io/watchman/) - version 3.2 or above. It must be in
  `/usr/local/bin/` or in your `$PATH`. Without Watchman, Nuclide will lose some functionality: for
  instance, in the
  [hg-repository](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/hg-repository),
  [server](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/server), and
  [quick-open](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/quick-open) packages.
