---
pageid: language-objective-c
title: Objective-C
layout: docs
permalink: /docs/languages/objective-c/
---

Nuclide has *limited*, built-in support for
[Objective-C](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/Introduction/Introduction.html),
which allows you to build native [iOS](/docs/platforms/ios) applications directly within Nuclide.

* TOC
{:toc}

## Install Objective-C

By installing [Xcode](https://developer.apple.com/xcode/), you will have full access to Objective-C.

> Linux does not have Xcode. However, there are ways to compile Objective-C programs on Linux using
> `gobjc`, [`gnustep`](http://www.gnustep.org/), etc.

However, to get the full [feature list](#buck-enabled-features) for Objective-C support, you must
compile your Objective-C program with [Buck](http://buckbuild.com).

## Default Features

Objective-C's integration into Nuclide provides you with productivity features out-of-the-box such
as:

* [Automatic Square Bracket Completion](#default-features__automatic-square-bracket-completion)
* [Automatic Colon Indenting](#default-features__automatic-colon-indenting)

### Automatic Square Bracket Completion

If you forget to put a starting bracket at the front of your target or selector, one will be inserted
for you automatically if you add the ending bracket. This will work for any number of bracket
levels deep.

For example, if you add an ending bracket here...

![](/static/images/docs/language-objc-before-bracket-insert.png)

... then the beginning bracket is inserted for you automatically.

![](/static/images/docs/language-objc-after-bracket-insert.png)

To enable this setting:

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-objc`, and select the **Enable Automatic Square Bracket Completion** checkbox.

![](/static/images/docs/language-objc-auto-bracket-completion-setting.png)

### Automatic Colon Indenting

Nuclide will automatically indent the colons (`:`) associated with new method arguments to be
aligned with the arguments of that method.

If you start a `:` at the beginning of the next line after the method declaration...

![](/static/images/docs/language-objc-before-colon-indent.png)

... it will be aligned automatically.

![](/static/images/docs/language-objc-after-colon-indent.png)

## Buck-enabled Features

The following features require that your Objective-C project is compiled with [Buck](http://buckbuild.com).

> You can also generate a `compile_commands.json` file with the
> [`json-compilation-databse` reporter](https://github.com/facebook/xctool#included-reporters)
> of [`xctool`](https://github.com/facebook/xctool) to get these features.

<br/>

* [Code Diagnostics](#buck-enabled-features__code-diagnostics)
* [Inline Type Hints](#buck-enabled-features__type-hints)
* [Autocomplete](#buck-enabled-features__autocomplete)
* [Jump to Definition](#buck-enabled-features__jump-to-definition)

> The [Buck toolbar](/docs/features/buck) allows you to build and run your Buck-enabled programs.

### Code Diagnostics

If you write code that will cause `clang` errors or warnings, Nuclide's Code Diagnostics will show
you the error. You can see the error in two places: inline within the
[Editing Area](/docs/editor/basics/#editing-area), and in the [Code Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) pane below.

![](/static/images/docs/language-objc-code-diagnostics.png)

Hover over the sideways red triangle in the [gutter](/docs/editor/basics/#gutter) to see the `clang` error inline.

![](/static/images/docs/language-objc-lint-gutter.png)

### Type Hints

Hovering over an Objective-C object will provide you the type of that object inline.

![](/static/images/docs/language-objc-typehint.png)

In fact, you can even pin that type hint so that it always displays. Just click on the pin icon when hovering over a variable to pin it.

![](/static/images/docs/language-objc-pinned-typehint.png)

Click the `x` icon of a pinned type hint to remove it.

> Pinned type hints can be moved anywhere within the editor.

### Autocomplete

Buck enhances the understanding of the types of objects in your project so that autocomplete can be
enabled.

![](/static/images/docs/language-objc-autocomplete.png)

> Without Buck, you will still get the default autocomplete feature, but without project and object
> specific information.

### Jump To Definition

Nuclide provides a jump to definition/symbol feature for Objective-C programs.

For example, if you want to go to the definition of `initWithHelloString:`, hover over
`initWithHelloString:` and either press `Cmd-<mouse click>` (`Ctrl-<mouse click>` on Linux) or
`Cmd-Option-Enter` (`Ctrl-Alt-Enter` on Linux).

![](/static/images/docs/language-objc-jump-to-definition-link.png)

![](/static/images/docs/language-objc-jump-to-definition-result.png)

### Jump Between Header and Implementation

Using `Cmd-Option-N` (`Ctrl-Alt-N` on Linux), you can jump between the header (i.e., `.h`) and
the implementation (i.e., `.cpp` or `.m`) files.

## Debugging

Nuclide has support for [iOS](/docs/platforms/ios) debugging and [Buck](http://buckbuild.com)
for native Objective-C applications (i.e., `.m` files).

> Debugging Swift applications is currently not supported.

See the [Buck guide](/docs/features/buck) for how to build, run and debug iOS apps.

> Optimally, it would be nice to run the application directly from Xcode and attach to the
> simulator process associated with that Xcode project. However, due to `lldb` process conflict
> issues, this is currently not possible.

### LLDB Commands

Native iOS debugging uses [LLDB](http://lldb.llvm.org/) as its debugging backend. You can run LLDB
commands directly in the Nuclide Debugger's [Console](/docs/features/debugger#basics__evaluation).
