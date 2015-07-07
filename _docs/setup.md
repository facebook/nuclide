---
id: setup
title: Setup
layout: docs
permalink: /docs/setup/
---

### Installation

The easiest way to get Nuclide is to install it from Atom itself.
In Atom, open the **Settings** pane and navigate to the **Install** tab.
From there, you can search for the `nuclide-installer` package and click
the corresponding **Install** button in the search result to install it.

Alternatively, if you are more comfortable using the command line,
you can install it using `apm`:

```bash
apm install nuclide-installer
```

It is also *strongly recommended* to install the [linter](https://atom.io/packages/linter) package if you haven't got it already. It allows Nuclide to display messages about linting your code (if you don't have it, you won't see messages from [Flow](/docs/flow/) for example).

The first time you start Atom after installing the `nuclide-installer` package, you will have to wait
a few seconds for the installer to determine which Nuclide packages it needs to install or update.
To determine whether the installer worked, go to the **Settings** pane in Atom and navigate to the **Packages**
tab. From there, filter your installed packages by `nuclide-` and you should see quite a few results!

### Building from Source

If you want to build Nuclide from source, you must have the following tools installed:

+ Python 2.6 or later.
+ Atom 0.209.0 or later.
+ Node 0.12.0 or later.
+ `node`, `npm`, `apm`, and `git` must be on your `$PATH`.

The [linter](https://atom.io/packages/linter) package is optional, but *strongly recommended*.

Of course, [Flow](/docs/flow/), [Hack](/docs/hack/), and [Mercurial](/docs/hg/) are
also required if you wish to use their relevant Nuclide integrations - please read the guide for
each package to see any additional requirements.

Building Nuclide is fairly straightforward, just run the following command from the root of the
repository:

```bash
./scripts/dev/setup
```

or, if you're using Windows:

```bat
python scripts\dev\setup
```

This script will fetch the appropriate dependencies from npm and perform any necessary build steps.

## Starting Nuclide

Once you've installed or built Nuclide, just run `Atom` - the initial load after the build process
may be a little slow because of the large number of Babel files that need to be transpiled.

## Installing Nuclide Server

If you want to use Nuclide for remote development, you'll also need to setup the `nuclide-server`
package. Instructions can be found in the [Remote Development docs](docs/remote/).
