---
pageid: quick-start-getting-started
title: Getting Started
layout: docs
permalink: /docs/quick-start/getting-started/
---

This getting started guide walks you through the core features of Nuclide and aims to get you productive quickly.

* TOC
{:toc}

## Installation

The [installation guides](/docs/editor/setup/) provide detailed information to install
Nuclide on your platform, but if you have already met the platform dependent prerequisites
([Mac](/docs/editor/setup/#mac__prerequisites) | [Linux](/docs/editor/setup/#linux__prerequisites)),
you can install Nuclide with one command:

```bash
apm install nuclide
```

> Nuclide is [not currently supported on Windows](/docs/editor/setup/#windows).

While technically optional, in order for features such as [`Quick Open`](#quick-open) to work
correctly, you also need to install [`Watchman`](https://facebook.github.io/watchman/) and
ensure it is in your `$PATH` environment variable. There are other
[recommended package installations](/docs/editor/setup/#post-installation) as well.

## Launch

After installation, launch Nuclide by [opening Atom](/docs/editor/basics/#opening). Once Atom
is open, you should see the Nuclide Home page.

![](/static/images/docs/quick-start-getting-started-home-page.png)

- The left side-pane is the Nuclide File Tree view.
- The main pane contains introductory information about Nuclide and the Quick Launch Menu. This is also where you will edit your files (just like in normal Atom).
- The bottom status bar shows you error and health statistics.

## Adding a Project

The first common step after launching Nuclide is to open a project you would like to work on.
This could be a [Hack](/docs/languages/hack/), [Flow](/docs/languages/flow/), or any other project that has a root directory.

To add a project, click the `Add Project Folder` button in the left side-pane, use
the `Cmd-Shift-O` keyboard shortcut (`Ctrl-Shift-O` on Linux), or choose
`File | Add Project Folder` from the Atom menu bar.

![](/static/images/docs/quick-start-getting-started-add-project.png)

After adding a project you will see the root of your project at the top of the File Tree with all
files and folders as a tree hierarchy underneath it.

![](/static/images/docs/quick-start-getting-started-file-tree-view.png)

## Quick Launch Menu

On the Nuclide Home page you will find the *Quick Launch Menu* that gives quick access to many of
the popular features of Nuclide. Click the `Try It` button to use each feature.

![](/static/images/docs/quick-start-getting-started-quick-launch.png)

## Quick Open

The [*Quick Open*](/docs/features/quick-open) feature gives you access to Nuclide's file
search mechanism, including *OmniSearch*, which quickly displays recently opened files, quick searches for files based on partial names, and depending on the project, can search within files for symbols, etc. Click `Try It` or use the `Cmd-T` keyboard shortcut (`Ctrl-T` on Linux) to access the feature.

![](/static/images/docs/quick-start-getting-started-quick-open.png)

You can also search by filenames in your project, filenames of currently open files, and see which files have been
recently opened.

## Remote Connection

Nuclide provides the ability to do [remote development](/docs/features/remote/) out of the box. This
allows you to have Nuclide installed on a local machine, your project on a remote machine, and have
your editing experience be seamless between the two.

Nuclide provides a *server* that bridges your local client with the remote development machine. In
order for remote development to work correctly, you must meet the
[prerequisites](/docs/features/remote/#nuclide-server__prerequisites) on the remote machine before
installing the Nuclide server.

Once the prerequisites are met, you can
[install the server](/docs/features/remote/#nuclide-server__setup) on the remote machine.

In order to connect to your remote project, click on the `Try It` button next to
*Remote Connection* in the *Quick Launch Menu*. You can also select `Packages | Connect`, use the `Ctrl-Shift-Cmd-C` keyboard shortcut, or click `Add Remote Project Folder`
in the left side-pane (however, please note that if you have other projects open that button will not be there).

![](/static/images/docs/quick-start-getting-started-remote-connection-dialog.png)

Enter all the necessary credentials, including the username for logging into the remote server, the
server's address, and the actual root directory of the remote project you want to open. Then, if you installed the Nuclide Server as instructed, the *Remote Server Command* is
`nuclide-start-server`.

Any changes you make in the local Nuclide editor will be communicated back to the remote server and
properly synchronized.

## Diff View

Nuclide has built-in support for [Mercurial-based repositories](/docs/features/hg). If your
project is using Mercurial, one of the features that may help your workflow is the
[*Diff View*](/docs/features/hg/#diff-view). This allows you to quickly see what has changed in the
files you have modified. It shows what has changed from the current committed revision which you
are tracking.

To access the Diff View, click the `Try It` button, use the `Alt-Cmd-Shift-D` keyboard shortcut, or select `Packages | Diff View` after making a change to one of the files in your Mercurial project.

![](/static/images/docs/quick-start-getting-started-diff-view.png)

When the *Diff View* window tab appears, click on a changed file in the right pane to have the *Diff View* window highlight any changes.
