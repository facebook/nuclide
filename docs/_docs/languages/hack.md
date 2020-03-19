---
pageid: language-hack
title: Hack
layout: docs
permalink: /docs/languages/hack/
---

Nuclide has been built from the start to provide a great IDE experience for
[Hack](http://hacklang.org) development. Hack is a programming language for
[HHVM](http://hhvm.com).

> Currently, HHVM is [not supported on Windows](https://docs.hhvm.com/hhvm/installation/windows), so
> this integration has limited viability on that platform. However,
> [work is being done](https://github.com/facebook/hhvm/issues/5460) to port HHVM to Windows.

<br/>

* TOC
{:toc}

## Installing Hack

In order to fully use the integration of Hack, you must have both Hack and HHVM installed on your
system:

1. [Install HHVM](https://docs.hhvm.com/hhvm/installation/introduction). By default, Hack is
installed with HHVM.
2. If you are new to Hack, HHVM's [Getting Started](https://docs.hhvm.com/hack/getting-started/getting-started) provides [steps for writing your first Hack program](https://docs.hhvm.com/hack/getting-started/getting-started#your-first-hack-program). The
key items of note are:
    * The typechecker `hh_client` is in your `$PATH` environment variable (the default install of
      HHVM, should place it there).
    * You have an `.hhconfig` file at the root of your project.
    * You have `<?hh` at the top of your `.php` or `.hh` file.

> If you are planning on developing with Hack [remotely](/docs/features/remote), ensure HHVM and
> Hack are installed on the *remote* machine.

## Features

Hack's integration into Nuclide provides you with productivity features such as:

* [Code Diagnostics](#features__code-diagnostics)
* [Autocomplete](#features__autocomplete)
* [Jump to Definition](#features__jump-to-definition)
* [Inline (mouseover) type hinting](#features__type-hinting)
* [Code formatting](#features__code-formatting)
* [OmniSearch](/docs/features/quick-open), with a special [Hack symbol](/docs/features/quick-open#hack-symbols) search pane.

### Code Diagnostics

If your code doesn't correctly [typecheck](https://docs.hhvm.com/hack/typechecker/introduction), Nuclide has code diagnostics that will show you the error. You can see the error in two places, inline within the
[Editing Area](/docs/editor/basics/#editing-area) and in the
[Code Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) pane below.

![](/static/images/docs/language-hack-code-diagnostics.png)

Hover over the sideways red triangle in the [gutter](/docs/editor/basics/#gutter) to see the Hack
error inline.

![](/static/images/docs/language-hack-code-diagnostics-gutter.png)

### Autocomplete

Given that Nuclide has access to all of the type information within your project and the built-in
types provided by Hack, autocomplete just works.

![](/static/images/docs/language-hack-autocomplete.png)

### Jump to Definition

Nuclide provides a jump to definition/symbol feature for Hack programs.

> In order for this to work, you must have an `.hhconfig` file in the root of your project and a
> running `hh_server` monitoring the root as well.

For example, if you want to go to the definition of `getPages()`, hover over `getPages()`
and either press `Cmd-<mouse click>` or `Cmd-Option-Enter` (`Ctrl-Alt-Enter` on Linux).

![](/static/images/docs/language-hack-jump-to-definition-link.png)

![](/static/images/docs/language-hack-jump-to-definition-result.png)

### Type Hinting

If you hover over a variable in your Hack file, you can get the type of the variable directly
inline.

![](/static/images/docs/language-hack-typehint.png)

In fact, you can even pin that type hint so that it always displays. Just click on the pin icon
when hovering over a variable to pin it.

![](/static/images/docs/language-hack-pinned-typehint.png)

The highlighted variables show that their type variables have been pinned. If you hover over the
type hint, its associated variable will have motion in its highlight.

Click the `x` icon of a pinned type hint to remove it.

> Pinned type hints can be moved anywhere within the editor.

### Type Coverage

Nuclide can show you how much of your Hack file is covered by the type system with Type Coverage.

![](/static/images/docs/language-hack-type-coverage.png)

If the percentage is less than 100%, you can toggle the Type Coverage inline display to show you where the issues are.

From the [Command Palette](/docs/editor/basics/#command-palette), choose `Nuclide Type Coverage: Toggle Inline Display`. You can also either press `Ctrl-Option-Shift-V` (`Ctrl-Alt-Shift-V` on Linux) or simply click on the percentage displayed in the [Status Bar](/docs/editor/basics/#status-bar).

Hover over any sideways triangles that appear in the gutter to see the type check issue inline, or open the [Diagnostics Table](/docs/editor/basics/#status-bar__code-diagnostics) to see them all listed together.  Clicking on any issue in the Diagnostics Table will highlight the associated line.

![](/static/images/docs/language-hack-type-coverage-inline.png)

### Code Formatting

Nuclide can take your Hack code and format it according to a built-in set of coding standards
(e.g, two-space indents, bracket location, etc.).

For example, here is a bit of code that looks relatively haphazard from a formatting perspective.

![](/static/images/docs/language-hack-badly-formatted.png)

Place your cursor inside the function and press `Cmd-Shift-C` (`Ctrl-Shift-C` on Linux) to apply the coding standards to the function.

![](/static/images/docs/language-hack-well-formatted.png)

## Debugging

Nuclide supports debugging PHP and Hack applications running on [HHVM](https://docs.hhvm.com/hhvm/installation/introduction). **HHVM version 3.25.0 or greater is required,** as older versions do not support the Visual Studio Code Debug Adapter Protocol, which is the debugging protocol Nuclide now uses.

> Note: debugging PHP servers other than HHVM is no longer supported in Nuclide. In previous versions, Nuclide supported debugging via the XDebug protocol, but this is also no longer supported. Debugging older HHVM versions (< 3.25.0) with Nuclide is not possible.

### Configuring HHVM for debugging

To enable debugging Hack/PHP applications **in webserver mode**, you'll need to add
the following to your server's config.ini:

```
hhvm.debugger.vs_debug_enable=1
```

By default, HHVM will listen for incoming debugger connections on port 8999. You can specify a different port by adding an additional line to your config.ini:
```
hhvm.debugger.vs_debug_listen_port=<port>
```

More information about configuring HHVM can be found here: [HHVM Configuration](https://docs.hhvm.com/hhvm/configuration/introduction)

If you want to debug a Hack/PHP script running in **script mode**, you simply add a couple extra command line parameters when invoking HHVM:

```
hhvm --mode vsdebug --vsDebugPort <port>
```

The above command will startup HHVM with the debugger listening on the specified port, and will wait forever for the debugger to connect before starting the script.  You can add an additional optional parameter, `--vsDebugNoWait true` to cause HHVM to begin execution of the script immediately, while still allowing the debugger to connect and break in later. This mode is especially useful for long-running scripts that you may want to break into to debug things like infinite loops, hangs, etc.


In order for Nuclide to be able to connect to your HHVM instance, you'll need to either have Nuclide server on the same host as HHVM and use a remote project, or forward the HHVM debugger port to your local machine via SSH tunneling or some other means.

We *strongly* advise against exposing the HHVM debugger port to the internet on production machines, for obvious security reasons.


### Configuring Nuclide to debug HHVM

There are two configuration options in Nuclide settings that you'll want to configure for HHVM if you want to launch scripts in debug mode. You don't need to configure these if you only want to attach to a webserver.

![](/static/images/docs/debugger-hhvm-settings.png)

The first is the full path to your HHVM runtime binary, and the second is any arguments Nuclide should pass when starting HHVM, such as the path to your config.ini. These arguments will be passed verbatim on the command line when invoking HHVM.

Additionally, you may specify an optional attach port to use when attaching to webserver mode, if you've configured your server to listen on a port other than 8999.


### Debugging: HHVM Toolbar

The [Task Runner toolbar](/docs/features/task-runner) is one way to debug Hack or PHP projects.  To open the Task Runner toolbar, click on the **Toggle Task Runner Toolbar** button in the [Nuclide toolbar](/docs/features/toolbar/#buttons) or search for `Nuclide Task Runner: Toggle HHVM Toolbar` in the [Command Palette](/docs/editor/basics/#command-palette).

See the [Task Runner HHVM guide](/docs/features/task-runner/#hhvm-debug-toolbar) for instructions on debugging Hack or PHP projects.

### Debugging: Launch / Attach Dialogs

The HHVM debugger can also be started via our advanced configuration dialogs. You'll find these under the Nuclide menu (Nuclide -> Debugger -> [Launch | Attach] Debugger), and select the "Hack / PHP" tab, which will be offered if your current working root is a remote project that supports HHVM.

When launching, Nuclide will prompt for the path to your Hack/PHP script, and any arguments you'd like Nuclide to pass to it.

When attaching, Nuclide will offer to connect to your webserver instance, or attach to an already-running script that was started with the `--mode vsdebug --vsDebugPort <port>` HHVM arguments.

### Console

When debugging a *script*, all output from HHVM's stdout and stderr is redirected to the Nuclide console. When debugging a *webserver*, stdout is redirected, but stderr is not due to the output traffic being too high.

The console also provides a REPL that allows you to execute Hack/PHP code (see below).

### Console Evaluation

Basic [evaluation](/docs/features/debugger/#basics__evaluation) in the REPL works out of the box for built in Hack/PHP routines.

Nuclide now executes console input **as Hack by default**, instead of PHP. For many commands, there is no difference, but the behavior between Hack and PHP differs in some contexts, so this is important to know. You can explicitly have the debugger run your code as Hack or PHP by beginning your input with `<?hh` or `<?php`, respectively.

Note: if your input begins with `<?hh` or `<?php`, the debugger will execute whatever you type, verbatim, as a Hack/PHP script. It must therefore be a complete and syntactically valid script (including ending your statements with a `;`).

When stopped a breakpoint, console commands execute in the context of the currently-broken-in request, at the location of the selected call frame and line.  While the target is running, however, console commands execute in a global context that is not specific to any currently running request. In this context, you'll probably want to reference things defined in your Hack/PHP application. It is therefore possible to have the debugger `require` or define things so that they are "in scope" for the console evaluation.

For this to work, there must be a `.hhconfig` file at the root of your project, as well as a
`scripts/vsdebug_includes.php` file.  The `vsdebug_includes.php` file will be invoked by the debugger when it starts up. Here you can define things, require files or include logic you want run every time the debugger connects.
