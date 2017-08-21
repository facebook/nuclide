# atom-ide-diagnostics

## Overview

`atom-ide-diagnostics` is responsible for consuming diagnostics from providers
and sending updates to a UI provider.
[`atom-ide-diagnostics-ui`](https://github.com/facebook/nuclide/tree/master/modules/atom-ide-ui/pkg/atom-ide-diagnostics-ui)
is our UI implementation.

Packages wishing to provide diagnostics should use of of two community standard
APIs [LSP] or [Atom Linter]'s'.

## LSP

For most cases, implementing a language server is a pretty good approach to
take. The language server protocol was created by Microsoft but has since become
something of a de facto standard, with [support in many editors and IDEs][lsp
implementations]. See the [atom-languageclient] project for more information.

## Atom Linter APIs

For cases in which portability isn't important, you can also use the Atom
services defined by the [Atom Linter] project. This project has been around for
a while and has a few different APIs—all of which we support:

- [Indie (push-based) Linter v2 API](https://github.com/steelbrain/linter/blob/master/docs/types/indie-linter-v2.md)
- [Standard Linter v2 API](https://github.com/steelbrain/linter/blob/master/docs/types/standard-linter-v2.md)
- [Standard Linter v1 API](https://github.com/steelbrain/linter/blob/v1/docs/types/standard-linter-v1.md)

Because only the "Indie" variant is push-based, we recommend that for most cases
if you're not planning on using LSP.

Note that a few v2 message features are currently unimplemented:

- markdown rendering of `description`
- the `url` and `icon` fields
- multiple `solutions` (only the first one is used)
- callback-based `solutions`
- callback-based `description`


[LSP]: https://github.com/Microsoft/language-server-protocol/blob/3.0.0/protocol.md
[Atom Linter]: http://steelbrain.me/linter/types/indie-linter-v2.html
[lsp implementations]: https://github.com/Microsoft/language-server-protocol/wiki/Protocol-Implementations
[atom-languageclient]: https://github.com/atom/atom-languageclient#atom-language-server-protocol-client
