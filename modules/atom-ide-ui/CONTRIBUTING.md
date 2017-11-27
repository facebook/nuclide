# Contributing to `atom-ide-ui`

Run the following commands to run `atom-ide-ui` from source:

```shell
# Clone the source
$ git clone https://github.com/facebook/nuclide.git
$ cd nuclide
# Install Nuclide dependencies (alternatively: yarn --no-lockfile)
$ npm install
# Change into the `atom-ide-ui` directory
$ cd modules/atom-ide-ui
# Link the 'atom-ide-ui' package to Atom's package directory
$ apm link

# During development:
# Run Flow
$ npm run flow
# Run ESLint
$ npm run lint
# Run tests
$ npm test
```

During development, `atom-ide-ui` inherits its dependencies from the Nuclide
`package.json`, so there's no need to run `npm install` from within
`modules/atom-ide-ui`.

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

## License

Unlike the main Nuclide code, `atom-ide-ui` is BSD-licensed.
We also provide an additional patent grant.
