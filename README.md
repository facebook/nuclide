# Nuclide

[Nuclide](http://nuclide.io/) is a collection of packages for [Atom](https://atom.io/)
to provide IDE-like functionality for a variety of programming languages and
technologies.

### Important Early Access Notice

**Nuclide is currently in a pre-release state, and we are providing early access
to a small number of external users in order to help ensure the quality of the
project at launch. During this time, please do not share the code more broadly -
it is changing fast and we are looking for high quality feedback from a small
number of initial users.**

**As the project progresses over the coming weeks, we will be incrementally
adding more of the Nuclide suite of packages in preparation for the full launch.
The current release focusses on Hack, Flow, Mercurial, and remote development.
It also includes some core utilities that will be used by the next set of
packages, to be released very soon.**

**We want to thank you for your patience and help in putting this project
together. _Please_ feel free to raise issues and offer pull requests during this
early access period, and we will work hard to get to them!**

**Thanks!** - from all the Nuclide Team.


## Packages

Most developers choose to maintain individual Node and Atom packages in their
own repositories. Because Nuclide is composed of so many packages, we chose to
organize all of its code in a single repository rather than across a multitude of
repositories. As such, this repository is organized as follows:

* `pkg/` Source code for Nuclide packages.
* `scripts/` Utilities for developing and deploying Nuclide packages.

## Installation

Currently, Nuclide can be installed only from source. That is, during early access,
Nuclide packages are not publicly available in [npm](https://www.npmjs.com/) or
[apm](https://atom.io/packages). Fortunately, building Nuclide is fairly straightforward.

**System Requirements**

* Python 2.6 or later.
* Atom v0.207.0 or later.
* `node`, `npm`, `apm`, and `git` must be on your `$PATH`. (Node must be v0.12.0 or later.)
* *Optional, but strongly recommended:* install the Atom [linter-plus](https://atom.io/packages/linter-plus) package.

**Build and install Nuclide**

Run the following command from the root of the repository:

```
./scripts/dev/setup
```

or if you are on Windows:

```
python scripts\dev\setup
```

If you see any errors, try running the setup script again with the `--verbose` flag to get more
debugging information.

The setup script will fetch the appropriate dependencies from [npm](https://www.npmjs.com/) and
perform any necessary build steps. When complete, you should see several `nuclide-`
packages in your `~/.atom/packages` directory. Starting Atom after running `./scripts/dev/setup`
for the first time may be a little slow because of the large number of Babel files that
need to be transpiled. (The results of transpilation are cached for future use.
You can see how many files were transpiled from [Timecop](https://atom.io/packages/timecop).)

## Updating Nuclide packages
Run the following command from the root of the repository:

1.
```
git clean -xfd
```
2.
```
git pull
```
3.
Follow the instructions again from **Build and install Nuclide** section.

## Features

Currently, Nuclide contains the following Atom packages:

* `nuclide-flow` Adds support for [Flow](http://flowtype.org/). If `flow` is on your `$PATH`,
then opening `.js` files with the `/* @flow */` pragma under a directory with a `.flowconfig`
should expose information from Flow directly in Atom.
* `nuclide-hack` Adds support for [Hack](http://hacklang.org/).
* `nuclide-hg-repository` Local changes to files in a [Mercurial](http://mercurial.selenic.com)
repository will be reflected in Atom's file tree and gutter UI as Atom does
natively for Git repositories.

Nuclide also adds support for *remote development*. See the [`nuclide-server`](pkg/nuclide/server)
package for more information on setting up remote development.

## Development

Read the [packages overview](./pkg/README.md) to learn how to develop Nuclide.
