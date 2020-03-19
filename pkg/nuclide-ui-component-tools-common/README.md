# UI Component Tools Commons

## Overview

This package provides functionality for indexing metadata about React components
such as their required props and deprecation status.
It is intended that a Language Server Protocol provider such as
`nuclide-js-imports-server` utilizes the interface exposed in this package in an
effort to share the resources involved in file indexing operations and being an
LSP provider.

## Why does this package exist?

This package is intended to be decoupled from Atom/Nuclide and LSP
implementation details. The goal is that this package exists to provide the
logic for an LSP client and server to index React components. The index is
intended to provide autocompletion functionality (see completions in
`nuclide-js-imports-server`).

## Support & Filing Bugs

If you are a Facebook engineer then see the README in `fb-ui-component-tools`
for information on support and feedback. Otherwise, please use GitHub issues.

## Features

* Get the leading comment, required props, and default props from a given
  babylon/babel-parser AST. See `getComponentDefinitionFromAst`.
* Run `./scripts/index-prototype.js <directory>` to see the component
  definitions parsed within a directory.
