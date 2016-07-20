---
pageid: help-troubleshooting
title: Troubleshooting
layout: docs
permalink: /docs/help/troubleshooting/
---

If you are having problems with Nuclide itself, check out some of these troubleshooting tips. More
are being added as we come across common issues found by users. If you have an issue that is not
listed here, please [file a GitHub issue](https://github.com/facebook/nuclide/issues), and
depending on how widespread the problem may be, we will add it here as well.

* TOC
{:toc}

## Nuclide Server

### Installation

If you are having issues installing the [Nuclide Server](/docs/features/remote#nuclide-server),
check out the following tips:

*Node Version*

Verify that you are using the correct node version by running:

```bash
node --version
```

and verifying that you have version 5.0.0 or higher.

*Permissions*

If you get `EACCESS` errors when you `npm install`, then you likely do not have your NPM properly
configured for installing global packages without root permissions. To fix this problem, install in
a directory your user owns like this:

```bash
npm config set prefix '~/.npm_packages'
```

and add

```bash
PATH=$PATH:$HOME/.npm_packages/bin; export PATH
```

to the end of your `.profile`.  Now you should be able to run:

```bash
npm install -g nuclide
```

without errors.

If you previously ran `npm install` as root you may need to correct the permissions on your `.npm`
directory by running:

```bash
sudo chown -R userid:userid .npm
```

where `userid` is your userid.  If you still get errors you may need to do this:

```bash
npm clear cache
```

### Files Not Syncing

Sometimes you'll have a setup that used to work, but starts to fail. Here some things you can try to make it work again:
- If you have a version mismatch you'll want to run `npm update -g nuclide` on the server and on the client you'll want to make sure you have the same version as well.
- Other tools that watch files may cause problems as well. Try stopping that process and stopping the file watcher as well via `watchman shutdown-server`. Then try to reconnect to the server again from Atom.
- Try `killall node` on the server side. Then try connecting again.

## Environment Issues

### Custom `$PATH`

In general, it is perfectly fine to open Atom/Nuclide from something like the Dock. However, if
you have installed certain Nuclide prerequisites outside of a location that is not in your default
`$PATH`, you may run into issues. This is because does not inherit any custom changes to `$PATH` or
other environment variables when opening Atom/Nuclide outside of a command line environment.

For example, if you have installed HHVM in a location that is specified in your `.bashrc`,
Atom/Nuclide will not see that location, and thus not be able to load HHVM for debugging Hack
programs.

However, *opening Atom/Nuclide from the command line* will inherit any custom changes to your
environment variables.

This is a [known issue](https://github.com/AtomLinter/Linter/issues/150), and there are possible
[workarounds](http://serverfault.com/a/277034).

### Uninstalling Older Versions of Nuclide

[Nuclide v0.0.35](https://github.com/facebook/nuclide/releases/tag/v0.0.35) and earlier was released
as many separate Atom packages. If you have any packages starting with `nuclide-`, you likely have
some part of <=v0.0.35 still installed.

Run the uninstall command below, which contains the full list of Nuclide's packages when they were
last released on 25 November 2015. This is safe to run even if you only have a subset of the
packages installed; `apm` will ignore any packages that are not present.

```bash
$ apm uninstall \
hyperclick \
nuclide-arcanist \
nuclide-blame \
nuclide-blame-provider-hg \
nuclide-blame-ui \
nuclide-buck-files \
nuclide-busy-signal \
nuclide-clang-atom \
nuclide-clipboard-path \
nuclide-code-format \
nuclide-code-highlight \
nuclide-debugger-atom \
nuclide-debugger-hhvm \
nuclide-debugger-lldb \
nuclide-diagnostics-store \
nuclide-diagnostics-ui \
nuclide-diff-view \
nuclide-file-tree \
nuclide-file-watcher \
nuclide-find-references \
nuclide-flow \
nuclide-format-js \
nuclide-fuzzy-filename-provider \
nuclide-hack \
nuclide-hack-symbol-provider \
nuclide-health \
nuclide-hg-repository \
nuclide-home \
nuclide-installer \
nuclide-language-hack \
nuclide-move-pane \
nuclide-objc \
nuclide-ocaml \
nuclide-open-filenames-provider \
nuclide-quick-open \
nuclide-react-native-inspector \
nuclide-recent-files-provider \
nuclide-recent-files-service \
nuclide-remote-projects \
nuclide-test-runner \
nuclide-toolbar \
nuclide-type-hint \
nuclide-url-hyperclick
```
## Flow Issues

### Features Not Working

If the Flow features are not working in Nuclide:

- Make sure `flow` is on your [`$PATH`](#flow-issues__flow-and-path).
- Ensure that you have `/* @flow */` at the top of your `.js` file.
- Ensure you have an empty `.flowconfig` file in the root of of your project directory.

### `flow` and `$PATH`

If installed `flow` in a place not on your `$PATH` (e.g., unzipped it in your home directory which
is not on your `$PATH`), then you either have to update your `$PATH` or explicitly specify it.

![](/static/images/help/troubleshooting-settings-nuclide-flow-executable.png)

### Module Not Found

If you are [running Nuclide from source](/docs/advanced-topics/building-from-source/), you may
occasionally run into a `Cannot find module` error.

![](/static/images/help/troubleshooting-module-not-found.png)

As Nuclide is continuously updated, new modules may be added as dependencies. When you rebase to
the latest code and run Nuclide, the new module will not have been installed, so it will not be
found.

Running `npm update` will get you the latest modules so that you should be able to open Nuclide
successfully again.
