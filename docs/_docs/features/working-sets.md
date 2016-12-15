---
pageid: feature-working-sets
title: Working Sets
layout: docs
permalink: /docs/features/working-sets/
---

It can be common to have a
[large project](/docs/editor/basics/#project-explorer__adding-projects) with a root folder
that has a bunch of children folders and files underneath it. However, your work in that project may only exist in one or a few of the files within the project. The rest of the files are just noise in the [File Tree](/docs/editor/basics/#project-explorer).

Working Sets allow you to select a subset of folders or files in your project that you
are interested in, hiding all of the other folders and files to display a sparser File Tree.

* TOC
{:toc}

## Defining Working Sets

To define a Working Set, go to the upper right corner of the [Project Explorer](/docs/editor/basics/#project-explorer). As
you move your mouse there, you will see a **+** button appear.

![](/static/images/docs/feature-working-set-begin.png)

Clicking on the **+** button toggles the File Tree to allow for selecting folders and files to add to the Working Set you are currently creating.

After selecting all the folders and files that you want, enter a name for the Working Set in the text box next to the checkmark.

![](/static/images/docs/feature-working-set-add.png)

> Click on the **-** button to cancel the creation of the Working Set.

Once you create the Working Set you will see the File Tree reduced to only those files and folders
that you selected.

![](/static/images/docs/feature-working-set-created.png)

You can create as many Working Sets as you like. Just click on the **+** button again. Every time you
create a new Working Set, you will see the entirety of the project tree again for choosing files
and folders.

> Files and folders can overlap in Working Sets. This might be useful when
> [toggling Working Sets](#toggling-working-sets).

## Toggling Working Sets

By default, all Working Sets are active as you create them. This means all of the files and folders
for every Working Set is shown combined in the File Tree.

Here is an example of three Working Sets shown.

![](/static/images/docs/feature-working-set-all-working-sets.png)

However, you can toggle which Working Sets are active.

![](/static/images/docs/feature-working-set-select-active.png)

> You can also press `Ctrl-S` or go to `Nuclide | Working Sets | Select Active` to choose your
> active Working Sets.

To deactivate a Working Set, click on its name. You will see the check mark
disappear, and the folders and files of that Working Set will be removed from the File Tree.

![](/static/images/docs/feature-working-set-deactivate.png)

> Pressing `Ctrl-Shift-S` or going to `Nuclide | Working Sets | Toggle Last Selected` will allow
> you to toggle between the full project tree and the currently active Working Set(s).

## Editing Working Sets

You can also edit and delete Working Sets.

![](/static/images/docs/feature-working-set-edit.png)

By clicking on the trash can, the Working Set is deleted, and if active, the files and folders of
that Working Set will be removed from the File Tree.

> If a folder or file is part of another active Working Set, then it will remain in the File Tree.

By clicking on the pencil, you can add or remove folders and files from that Working Set. You can rename the Working Set as well.

## Opening Non-Working Set Files

You can open files that do not belong to a Working Set. If, for example, you use
[Quick Open](/docs/features/quick-open) to open a file that is not part of a Working Set, then that file and its parent folders
will be shown *grayed out* in the File Tree.

![](/static/images/docs/feature-working-set-not-working-set-file.png)

> If you close the non-Working Set file, it will be removed from the File Tree.
