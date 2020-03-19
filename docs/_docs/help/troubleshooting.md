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

## Help! I think Nuclide is broken.

It is probably best to [return Nuclide to a known state](/docs/help/faq/#how-do-i-return-nuclide-to-a-known-state).  This can solve a variety of bizarre problems.

## Command-Line Issues

If `atom` or `apm` don't work from the command line, try removing the `/usr/local/bin/atom` and `/usr/local/bin/npm` symlinks and restarting Atom. Or, select **Install Shell Commands** from the `Atom` menu.

## Settings Issues

### Keyboard Shorts aren't working

* Is the keyboard shortcut registered?
  1. Open the **Settings** tab either by pressing `Cmd-,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
  2. Select **Keybindings** from the list at the left to see what keybindings you have active.

* Check your system keyboard shortcuts.
    There may be another application that is intercepting the shortcut before it reaches Atom.

## Nuclide Server Issues

### Installation

If you are having issues installing the [Nuclide Server](/docs/features/remote#nuclide-server),
check out the following tips:

*Node Version*

<p class="node"></p>

Use the command-line to verify your Node version by running:

```bash
node --version
```

*Permissions*

If you get `EACCESS` errors when you run the `npm install` command, you likely do not have your NPM properly
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

If you previously ran `npm install` as root, you may need to correct the permissions on your `.npm`
directory by running:

```bash
sudo chown -R userid:userid .npm
```

where `userid` is your userid.  If you still get errors you may need to clear your NPM cache with:

```bash
npm cache clear
```

### Files Not Syncing

Sometimes you'll have a setup that used to work, but starts to fail. Here some things you can try to make it work again:

* If you have a version mismatch between your client and remote server Nuclide installations, you'll want to run `npm update -g nuclide` on the server and make sure you have the same version on the client as well.
* Other tools that watch files may cause problems as well. Try stopping that process and stopping the file watcher as well via `watchman shutdown-server`. Then try to reconnect to the server again from Atom.
* Use `killall node` on the server side, then try reconnecting.

## Source Control Issues

### Source Control features aren't working

If any Source Control features such as File Tree highlighting are working in Nuclide, there are a few things to check.

1. Is the directory you opened in Atom part of a source control repository?
2. If you are working on a remote directory, only [Mercurial](/docs/features/hg/) is supported.  Git will not work.
3. As of Atom 1.14, symlinks to directories essentially don't work, even if it's a Mercurial repository. Use a direct link to the directory to access all the source control features.

### Why is the output of `hg status` wrong?

Files not showing up as expected in `hg status` are generally caused by one of a few things:

1. The file is ignored.

    You can run `hg status -i` to list ignored files.

        hg status -i | grep <filename>

2. Watchman Issues

    Sometimes Watchman, the filesystem monitoring tool, isn't telling Mercurial that a file has been added, removed, or changed.  You can check if it's a Watchman issue by running a status command without the Watchman extension:

        hg status --config extensions.fsmonitor=\!

    If the file shows up when you do that, it's a Watchman issue.  In that case, run:

        watchman-diag > out.txt

    Sometimes on Macs, the output file might contain:

        There are 139 items on the filesystem not reported by watchman:
        ...

    If you see this and if any components of the listed file names either are or were at some point a symlink, then you have fallen afoul of an Apple bug where fsevents won't report changes associated with a dangling symlink.  You might be able to recover with:

        watchman watch-del-all
        hg --config fsmonitor.mode=off rebase -s '(::bookmark() and draft()) - master::' -d master
        watchman watch-project .

3. Dirstate Corruption

    This happens most often because someone pressed `Ctrl-C` during a Mercurial command that was writing to the dirstate file (an index of all the files in the working directory).  This corruption can be subtle and you might not notice any issues with it for a while, until you notice files not showing up that really should.

    In this case, try running:

        hg debugrebuilddirstate --minimal

    Then, run `hg status` again.

4. Unknown Bugs

    Mercurial is under heavy development and there may be bugs we don't know about yet that cause issues like this.  If you've verified that the above things don't work to fix the issue, let us know by filing a [GitHub issue](https://github.com/facebook/nuclide/issues).

## Environment Issues

### Uninstalling Older Versions of Nuclide

[Nuclide v0.0.35](https://github.com/facebook/nuclide/releases/tag/v0.0.35) and earlier were released
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

- Make sure `flow` is in your [`$PATH`](#flow-issues__flow-and-path) environment variable.
- Ensure that you have `/* @flow */` at the top of your `.js` file.
- Ensure you have an empty `.flowconfig` file in the root of of your project directory.

### `flow` and `$PATH`

If you installed `flow` in a place not in your `$PATH` environment variable (e.g., unzipped it in your home directory), then you either have to update your `$PATH` environment variable or explicitly specify it.

1. Open the **Settings** tab either by pressing `Cmd-,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-flow`.
5. Set the location of your `flow` installation in the **Path to Flow Executable** text box.

<img src="/static/images/help/troubleshooting-flow-executable-setting.png" align="middle" style="width:800px"/>

### Module Not Found

If you are [running Nuclide from source](/docs/advanced-topics/building-from-source/), you may
occasionally run into a `Cannot find module` error.

![](/static/images/help/troubleshooting-module-not-found.png)

As Nuclide is continuously updated, new modules may be added as dependencies. When you rebase to
the latest code and run Nuclide, the new module will not have been installed, so it will not be
found.

Running `npm update` will get you the latest modules so that you should be able to open Nuclide
successfully again.

## Buck Issues

### Nuclide says Diagnostics are disabled, but Buck builds my C++ project

Stand-alone header files are not fully supported yet because Buck doesn't report flags for them.

>The majority of features may still work even without complete flags.  You can provide more default flags in the Settings, if necessary.

<br />

1. Open the **Settings** tab either by pressing `Cmd-,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-clang`.
5. Add default flags as necessary.

<img src="/static/images/docs/help-troubleshooting-diagnostic-flags.png" style="width:800px"/>
