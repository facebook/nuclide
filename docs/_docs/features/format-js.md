---
pageid: feature-format-js
title: Format JS
layout: docs
permalink: /docs/features/format-js/
---

>[Format-js](https://atom.io/packages/nuclide-format-js) is now available as a separate Atom package for use with Nuclide. However, it is currently experimental. For example, this currently does not handle using relative paths for the automatic requires.

Format-js is a package with a goal of getting rid of worrying about every little formatting detail you might run across while writing
[Flow](/docs/languages/flow) or [JavaScript](/docs/languages/other/#javascript) code.  For more information about the Format-js package visit the [Format-js Atom package page](https://atom.io/packages/nuclide-format-js).

To install the Format-js package:

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide-format-js`.
3. Click **Install**.

Currently, Format-js is focused on automatically adding, removing, and formatting, your `require` statements.

## Auto-Require

Adding `require` statements automatically allows you to focus on writing code without
worrying about that overhead. For example, if you try to use a variable that has not been declared
elsewhere, we will try to add it as a `require`.

> This assumes the `require` added is a valid module. Of course, it might not be.
> However, something like the [Flow typechecker](/docs/languages/flow) should tell you when you are
> using `require` on an entity that is not a module.

Take the following code example:

![](/static/images/docs/feature-format-js-before.png)

If you press `Cmd-Shift-I` (`Ctrl-Shift-I` on Linux), your code will be analyzed for types that
you are using in your code that may need to be `require`d. The possible `require`s for your code are then added.

![](/static/images/docs/feature-format-js-after.png)

You can then check if these are correct and modify accordingly. For example, maybe instead of
`const`, you want `var`.

## Settings

There are customizable settings for the Format-js package.

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide-format-js`.
3. Click on the **Settings** button for the Format-js package.

![](/static/images/docs/feature-format-js-settings.png)

You can also enable or disable keybindings in the Format-js settings.

![](/static/images/docs/feature-format-js-keybindings.png)
