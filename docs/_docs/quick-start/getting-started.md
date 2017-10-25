---
pageid: quick-start-getting-started
title: Getting Started
layout: docs
permalink: /docs/quick-start/getting-started/
---

This getting started guide walks you through the core features of Nuclide and aims to get you productive quickly.

If you are new to Atom, you can find more information about its features in the [Atom Flight Manual](http://flight-manual.atom.io/).  Then, to find out more about using Nuclide, see [Basics](/docs/editor/basics) or any of the other guides available in the Nuclide documentation.
<br />

* TOC
{:toc}

## Installation

The [installation guides](/docs/editor/setup/) provide detailed information to install
Nuclide on your platform, but if you have already met the platform dependent prerequisites
([macOS](/docs/editor/setup/#macos__prerequisites) | [Linux](/docs/editor/setup/#linux__prerequisites)),
you can install Nuclide easily from within Atom itself.

> Nuclide can be installed on [Windows](#windows), but it is [not fully supported](https://github.com/facebook/nuclide/issues/321).

<br />

1. Open Atom.
2. Choose `Atom | Preferences` (`Edit | Preferences` on Linux and `File | Settings` on Windows) to bring up the **Settings** tab.
3. In the **Settings** tab, select **Install** from the list at the left.
4. In the search box, type "Nuclide" and press the `Enter` key.
5. Click the **Install** button for the `nuclide` package.

![](/static/images/docs/editor-setup-atom-install-nuclide.png)

> Installing Nuclide within the Atom Packages UI is the recommended method, however you can install Nuclide from the command-line, if you wish, using:
>
```bash
$ apm install nuclide
```
>

<br />

### Packages

If you want features such as [Quick Open](#quick-open), [Remote Development](/docs/features/remote), and [Mercurial support](/docs/features/hg) to work correctly, you also need to install [Watchman](https://facebook.github.io/watchman/) and ensure it is in your `$PATH` environment variable. There are other [recommended package installations](/docs/editor/setup/#post-installation) as well.

## Launch

After installation, launch Nuclide by [opening Atom](/docs/editor/basics/#opening). Once Atom
is open, you should see the Nuclide Home page.

![](/static/images/docs/quick-start-getting-started-home.png)

- The left side-pane is the Nuclide [Project Explorer](/docs/editor/basics/#project-explorer).
- The main pane contains introductory information about Nuclide and the Quick Launch Menu. This is also where you will edit your files (just like in normal Atom).
- The bottom status bar shows you error and health statistics.

## Adding a Project

The first common step after launching Nuclide is to open a project you would like to work on.
This could be a [Hack](/docs/languages/hack/), [Flow](/docs/languages/flow/), or any other project that has a root directory.

To add a project, click the **Add Project Folder** button in the left side-pane, use the `Cmd-Shift-O` keyboard shortcut (`Ctrl-Shift-O` on Linux), or choose
`File | Add Project Folder` from the Atom menu bar.

![](/static/images/docs/quick-start-getting-started-add-project.png)

After adding a project you will see the root of your project at the top of the [Project Explorer's](/docs/editor/basics/#project-explorer) File Tree with all
files and folders as a tree hierarchy underneath it.

![](/static/images/docs/quick-start-getting-started-file-tree-view.png)

## Quick Launch Menu

On the Nuclide Home page you will find the Quick Launch Menu that gives quick access to many of
the popular features of Nuclide. Click the **Try It** button of any feature to use it.

![](/static/images/docs/quick-start-getting-started-quick-launch-menu.png)

## Quick Open

The [Quick Open](/docs/features/quick-open) feature gives you access to Nuclide's file
search mechanism, including [OmniSearch](/docs/features/quick-open/#omnisearch), which quickly displays recently opened files, quick searches for files based on partial names, and depending on the project, can search within files for symbols, etc. Click **Try It** or use the `Cmd-T` keyboard shortcut (`Ctrl-T` on Linux) to access the feature.

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

In order to connect to your remote project, click on the **Try It** button next to
**Remote Connection** in the Quick Launch Menu. You can also select `Nuclide | Remote Projects | Connect to Remote Project...`,
use the `Ctrl-Shift-Cmd-C` keyboard shortcut, or click **Add Remote Project Folder**
in the [Project Explorer](/docs/editor/basics/#project-explorer) (however, please note that if you have other projects open that button will not be there).

![](/static/images/docs/quick-start-getting-started-remote-connection-dialog.png)

Enter all the necessary credentials, including the username for logging into the remote server, the
server's address, and the actual root directory of the remote project you want to open. Then, if you installed the Nuclide Server as instructed, the **Remote Server Command** is
`nuclide-start-server`.

Any changes you make in the local Nuclide editor will be communicated back to the remote server and
properly synchronized.
