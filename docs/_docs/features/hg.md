---
pageid: feature-hg
title: Mercurial Support
layout: docs
permalink: /docs/features/hg/
---

Atom provides [Git support](https://atom.io/docs/v1.5.3/using-atom-version-control-in-atom) in its
core packages. Given Facebook's heavy use of Mercurial, Nuclide extends Atom's source control
integration with support for [Mercurial](https://www.mercurial-scm.org/).

> Nuclide's support for Mercurial is much more full-featured that its support for Git. Nuclide
> has not yet tried to extend the default support for Git provided by Atom.

<br/>

* TOC
{:toc}

## Blame

Nuclide provides the capability to show you line-by-line
[blame (or annotate)](https://selenic.com/hg/help/annotate) for the current file within your
Mercurial repository.

*Right-click* in the editor and select `Source Control | Toggle Blame` in the context-aware menu.

![](/static/images/docs/feature-hg-blame-access.png)

The [gutter](/docs/editor/basics/#gutter) displays the last commit hash on which there was a change for
the line and the user who made the change.

![](/static/images/docs/feature-hg-blame-gutter.png)

## File Tree Highlighting

To the left of the [Editing Area](/docs/editor/basics/#editing-area) is Nuclide's [Project Explorer](/docs/editor/basics/#project-explorer). The Project Explorer's **File Tree** tab shows you all of the files that are in your project. In a Mercurial project, the File Tree will also show you what files have changed since your last commit.

If a file is highlighted orange, it indicates a change in that file since your last commit. If a
folder in your project is highlighted orange, that means that files in that folder have changed
since your last commit. Green files or folders are new. Grey files or folders are ignored or
untracked.

![](/static/images/docs/feature-hg-file-tree-highlight.png)

## Line Modification Notifications

This is a built-in Atom feature that displays in the [gutter](/docs/editor/basics/#gutter) showing any lines
that have been modified since the last commit.

>This feature is not enabled by default.

To enable this setting:

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.
4. Scroll down until you find `nuclide-hg-repository`, and select the **Enables `git-diff` and `status-bar` diff stats to display added, changed, or removed lines in the editor gutter and status bar** checkbox.

![](/static/images/docs/feature-hg-line-mod-gutter-setting.png)

Then, if a line has been modified, you will see an orange vertical line in the gutter, and if a new line of
content has been added, you will see a green vertical line.

![](/static/images/docs/feature-hg-line-modifications.png)

## Added and Removed Lines

This is a built-in Atom feature that displays in the [status bar](/docs/editor/basics/#status-bar) showing the number of lines that have been added and/or removed since the last commit.

The **+** value is the number of lines that have been added. The **-** value is the number of lines
that have been removed.

If you change a line (not added or removed), that counts as both an add and a removal, so you
might see something like "+1, -1" for a one line modification.

![](/static/images/docs/feature-hg-number-of-line-changes.png)

## Bookmark

The [status bar](/docs/editor/basics/#status-bars) also shows the current Mercurial bookmark on
which you are currently working.

![](/static/images/docs/feature-hg-bookmark.png)
