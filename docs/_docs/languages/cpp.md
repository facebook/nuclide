---
pageid: language-cpp
title: C++
layout: docs
permalink: /docs/languages/cpp/
---

Nuclide provides support for C++ developers.

<br />

* TOC
{:toc}

## Supported Compilers

In order to get the full features for a C++ project beyond basic syntax highlighting
and a generic autocomplete, you must have the following prerequisites installed:

1. A compatible build system. You must have one of the following:
     * [Buck](http://buckbuild.com) - With no additional setup required!
     * [CMake](https://cmake.org/) - You will also have to generate a compilation database with the
       [`CMAKE_EXPORT_COMPILE_COMMANDS`](http://clang.llvm.org/docs/JSONCompilationDatabase.html)
       option via command-line and place it/symlink it in your project root.
       Note that Nuclide does *not* provide any additional CMake integration at the moment.
     * You can also manually create a compliant [`compile_commands.json`](http://clang.llvm.org/docs/JSONCompilationDatabase.html) in your project root.
2. [Clang](http://clang.llvm.org/) version 3.6 or higher (we recommend 3.8+)

### Installing CMake and Clang

*CMake*

You can install CMake using one of the [pre-compiled binaries](https://cmake.org/install/) for
Linux and macOS.

*Clang*

Clang is generally provided by default on all major Linux distributions. You can use your packaging
system to install it (e.g., `sudo apt-get install clang libclang`).

Note that **version 3.6 or higher is required**. We recommend 3.8 or above for best results.

> You can [build Clang from source](http://clang.llvm.org/get_started.html) on Linux as well.

On macOS, install Clang by installing [Xcode](https://developer.apple.com/xcode/).

*Verify Install*

You can verify that Clang is installed by typing `clang++ --version` on the command line.

> A similar install process occurs for GNU `g++`. It is provided with Xcode, and you can install
> it via a Linux package (e.g., `sudo apt-get install g++`).

*Building*

Once Clang is installed, you need to build your C++ project with the `cmake` command, passing in the
`CMAKE_EXPORT_COMPILE_COMMANDS` flag. This will create a `compile_commands.json` file which lives
in the root of your project and provides the necessary information for the
[Nuclide C++ features support](#features).

> If you use [Buck](#supported-compilers__installing-buck), you will not need to build with this
> flag.

You may also provide additional project-wide compilation flags and include paths (such as `-isystem`
includes), as well as compilation flags to ignore, in a `.nuclide_clang_config.json`
file at the root of your project.  These flags will specifically be used for the
[Nuclide C++ features](#features) that require libclang, rather than in the build process itself,
and they will be appended to the end of the compilation line.  This file should look as follows:
> `{ 'extra_compiler_flags': [..], 'ignored_compiler_flags': [..] }`

### Installing Buck

Buck is [available](https://buckbuild.com/setup/install.html) via Homebrew on macOS, or you can
build from source on Linux.

*Building*

Your C++ project must be set up for a Buck build by creating [rules and targets](https://buckbuild.com/about/overview.html).

## Features

C++'s Nuclide integration provides you with productivity features such as:

- [Code Diagnostics](#features__code-diagnostics)
- [Autocomplete](#features__autocomplete)
- [Jump To Declaration](#features__jump-to-declaration)
- [Jump Between Header and Implementation](#features__jump-between-header-and-implementation)
- [Type Hinting](#features__type-hinting)
- [Code Formatting](#features__code-formatting)

> Remember that these features are only fully-enabled when used with a
> [supported compiler](#supported-compilers).

### Code Diagnostics

If you write code that doesn't compile correctly, Nuclide will warn you through its
[Code Diagnostics](/docs/editor/basics/#code-diagnostics) pane, as well with inline
[gutter](/docs/editor/basics/#gutter) tooltips (represented by a sideways red triangle).

![](/static/images/docs/language-cpp-code-diagnostics.png)

For [gutter diagnostics](/docs/editor/basics/#gutter), you will sometimes see a **Fix** button. For
some common errors (e.g., a missing semicolon), clicking the **Fix** button will fix the
problem for you.

In this example, clicking the **Fix** button will insert a semicolon for you.

![](/static/images/docs/language-cpp-code-diagnostics-gutter-fix.png)

### Autocomplete

Nuclide uses metadata from your Clang or Buck build to understand the objects within your project.
This allows for a detailed Autocomplete feature, providing you hints on what is available for a
given object.

![](/static/images/docs/language-cpp-autocomplete.png)

### Jump to Declaration

You can click on a function call for your project and be taken directly to the declaration for that
function.

Using `Cmd-<mouse-click>` or `Cmd-Option-Enter` (`Ctrl-<mouse-click>` or `Ctrl-Alt-Enter` on
Linux), the function call will be underlined.

![](/static/images/docs/language-cpp-jump-to-declaration-link.png)

Then, you will be taken to the declaration for that function.

![](/static/images/docs/language-cpp-jump-to-declaration-result.png)

### Jump Between Header and Implementation

Using `Cmd-Option-N` (`Ctrl-Alt-N` on Linux), you can jump between the header (`.h`) and
implementation files (`.cpp`).

### Type Hinting

If you hover over a variable, Nuclide will show you a datatip with its type.

![](/static/images/docs/language-cpp-type-hint.png)

You can pin type hints to the main [Editing Area](/docs/editor/basics/#editing-area) so they
are always shown.

Click on the pin icon of the type hint to pin the hint and the `x` icon to remove the pinned hint. Pinned type hints can be moved around and placed anywhere in the editing window.

![](/static/images/docs/language-cpp-type-hint-pinned.png)

> Hovering over a pinned type hint will highlight the variable associated with it. This is useful
> if you have two pinned type hints for variables on the same line.

### Code Formatting

Nuclide will format code based on a set of default Clang standards.

1. Place your cursor on a function or line of code you wish to format.
2. Press `Cmd-Shift-C` (`Ctrl-Shift-C` on Linux), or use the context-aware menu and choose
**Format Code** to take a piece of code that looks like this...

![](/static/images/docs/language-cpp-code-formatting-before.png)

...and format it like this:

![](/static/images/docs/language-cpp-code-formatting-after.png)

## Debugging

Nuclide supports [LLDB](http://lldb.llvm.org/) as the backend for its native C++ debugging.

> At a minimum, you must have a C++ compiler (e.g., `g++` or `clang++`) and the LLVM Debugger
> (`lldb`) installed to use this feature. For example, on macOS, if you install
> [Xcode](https://developer.apple.com/xcode/) with its command-line tools, these will be installed
> for you.

> Your C++ code must be compiled with debug symbols. For `g++` or `clang++`, this is accomplished
> by using `-g`. e.g., `clang++ hello.cpp -g -o hello.cpp`. If you are using `cmake` or some other
> build management system, ensure that you are compiling in debug mode with symbols.

There are three ways to invoke the LLDB debugger:

- [Attaching to a running process](#attaching-to-a-running-process)
- [Launching a process](#launching-a-process)
- [Debugging a Buck target](#debugging-a-buck-target)

### Attaching to a running process

Nuclide can attach to a running C++ process (after
[adding a C++ project](/docs/quick-start/getting-started/#adding-a-project) to Nuclide). Once you
compile your code, run it.

NOTE: C++ debugging in Nuclide is not currently supported on Windows.

1. Open the Debugger Selection window by pressing `Cmd-Shift-A` (`Ctrl-Shift-A` on Linux) or by clicking on the **Toggle Debugger** button in the [Nuclide toolbar](/docs/features/toolbar/#buttons).
2. Choose the **Native** tab.
3. Find your process in the list, and click the **Attach** button.

<img src="/static/images/docs/feature-debugger-languages-cpp-attach.png" width="545" />

After you attach to the process, the Nuclide Debugger appears to the right of the [Editing Area](/docs/editor/basics/#editing-area).
You can then debug your code normally, [following the Debugger guide](/docs/features/debugger/#basics).

### Launching a process

Launching a process is similar to the Attach flow.

1. Open the Debugger Launch dialog by pressing `Cmd-F8` (`Ctrl-F8` on Linux) or by clicking on the **Toggle Debugger** button in the [Nuclide toolbar](/docs/features/toolbar/#buttons).
2. Choose the **Native** tab.
3. Fill out the fields, and click the **Launch** button.

<img src="/static/images/docs/feature-debugger-languages-cpp-launch.png" width="545" />

### Debugging a Buck target

See the [Buck guide](/docs/features/task-runner/#buck__debug) for instructions on how to debug C++ Buck targets.

### LLDB Commands

You can run LLDB commands directly in the Nuclide Debugger [Console](/docs/features/debugger#basics__evaluation).
