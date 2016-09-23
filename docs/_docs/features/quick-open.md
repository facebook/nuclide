---
pageid: feature-quick-open
title: Quick Open
layout: docs
permalink: /docs/features/quick-open/
---

Nuclide goes beyond just normal file opening capabilities. Quick Open provides multiple
mechanisms to find a file, from recently opened files to a global OmniSearch that lets you search
for anything a file might contain.

* TOC
{:toc}

## Toggling

There are three ways to toggle the **Quick Open** window.

- The `Cmd-T` (macOS) or `Ctrl-T` (Linux) keyboard shortcuts.
- [Command palette](/docs/editor/basics/#command-palette) searching for
`Nuclide Quick Open: Find Anything Via Omni Search`.
- [Quick Launch](docs/quick-start/getting-started/#quick-launch-menu) menu.

![](/static/images/docs/feature-quick-open-toggle-window.png)

> The `Hack Symbols` pane will only show if you have [Hack](/docs/languages/hack) files in your
> project.

## OmniSearch

*Keyboard Shortcuts*: `Cmd-T` or `Cmd-P` (`Ctrl-T` or `Ctrl-P` on Linux)

When launching the **Quick Open** window, you will be taken to the **OmniSearch** tab. All of the
features of the other tabs are coalesced and condensed into your search results in this tab.

![](/static/images/docs/feature-quick-open-omnisearch.png)

## Filenames

*Keyboard Shortcut*: `Option-Cmd-T` (`Alt-Ctrl-T` Linux)

If you just want to search by filename (including within the path to the file) only, you can click
on the **Filenames** tab in the **Quick Open** window.

![](/static/images/docs/feature-quick-open-filenames.png)

## Open Files

*Keyboard Shortcut*: `Option-Cmd-O` (`Alt-Ctrl-O` Linux)

If you have a lot of files open in your [editor](/docs/editor/basics), you can use the **Open Files** tab of Quick Open to quickly scan a list of your currently open files.

![](/static/images/docs/feature-quick-open-open-files.png)

## Recent Files

*Keyboard Shortcut*: `Option-Cmd-R` (`Alt-Ctrl-R` Linux)

If you have recently closed a file and would like to quickly open it back up, you can use the
**Recent Files** tab of Quick Open. This tab also displays when you last opened the file(s).

![](/static/images/docs/feature-quick-open-toggle-recent-files.png)

## Hack Symbols

*Keyboard Shortcut*: `Option-Cmd-Y` (`Alt-Ctrl-Y` Linux)

If your project contains [Hack](/docs/languages/hack) code, you will get Hack language-specific
search options. Here you can search based on function (`@function-name`), class (`#class-name`), or
constant (`%constant-name`) symbols in your project.

To access this feature, click on the **Hack Symbols** tab in the **Quick Open** window.  

![](/static/images/docs/feature-quick-open-toggle-hack-symbols.png)
