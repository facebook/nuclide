# Contributing to `atom-ide-debugger-ocaml`

Run the following commands to run `atom-ide-debugger-ocaml` from source:

```
# Clone the source
$ git clone https://github.com/facebook-atom/atom-ide-debugger-ocaml
# Install dependencies (`npm install` also works, but we recommend Yarn)
$ yarn
# Link the package to Atom's package directory
$ apm link
```
## Development Tips

- Install [`ide-flowtype`](https://atom.io/packages/ide-flowtype) for Flow integration.
- Install [`linter-eslint`](https://atom.io/packages/linter-eslint) for ESLint integration.
  - Skip the `linter` dependency to use atom-ide-debugger-ocaml's Diagnostics.
- Coding style is enforced by `eslint-plugin-prettier`.

## Pull Requests

1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests in the `spec` folders.
3. If you've changed APIs, update the documentation.
4. Ensure that tests pass and Flow/ESLint are clean (see above).
7. If you haven't already, complete the Contributor License Agreement ("CLA").

## Contributor License Agreement ("CLA")
In order to accept your pull request, we need you to submit a CLA. You only need
to do this once to work on any of Facebook's open source projects.

Complete your CLA here: <https://code.facebook.com/cla>

## Issues

We use GitHub issues to track public bugs. Please ensure your description is
clear and has sufficient instructions to be able to reproduce the issue.

## License

By contributing to atom-ide-debugger-ocaml, you agree that your contributions will be licensed
under the LICENSE file in the root directory of this source tree.
