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

Nuclide has support for debugging PHP and Hack projects. [HHVM](https://docs.hhvm.com/hhvm/installation/introduction) is recommended for debugging Hack and PHP code.

> Theoretically, PHP debugging should work on other XDebug-compatible runtimes like Zend, but we
> have only tested this with HHVM.

> Currently, we only support debugging [remote](/docs/features/remote/) projects.

### Xdebug

In order for the [Nuclide Debugger](/docs/features/debugger) to attach properly to the HHVM process, you must enable
[Xdebug](https://xdebug.org/) in your HHVM configuration.

> Your remote server may already have the appropriate settings, if so, this step is not necessary.

You do this by specifying [Xdebug configuration](https://xdebug.org/docs/all_settings) information
in a `.ini` file that will be passed to the HHVM executable. Here is an example `xdebug.ini` file that can
be used:

```bash
xdebug.enable = 1
xdebug.remote_enable = 1
xdebug.remote_autostart = 1
xdebug.overload_var_dump = 0
xdebug.remote_port = 9000
```

> In the Nuclide Settings, there is an option to specify the remote port as well. If you specify
> the port in an `.ini` file with `xdebug.remote_port`, make sure it matches what is in the
> Nuclide port setting found under `nuclide-debugger-php`.

Make sure the **Arguments for your PHP runtime** setting points to your `.ini` file.

***Example***

```bash
-c /root/docker-shared/code/xdebug.ini
```

The **Path to your PHP runtime** setting should indicate the location of HHVM on your server, such as `/usr/bin/hhvm`.


### Debugging: HHVM Toolbar

The [Task Runner toolbar](/docs/features/task-runner) is one way to debug Hack or PHP projects.  To open the Task Runner toolbar, click on the **Toggle Task Runner Toolbar** button in the [Nuclide toolbar](/docs/features/toolbar/#buttons) or search for `Nuclide Task Runner: Toggle HHVM Toolbar` in the [Command Palette](/docs/editor/basics/#command-palette).

See the [Task Runner HHVM guide](/docs/features/task-runner/#hhvm-debug-toolbar) for instructions on debugging Hack or PHP projects.

### Debugging: Command-Line

You can also debug directly from the command-line.

1. Have a PHP or Hack file active in the [Editing Area](/docs/editor/basics/#editing-area).
2. Click on the **Toggle Debugger** icon in the [Nuclide toolbar](/docs/features/toolbar/#buttons) or press `Cmd-Shift-A` (`Ctrl-Shift-A` on Linux or Windows) to bring up the Debugger Attach dialog.
3. The connection will default to the location of your current working root. If necessary, click the machine name to change to another connection.
4. Select the **PHP/Hack** tab.
5. Click **Attach**.

    ![](/static/images/docs/feature-debugger-selection-attach-server.png)

6. Set [breakpoints](/docs/features/debugger/#basics__breakpoints) in your code.
7. Run your PHP/Hack script or server
    1. If you are running a script: `hhvm -c xdebug.ini your-script.php`
    2. If you are running a server: `hhvm -c xdebug.ini -m server`
8. Start Debugging.

*Note:* If you are debugging a server, you will need to send a request to that server in order for
    the server breakpoint to be hit.

### Console

While debugging, HHVM will send its stdout to the Console below the Editing Area. This also includes output from `print()` (or similar) statements and stack traces.

### Evaluation

Basic [evaluation](/docs/features/debugger/#basics__evaluation) in the REPL works out of the box.

You can also load bindings from your project so that you can interact with them in the console. To
do this, make sure there is a `.hhconfig` file checked in at the root of your project, as well as a
`scripts/xdebug_includes.php` file.  The `xdebug_includes.php` file must contain at least one call to the
`xdebug_break` function.  Here is an example of such a file:

```php
<?hh

// This file is named 'xdebug_includes.php' and lives inside a directory named 'scripts/'.

// Put code here that loads context into the environment.  For example, you can use PHP's require to
// import function and variable bindings, which will then be available via the REPL.

xdebug_break(); // Pauses the runtime's execution when XDebug mode is enabled.
```

Now when you debug your Hack or PHP project, the Nuclide Debugger will also make a separate
connection to the runtime and launch this script.  Any context loaded before calling
`xdebug_break()` will be accessible via the REPL.

### Filtering

After you attach to a remote server with HHVM, the Debugger will utilize the *first* instance
of HHVM that is run with the correct `.ini` configuration, etc. If you are running multiple
instances of HHVM with that configuration, you might start debugging different code unintentionally.

Nuclide provides a mechanism to filter out the proper, intended script. For example, if you know
the script name that will be debugged, then use that as the filter.

Go to `Settings | Packages | Nuclide | Settings` and look for `nuclide-debugger-hhvm: Script Path Filter Regexp`.

![](/static/images/docs/feature-debugger-languages-hack-php-filtering.png)

### Other Settings

There are other Hack and PHP debug settings that can be set as they pertain to HHVM. These include:

- Filtering debugging connections by user name (`idekey`). By default, this is set to the user that started the HHVM process (you can override this with `xdebug.idekey` in an `.ini` file).
- HHVM logging level. The default is `INFO`.
- Debugging Port. The default is `9000`. If you override this is in an `.ini` file, ensure that the Nuclide setting matches this setting.

Go to `Settings | Packages | Nuclide | Settings` and look for the `nuclide-debugger-php` settings.
