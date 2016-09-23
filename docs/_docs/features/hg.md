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

## Diff View

The Diff View allows you to quickly see what has changed in the files you have modified. It
shows what has changed from the current committed revision.

If you *right-click* in the editor, you will see the **Open in Diff View** option in the context-aware menu (alternatively, you can use `Alt-Cmd-Shift-D` on Mac or `Alt-Ctrl-Shift-D` on Linux).

![](/static/images/docs/feature-hg-diff-view-access.png)

The Diff View opens in a new tab in the [Editing Area](/docs/editor/basics/#editing). In the bottom pane are the files that
have been modified, along with the Mercurial commit on which this diff is based. Click on a file
in the bottom pane to see the changes for that file.

The left pane shows what is currently committed for that file, while the right pane displays what you have
changed. The highlighted sections are the changed lines.

Here is a picture of the Diff View in action.

![](/static/images/docs/feature-hg-diff-view-actual.png)

If you are tracking, for example, a remote bookmark, and you have a stack of diffs that that have
not been pushed to that remote, then the Diff View will show you the entire stack of bookmarks.
If you click on each bookmark, you will see the changes associated with that bookmark and all of its
children, as compared to the remotely tracked bookmark.

![](/static/images/docs/feature-hg-diff-view-stacked.png)

## Blame

Nuclide provides the capability to show you line-by-line
[blame (or annotate)](https://selenic.com/hg/help/annotate) for the current file within your
Mercurial repository.

If you *right-click* in the editor, you will see the **Toggle Blame** option in the context-aware menu.

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

If a line has been modified, you will see an orange vertical line in the gutter. If a new line of
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
