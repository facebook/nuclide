---
layout: post
title: "Introducing Atom IDE UI"
author: hansonw
---

Since the beginning, Nuclide has strived to provide a feature-rich IDE
experience on top of Atom, with functionality like
[code diagnostics](https://nuclide.io/docs/languages/flow/#code-diagnostics),
[jump to definition](https://nuclide.io/docs/languages/flow/#jump-to-definition),
and much more. However, over time we've heard feedback that the
"one-size-fits-all" philosophy can be overwhelming for many Atom users.

That's why we're proud to announce the new
[Atom IDE UI](https://atom.io/packages/atom-ide-ui) package, which is part of
our collaboration with GitHub in the broader
[Atom IDE](https://atom.io/ide) initative. Read
more about that on [the Atom blog](http://blog.atom.io/2017/09/12/announcing-atom-ide.html).

![Screenshot](/static/images/blog/2017-09-12/atom-ide-ui.png)

Atom IDE UI is fast and lightweight by design. It extracts only the subset of the
core UI features from Nuclide necessary to support Atom's
[atom-languageclient](https://github.com/atom/atom-languageclient)
library in displaying features supported by the [language server protocol](
http://langserver.org/). Like Nuclide, it's a [unified package](
https://nuclide.io/blog/2016/01/13/Nuclide-v0.111.0-The-Unified-Package/) which
contains the following features:

- [Diagnostics](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/diagnostics.md)
- [Definitions](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/definitions.md)
- [Find References](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/find-references.md)
- [Outline View](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/outline-view.md)
- [Datatips](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/datatips.md)
- [Code Formatting](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/code-format.md)
- [Code Actions](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/code-actions.md)
- [Code Highlight](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/code-highlight.md)
- [Busy Signal](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/busy-signal.md)

Atom IDE UI is designed to work out-of-the-box with packages using
[atom-languageclient](https://github.com/atom/atom-languageclient), such as
[ide-typescript](https://atom.io/packages/ide-typescript) and our own
[ide-flowtype](https://atom.io/packages/ide-flowtype).

As always, these features can be also be used directly via Atom services.
Documentation for these APIs is available inside the
[atom-ide-ui repository](https://github.com/facebook-atom/atom-ide-ui/tree/master/docs).

## Getting started

Using Atom IDE UI is as simple as:

1. Install the [`atom-ide-ui` Atom package](https://atom.io/packages/atom-ide-ui)
2. Install an "ide-" package for your favourite language:
    * [TypeScript](https://www.typescriptlang.org/): [`ide-typescript`](https://atom.io/packages/ide-typescript)
    * [Flow](https://flow.org): [`ide-flowtype`](https://atom.io/packages/ide-flowtype)
    * Java: [`ide-java`](https://atom.io/packages/ide-java)
    * C#: [`ide-csharp`](https://atom.io/packages/ide-csharp)
    * [Full list at the atom-languageclient wiki](https://github.com/atom/atom-languageclient/wiki/List-of-Atom-packages-using-Atom-LanguageClient)

Note that if you're already a Nuclide user, all of Atom IDE UI's features will
still be bundled inside of Nuclide, so there's no need to install another
package.

## Roadmap

The list of features in Atom IDE UI doesn't yet encompass all the features
available in the language service protocol, and over time we'll be working to
fill in the gaps. In particular, we're looking to add:

- [code lenses](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_codeLens)
- [rename support](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_rename)
- [function signature help](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_signatureHelp)

Our hope is that other Nuclide features will eventually also become part of the
Atom IDE effort, including key components like the [Nuclide debugger](
https://nuclide.io/docs/features/debugger/). Note that we're still committed to
supporting the open-source Nuclide package for the foreseeable future.

Contributions and bug reports are welcome over at
[facebook-atom/atom-ide-ui](https://github.com/facebook-atom/atom-ide-ui)!

The Atom IDE UI code is released under the BSD-3-Clause license.
