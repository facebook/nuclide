---
pageid: help-faq
title: FAQ
layout: docs
permalink: /docs/help/faq/
---

Here is an ever-growing list of frequently asked questions around Nuclide.

* TOC
{:toc}

## How do I open Nuclide?

After ensuring you have Nuclide [set up](/docs/editor/setup/), see the [Opening](/docs/editor/basics/#opening) section in Nuclide [Basics](/docs/editor/basics/) for instructions.

## What version of Nuclide is installed?

You can determine the installed version of Nuclide with the [Atom Package Manager](https://github.com/atom/apm) (APM) from the command-line.

```bash
$ apm list --no-dev --installed
```

The output will contain installed Atom packages and their versions.

```bash
/Users/foobar/.atom/packages (1)
└── nuclide@X.Y.Z
```

Your installed version is the number following either the `nuclide` package or the first package
starting with `nuclide-`. In the example above, the installed version is `X.Y.Z`.

## How do I return Nuclide to a known state?

To reset Atom and Nuclide to factory settings, removing all your packages and settings, do the following:

1. Quit Atom.
2. Reinstall Atom.app.
3. Reset Atom's settings (optional, but recommended).

    > This will delay any custom settings and packages.

    On your machine, run:

        rm -rf ~/.atom

4. Reset Atom's cache (optional, but recommended).
    On your machine, run:

         rm -rf ~/Library/Application\ Support/Atom

5. Kill the Nuclide Server (if you have one).
    If you are running the Nuclide Server on a remote machine, SSH into it and run:

        pkill -f nuclide

6. Reinstall Nuclide.

## How can I make Nuclide like my favorite editor?

Becaue Nuclide is a package on top of Atom, it is infinitely configurable with a massive collection of open source packages.  If you want Atom to behave more like your favorite editor, try one of these:

* Vim
  * [vim-mode-plus](https://atom.io/packages/vim-mode-plus)
  * [ex-mode](https://atom.io/packages/ex-mode)
* Emacs
  * [emacs-plus](https://atom.io/packages/emacs-plus)

## Can I write a script to automate basic Atom/Nuclide functionality?

Atom provides a customizable `init.coffee` script that has full access to the Atom APIs and is executed at startup.  For more information, see [Hacking Atom - The Init File](http://flight-manual.atom.io/hacking-atom/sections/the-init-file/).

You can access the `init.coffee` script by going to `Atom | Init Script...`.

It's easy to create your own commands with keybindings (you can also configure keybindings in a separate file, see [Keymaps In-Depth](http://flight-manual.atom.io/behind-atom/sections/keymaps-in-depth/)).

>You have to reload Atom to test your changes.

## Can the Nuclide Server use ports other than 9090-9093?

With Nuclide's default server configuration you may run into port number conflicts on your remote server.  To specify a specific port for the server to use, you can provide the `--port` option along with the remote server command.

## Can I print from Nuclide?

Unfortunately, this is not currently available as an option in Atom and doesn't appear to be something they will be adding.  For more information, see [https://discuss.atom.io/t/printing-support/760/45](https://discuss.atom.io/t/printing-support/760/45).

## How can I make the File Tree always automatically scroll to the current active file?

1. Open the **Settings** tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-file-tree`.
5. Select the **Reveal File on Switch** checkbox.

<img src="/static/images/docs/help-faqs-reveal-file-on-switch.png" style="width:800px" />

## How can I jump to the last cursor position in a file?

Assume you performed an action that caused the cursor to jump to a new position.  How do you go back?

Use the Nuclide Navigation Stack commands:

- Forward navigation: `Ctrl-,` (`Ctrl-<` on Linux and Windows)
- Backward navigation: `Ctrl-.` (`Ctrl->` on Linux and Windows)

## Is there a way to search only files in the Working Set?

Unfortunately, no.  The external search tools Nuclide uses are not aware of the Working Sets.  Nuclide also provides the external search tools with the upper limit on result set size preventing purely client-side filtering.

## How do I disable Most Recently Used tab switching?

Atom 1.7.0 introducted Most Recently Used (MRU) tab switching.  To revert to the old behavior:

1. Go to `Atom | Keymap...`. This will open the `keympa.cson` file.
2. Add

        'body':
          'ctrl-tab': 'pane:show-next-item'
          'ctrl-tab ^ctrl': 'unset!'
          'ctrl-shift-tab': 'pane:show-previous-item'
          'ctrl-shift-tab ^ctrl': 'unset!'

## Can Nuclide save the tabs I have open for each branch/bookmark?

Yes, Nuclide's Bookshelf feature can save the tabs you have open for each branch/bookmark. When you switch between bookmarks, it will prompt you about restoring the files you had open.

To control Bookshelf behavior:

1. Open the **Settings** tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-bookshelf`.
5. Select **Always Restore**, **Always Ignore**, or **Prompt to Restore**.

<img src="/static/images/docs/help-faqs-bookshelf.png" style="width:800px" />

## Tabs become too small to read the file names when I have many tabs open.

>This is an issue in Atom.

One work-around is to make the tabs display in multiple rows.

1. Go to `Atom | Stylesheet...`. This will open the `styles.less` file.
2. Add

        // Make tabs multi-row
        .tab-bar {
          height: auto;
          flex-wrap: wrap;
          .tab,
          .tab.active {
            flex: 1 0 auto;
            height: 30px;
            line-height: 27px;
          }
          .tab .title,
          tab.active .title {
            padding-right: 5px;
            position: relative;
            top: 1px;
          }
          .tab .close-icon,
          .tab.active .close-icon {
            line-height: 29px;
          }
        }

## How do I report bugs, request features, or ask general questions about how to use Nuclide?

If you've encountered a *bug*, please see the [GitHub Issues page](https://github.com/facebook/nuclide/issues) to see if anyone else has encountered the same problem and to report it as an issue if it is new.

If you have a *feature request* or *general question*, the [Nuclide Community](https://www.facebook.com/groups/nuclide/) Facebook group is a good place to post.
