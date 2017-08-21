# atom-ide-ui

A collection of Atom UIs to support language services (namely the LSP).

## Usage

Run `apm install atom-ide-ui` to install the Atom package.

> NOTE: The code here is published to https://www.npmjs.com/package/atom-ide-ui and imported in the Atom package to enable easier publishing.

## Features

### hyperclick

Command-click (Control-click on Windows/Linux) on symbols to go to their definition.

### atom-ide-busy-signal

A loading indicator in the status bar to indicate a busy status.

### atom-ide-code-format

Provides the "Format Code" command in text editors.

### atom-ide-code-highlight

Highlights all occurrences of a symbol at the current cursor.

### atom-ide-datatip

Provides mouse-activated overlays inside text editors.

### atom-ide-diagnostics

Displays diagnostics in the status bar, inline in the editor/gutter, and in a dedicated panel.

### atom-ide-definitions

Allows other packages to provide data sources for definitions.
These are then surfaced via `hyperclick` and preview datatips.

### atom-ide-outline-view

Displays a tree listing of symbols in the current file.

## License

`atom-ide-ui` is BSD-licensed. We also provide an additional patent grant.
