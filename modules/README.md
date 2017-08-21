# modules Folder

This folder contains various Node packages used inside Nuclide that can
additionally be published as separate NPM packages.

Unlike code inside `pkg/`, `modules/` code cannot depend on other parts of
Nuclide (besides other `modules/`) and must explicitly declare their
dependencies.

## Usage

For ease of internal use, `modules/` is added to the `NODE_PATH` at runtime
via `nuclide-node-transpiler` (which is required by all Nuclide entry points).

Thus, all Nuclide code is able to use `modules/xyz` via `require('xyz')`
without excessively long relative paths (i.e. `require('../../../modules/xyz')`).

The root `.flowconfig` also recognizes `modules/` as a module resolution path.

## License

All code in `modules/` is BSD-licensed. We also provide an additional patent grant.
