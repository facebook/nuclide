# Packages Folder

This folder contains the Node and Atom packages that compose Nuclide.

## Design

Because Nuclide is divided into so many packages, we decided to develop
them in a single repo (as opposed to one repo per package) to facilitate
making atomic changes across packages.

With so many packages, we have developed a set of scripts to
help manage them. We store metadata about a package in the `"nuclide"`
property of the package's `package.json` file that can be used for
scripting. At a minimum, a package should declare its type (`"Node"` vs.
`"Atom"`) and its test runner (`"npm"` vs. `"apm"`):

```json
"nuclide": {
  "packageType": "Node",
  "testRunner": "apm"
}
```

In practice, this means we have three types of packages in Nuclide:

1. `Node`/`npm` A traditional Node package. It is installed and `require()`'d like
any other package from [npm](https://www.npmjs.org/). Although it is used in
Nuclide, the package has no dependencies on Atom and could be used in an ordinary
Node environment. Many of these packages contain logic that is used by the
Nuclide server, which is run outside of Atom.
* `Node`/`apm` A Node package that has dependencies on Atom. Although it is
available on [npm](https://www.npmjs.org/) and could therefore be included
in the `"dependencies"` of any Node package, it is only guaranteed to work when
run inside Atom. Such packages have references to either the global `atom`
environment variable, `require('atom')` or `require` other `Node`/`apm`
packages.
* `Atom`/`apm` A traditional Atom package. Installable via `apm install`,
but not `npm install`. Because
[Atom packages cannot express dependencies on other Atom packages](https://github.com/atom/atom/issues/2412),
it is not safe to design an Atom package that relies on the presence of another
Atom package. This is one shortfall of the
[Services API](http://blog.atom.io/2015/03/25/new-services-API.html): although
it is possible to declare an Atom package as a provider of a service, such as
[AtomLinter](https://github.com/AtomLinter/Linter)*, there is no way to ensure
that at least one consumer of the provider exists.
(The npm package, [`atom-package-dependencies`](https://www.npmjs.com/package/atom-package-dependencies),
is one proposed third-party solution to this problem.)
The flip side is that only one instance/version of an Atom package can be installed globally in
Atom, so it can reliably be treated as a singleton (which is not the case for Node packages).

Given the definition of the various types of packages in Nuclide, we have the following
constraints on package dependencies:

1. `Node`/`npm` packages can depend only on other `Node`/`npm` packages.
2. `Node`/`apm` packages can depend only on other `Node`/`apm` packages as well
as `Node`/`npm` packages.
3. `Atom`/`apm` packages can depend only on any combination of `Node`/`apm` packages
and `Node`/`npm`, but cannot depend on other `Atom`/`apm` packages.
4. Any package in Nuclide can depend on any "ordinary" package in [npm](https://www.npmjs.org/).

Note that Atom packages have some special folders (`keymaps`, `styles`, etc.) whose
contents are processed in a special way. Because Atom packages cannot be expressed
as dependencies of other Atom packages, this makes it difficult to create a package for a
reusable UI component with its own `styles`. As a workaround, we created the
[`nuclide-atom-npm`](./nuclide-atom-npm) package, which makes it possible to create a
Node package with the structure and [most of the] functionality of an Atom package. See its
[`README.md`](./nuclide-atom-npm/README.md) for details.

For Nuclide, we strive for the majority of our packages to be Node packages. This makes code
easier to reuse, and enables dependencies to be loaded synchronously and reliably (which is not
the case for Services in Atom). By comparison, we try to limit the number of Atom packages to make
it easier for users to install the subset of Nuclide that is relevant to them.

*AtomLinter does not support the Services API
[yet](https://github.com/AtomLinter/Linter/pull/432),
but it seems like it will ultimately have to, as it is the favored pattern in Atom.

## Development

The Nuclide repository is organized to facilitate iterative development of Nuclide itself.

To run the tests for an individual package, invoke the test runner that corresponds to
the `"nuclide/testRunner"` section of the `package.json` file (i.e., `npm test` or `apm test`).
Note that the [nuclide-jasmine](./nuclide-jasmine) package creates some
bootstrapping code for `npm test` so that it behaves more like `apm test`. In particular,
files with the `/** @flow */` pragma are automatically transpiled, and helper functions such as
`fit()`, `fdescribe()`, and `waitsForPromise()` will be globally available. Here are the
relevant parts of the `package.json` file that set this up:

```json
{
  "nuclide": {
    "packageType": "Node",
    "testRunner": "npm"
  },
  "scripts": {
    "test": "node ../nuclide-jasmine/bin/jasmine-node-transpiled spec"
  }
}
```

Note that for packages whose test runner is `apm`, this is not necessary.

## Sample packages

`sample-*` packages aren't loaded as part of Nuclide. They exist to illustrate archetypal architecture and structure for a given feature, although they can be enabled for testing via the "Enabled Features" Nuclide setting.

## Dev packages

`dev-*` packages exist during development but aren't included in the production version of Nuclide. These contain various features that are useful for developing Nuclide.

## Flow errors

In case flow complaints about missing modules, i.e `Required module not found`, try uncommenting the `$FlowFB` option in Nuclide's  [.flowconfig](https://github.com/facebook/nuclide/blob/master/.flowconfig) file. See https://github.com/facebook/nuclide/pull/906#issuecomment-263567813 for more information.
