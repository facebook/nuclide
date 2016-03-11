# Nuclide

[Nuclide](http://nuclide.io/) is a collection of features for [Atom](https://atom.io/) to provide
IDE-like functionality for a variety of programming languages and technologies.

---

## Installation

Nuclide has two parts: the client, which is an Atom package, and the optional server for remote
development, which is an NPM package. 

**Windows** version of Atom [is not fully supported](https://github.com/facebook/nuclide/issues/321) right now. 

### Atom Package Installation

Nuclide is distributed as the ['nuclide' Atom package](https://atom.io/packages/nuclide). If you
have never installed an Atom package before, follow the
[package installation instructions](https://atom.io/docs/latest/using-atom-atom-packages#_atom_packages)
from the [Atom Flight Manual](https://atom.io/docs/latest/) to do it through the Atom UI, or run the
following from the command line:

```bash
$ apm install nuclide
```

### Server Installation

Nuclide supports [Remote Development](http://nuclide.io/docs/features/remote/) via a process that runs on the
remote machine where you want to edit files. Nuclide's server is distributed as the
['nuclide' NPM package](https://www.npmjs.com/package/nuclide). This is optional and only needed if
you want to edit remote files from within Atom+Nuclide. To install the server, run the following
command on the machine where the remote files live:

```bash
$ npm install -g nuclide
```

## Building from Source

If you want to experiment with modifications to Nuclide's code, we recommend that you build it from
source.

First clone the repo:

```bash
$ git clone https://github.com/facebook/nuclide.git
```

Install Nuclide's dependencies:

```bash
$ cd nuclide
$ npm install
```

Then link Nuclide as a development Atom package:

```bash
$ apm link -d
```

When you open Atom in development mode, either with `atom --dev` from the command line or with the
`Application: Open Dev` command from within Atom, your linked version of Nuclide will load in place
of any other version of 'nuclide' you might have installed.
