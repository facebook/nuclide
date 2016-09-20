---
pageid: advanced-building-from-source
title: Building Nuclide From Source
layout: docs
permalink: /docs/advanced-topics/building-from-source/
---

It is generally recommended to [install the released package of Nuclide](/docs/setup), but for
those willing to live on the bleeding edge, you can install Nuclide from source.

* TOC
{:toc}

## Mac

### Prerequisites

You must have the [general prerequisites](/docs/editor/setup#mac__prerequisites) installed. In
addition, you must have

- Xcode (for command line tools)
- **Node 5.10.0** or greater
- Atom Shell Commands (open Atom and choose the `Atom | Install Shell Commands` menu item) installed as well.

> Xcode can be installed from the App Store. Installation can take a *long, long* time. So be patient.

> To install Node, the easiest way is to
> [download the latest released Node package](https://nodejs.org) and go through the installer.

You can verify all the appropriate dependencies. All the following should be on your `$PATH`
(usually `usr/bin` or `usr/local/bin`).

```bash
$ git --version
git version 2.5.4 (Apple Git-61)
$ node --version
v5.10.0
$ npm --version
3.8.3
$ apm --version
apm  1.10.0
npm  2.13.3
node 0.10.40
python 2.7.10
git 2.5.4
```

> Don't worry about the `apm` versions of `npm`, etc. Those are internal to `atom`. Used on your
system are the ones associated with `node --version`, etc.

### Building

Run the following commands to build Nuclide from source.

```bash
# Clone the source
$ git clone https://github.com/facebook/nuclide.git
$ cd nuclide
# Install dependencies
$ npm install
# Link the 'nuclide' package to Atom's package directory
$ apm link
```

Verify the installation by:

1. Open Atom.
2. Go to `Atom | Preferences`.
3. Click on `Packages`.
4. Verify `nuclide` as one of the packages.

## Linux

### Prerequisites

You must have the [general prerequisites](/docs/editor/setup#linux__prerequisites) installed. In
addition, you must have **Node 5.10.0** installed as well.

To install Node, see [Node.js's download page](https://nodejs.org/en/download/) for steps that work best for your setup.

You can verify all the appropriate dependencies. All the following should be on your `$PATH`
(usually `usr/bin` or `usr/local/bin`).

```bash
$ git --version
git version 1.9.1
$ node --version
v5.10.0
$ npm --version
3.8.3
$ apm --version
apm  1.10.0
npm  2.13.3
node 0.10.40
python 2.7.6
git 1.9.1
```

Don't worry about the `apm` versions of `npm`, etc. Those are internal to `atom`. Used on your
system are the ones associated with `node --version`, etc.

### Building

Run the following commands to build Nuclide from source.

```bash
# Clone the source
$ git clone https://github.com/facebook/nuclide.git
$ cd nuclide
# Install dependencies
$ npm install
# Link the 'nuclide' package to Atom's package directory
$ apm link
```

Verify the installation by:

1. Open Atom.
2. Go to `File | Preferences`.
3. Click on `Packages`.
4. Verify `nuclide` as one of the packages.

## Windows

Building Nuclide from source is not currently supported on Windows.

> It is possible to build Nuclide from source on Windows, but this is done with no guarantee of
> success. The feature set will also be [limited](/docs/editor/setup/#windows).

## Development Mode

When you open Atom in development mode, either with the `atom --dev` from the command line or with
the `View | Developer | Open in Dev Mode...` command from within the Atom menus, your linked version
of Nuclide will load in place of any other version of Nuclide you might have installed.
