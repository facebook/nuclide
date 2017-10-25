# JS Imports Server
`nuclide-js-imports-server` is an [LSP](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md) server that provides autocompletion, diagnostics, and code actions to automatically suggest and insert missing imports.

## Installation
`nuclide-js-imports-server` is currently part of the Nuclide codebase. If you have Nuclide installed, you already have it installed. To use
the server with Atom, make sure that the `nuclide-js-imports-client` package is enabled.


## How it works

1. `nuclide-js-imports-server` recursively scans all Javascript files from the root directory of the LSP `initialize` call.
2. It uses `babylon` to parse the Javascript files and maintains an index of all exports in the project, including those from the entry files of `node_modules`.
3. The server also uses [Watchman](https://facebook.github.io/watchman/) if available to reindex files when they change.
4. The server communicates back to Nuclide using the LSP protocol to provide autocompletion, diagnostics, and code actions for open files.

To run the server from the command line, run `node server/src/index-entry.js` from the root of the project.

## Settings

### Initialization Options
When initialized, the server takes an optional `initializationOptions` object:

```javascript
{
  // A list of regexes. If the working directory matches any of the regexes,
  // diagnostics and code actions will be provided. If this is not provided or
  // is an empty array, diagnostics will be provided for all directories.
  diagnosticsWhitelist: Array<string>,
  // A list of regexes to determine if require() will be used instead of 'import'.
  // The default settings is to use 'import'.
  requiresWhitelist: Array<string>,
}
```

This is controlled by the Atom config `nuclide.nuclide-js-imports-client.diagnosticsWhitelist`.

### ESLint Configuration
The server will attempt to read from the project's `.eslintrc` file and `package.json` file for the project's global environments.
Based on these environments, globally defined identifiers will not be consider undefined. For example, if the `browser` environment
is set to `true`, the identifier `window` will not be considered undefined. If the server cannot find an `.eslintrc` file or `package.json`
file with `eslint` configurations, it will be conservative and assume that all environments are used.

See the list of globally defined identifiers for each environment [here](https://github.com/sindresorhus/globals/blob/master/globals.json).

### Flow Configuration
Finally, the server will also read from a project's `.flowconfig` for information on how to format import files.

#### Node vs Haste
`nuclide-js-imports-server` will use the `.flowconfig` to check for the module system used (`node` or `haste`).

#### Modules
The server will also look for all lines in which `module.system.node.resolve_dirname` is set. All imports from these directories
will be relative to those directories rather than being relative to the file where it is imported.

## Server Features

### Autocomplete
The server offers autocompletion when a user is typing `import` or `require` statements.

The server will autocomplete the following cases and in all cases will completely
finish the `import` or `require` statement when the completion item is resolved.
- `import TextDoc|`
- `import {TextDoc|`
- `import type TextDoc|`
- `import type {TextDoc|`
- `import TextDocuments |`
- `import {TextDocuments}|`
- `import type TextDocuments |`
- `import type {TextDocuments}|`
- `const TextDoc|`
- `const TextDocuments |`

### Diagnostics & CodeActions
`nuclide-js-imports-server` will scan all currently opened files for missing imports. The
server scans the files on every change, so diagnostics will appear as you type.

First, the server will find undefined symbols by traversing the AST.
If any undefined symbols are found, it will check the index for exports with the same
identifier. If a match is found, the server will offer a diagnostic indicating that the
identifier is not imported. Upon request, a `CodeAction` will be provided for the
diagnostic with a command that inserts an appropriate `import` or `require` statement.

For undefined Flow types, the JS imports server will not send diagnostics but will
instead provide `CodeActions` for Flow's diagnostics. (Currently, it's too difficult
to determine undefined types in a way that matches Flow's knowledge).

## Potential Improvements
- Make autocompletion work for multi-line imports/requires.
- Index `flow-typed` directories to provide better support for `node_modules` exports.
