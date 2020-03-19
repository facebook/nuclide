# modules Folder

This folder contains various Node packages used inside Nuclide that can
additionally be published as separate NPM packages.

Unlike code inside `pkg/`, `modules/` code cannot depend on other parts of
Nuclide (besides other `modules/`) and must explicitly declare their
dependencies. This is enforced via the `modules-dependencies` rule in
`eslint-plugin-nuclide-internal`.

## Usage

All non-private packages under modules/ are published to NPM, for example:
https://www.npmjs.com/package/nuclide-commons

Inside of Nuclide and atom-ide-ui, `modules/*` is a Yarn workspace in the root package.json.
During development, Yarn symlinks all packages in modules into the root node_modules/ folder
and includes their dependencies in the root `yarn.lock` file.

Since `apm install` uses `npm install`, we also use `babel-plugin-module-resolver` inside of
`nuclide-node-transpiler` to rewrite all imports of packages in modules/ to relative paths
at transpile time.

Thus, all Nuclide code is able to use `modules/xyz` via `require('xyz')`
without excessively long relative paths (i.e. `require('../../../modules/xyz')`).

## License

All code in `modules/` is BSD-licensed. We also provide an additional patent grant.
