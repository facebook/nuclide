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

<ul>
  <li>Xcode (for Command Line Tools)</li>
  <li class="node"></li>
  <li>Atom Shell Commands (open Atom and go to `Atom | Install Shell Commands`) installed as well.</li>
  <li>The <a href="https://yarnpkg.com">Yarn</a> package manager (run <code>npm install -g yarn</code>)</li>
</ul>

> Xcode can be installed from the App Store. Installation can take a *long, long* time. So be patient.

> To install Node, the easiest way is to
> [download the latest released Node package](https://nodejs.org) and go through the installer.

You can verify all the appropriate dependencies. All the following should be in your `$PATH` environment variable (usually `usr/bin` or `usr/local/bin`).

```bash
$ git --version
$ node --version
$ yarn --version
$ apm --version
```

### Building

Run the following commands to build Nuclide from source.

```bash
# Clone the source
$ git clone https://github.com/facebook/nuclide.git
$ cd nuclide
# Install dependencies
$ yarn --pure-lockfile
# Link the 'nuclide' package to Atom's package directory
# You could also use apm link --dev ... see Development Mode below.
$ apm link
```

Verify the installation:

1. Open Atom.
2. Go to `Atom | Preferences`.
3. Click on **Packages**.
4. Verify `nuclide` is one of the packages.

## Linux

### Prerequisites

You must have the [general prerequisites](/docs/editor/setup#linux__prerequisites) installed.

<p class="node"></p>

To install Node, see [Node.js's download page](https://nodejs.org/en/download/) for steps that work best for your setup.

You'll also need the [Yarn](https://yarnpkg.com) package manager (run `npm install -g yarn`).

You can verify all the appropriate dependencies. All the following should be in your `$PATH` environment variable (usually `usr/bin` or `usr/local/bin`).

```bash
$ git --version
$ node --version
$ yarn --version
$ apm --version
```

### Building

Run the following commands to build Nuclide from source.

```bash
# Clone the source
$ git clone https://github.com/facebook/nuclide.git
$ cd nuclide
# Install dependencies
$ yarn --pure-lockfile
# Link the 'nuclide' package to Atom's package directory
# You could also use apm link --dev ... see Development Mode below.
$ apm link
```

Verify the installation:

1. Open Atom.
2. Go to `File | Preferences`.
3. Click on **Packages**.
4. Verify `nuclide` is one of the packages.

## Windows

Building Nuclide from source is not currently supported on Windows.

> It is possible to build Nuclide from source on Windows, but this is done with no guarantee of
> success. The feature set will also be [limited](/docs/editor/setup/#windows).

## Development Mode

If you have another version of Nuclide installed (e.g., the official `apm` package), but you also want to run Nuclide from source, you can `apm link --dev` then run Nuclide via `atom --dev`. This will allow something similar to a production and development installation of Nuclide.

When you open Atom in development mode, either with the `atom --dev` from the command line or with
the `View | Developer | Open in Dev Mode...` command from within the Atom menus, your linked version
of Nuclide will load in place of any other version of Nuclide you might have installed.
