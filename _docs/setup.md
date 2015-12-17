---
id: setup
title: Setup
layout: docs
permalink: /docs/setup/
---

## Installation

The easiest way to get Nuclide is to install it from Atom itself.
In Atom, open the **Settings** pane and navigate to the **Install** tab.
From there, you can search for the `nuclide-installer` package and click
the corresponding **Install** button in the search result to install it.

Alternatively, if you are more comfortable using the command line,
you can install it using `apm`:

```bash
apm install nuclide-installer
```

The first time you start Atom after installing the `nuclide-installer` package, you will have to wait
a few seconds for the installer to determine which Nuclide packages it needs to install or update.
To determine whether the installer worked, go to the **Settings** pane in Atom and navigate to the **Packages**
tab. From there, filter your installed packages by `nuclide-` and you should see quite a few results!

### Recommended Dependencies

To benefit from all of Nuclide's features, we recommend you also install the following:

* [Flow](/docs/flow/)
* [Hack](/docs/hack/)
* [Mercurial](/docs/hg/)
* [Watchman](https://facebook.github.io/watchman/) - version 3.2 or above. It must be in
  `/usr/local/bin/` or in your `$PATH`. Without Watchman, Nuclide will lose some functionality: for
  instance, in the
  [hg-repository](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/hg-repository),
  [server](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/server), and
  [quick-open](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/quick-open) packages.

### Building from Source

If you want to build Nuclide from source, you must have the following tools installed:

+ Python 2.6 or later.
+ Atom 0.209.0 or later.
+ Node 0.12.0 or later.
+ `node`, `npm`, `apm`, and `git` must be on your `$PATH`.

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

### Uninstalling Previous Versions

Version 0.0.35 was the last version of Nuclide to be shipped as many Atom packages. In order to
migrate from <=0.0.35 to a newer version and ensure the newer version behaves as expected, we highly
recommend uninstalling all outdated packages.

Run the following script to uninstall all outdated Nuclide packages:
{% gist aff66a1c05d865fe4e83 %}

## Starting Nuclide

Once you've installed or built Nuclide, just run `Atom` - the initial load after the build process
may be a little slow because of the large number of Babel files that need to be transpiled.

## Installing Nuclide Server

If you want to use Nuclide for remote development, you'll also need to setup the `nuclide-server`
package. Instructions can be found in the [Remote Development docs](docs/remote/).
