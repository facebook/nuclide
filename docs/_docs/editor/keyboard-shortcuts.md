---
pageid: editor-keyboard-shortcuts
title: Keyboard Shortcuts
layout: docs
permalink: /docs/editor/keyboard-shortcuts/
---

You can perform many tasks in Nuclide from the keyboard. Below are the various keyboard shortcuts
available for the sets of functionality that Nuclide has to offer.

> Atom has many more keyboard shortcuts available above and beyond what Nuclide offers. To
> get a complete list of the keybindings, you can go to
> `Packages | Settings View | Show Keybindngs`.

> You can create your own [custom keybindings](/docs/advanced-topics/custom-keybindings) beyond
> those Nuclide provides.

<br/>

* TOC
{:toc}


## Symbols

Here is a legend of symbols that are associated with the keys shown in the keybindings.

| Key | Symbol |
| ----|--------|
| `Alt` or `Option` on macOS | `⌥` |
| `Cmd` on macOS | `⌘` |
| `Ctrl` | `^` |
| `Shift` | `⇧` |
| `Left` | `←` |
| `Up` | `↑` |
| `Right` | `→` |
| `Down` | `↓` |
| `Backspace` | `⌫` |

If you see a comma (`,`) in a key sequence that means *then*, as in "press this sequence, then press that
sequence".

## Common Bindings

These are also described in their respective sections below, but this provides a quick access table
for the most common shortcuts provided by Nuclide.

| Key (macOS) | Key (Linux) | Description |
|-----------|-------------|-------------|
| `Cmd-T` | `Ctrl-T` | Use [OmniSearch](/docs/features/quick-open/#omnisearch) to open files, etc. |
| `Cmd-\` | `Ctrl-\` | Toggle the [Project Explorer](/docs/editor/basics/#project-explorer). |
| `Ctrl-0` | `Ctrl-0` | Toggle between the [Editing Area](/docs/editor/basics/#editing-area) and the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree. |
| `Cmd-K,<arrow>` | `Ctrl-K,<arrow>` | Split the current file to the pane represented by `<arrow>`, where `<arrow>` is the down, up, left or right arrow. |
| `Option-Shift-D` | `Alt-Shift-D` | Open the [Code Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) window. |

## Development

These shortcuts provide quick access to development features such as [Code Diagnostics](/docs/editor/basics/#status-bar__code-diagnostics) (e.g, linting), etc.

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Option-O`| `Alt-O` | `outline-view:toggle` | Toggles the [Outline View](/docs/features/outline-view/) for a supported file so you can easily navigate to class and function definitions. |
| `Cmd-I` | `Ctrl-I` | `nuclide-context-view:toggle` | Toggles the [Context View](/docs/features/context-view/). |

### Hack/Flow/JavaScript

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Option-Shift-Cmd-F` | `Alt-Shift-Ctrl-F` | `find-references:activate` | In projects such as Hack or Flow, this will allow you to find all the references to a selected, highlighted entity in your project. |
| `Option-Cmd-Y` | `Alt-Cmd-Y` | `nuclide-hack-symbol-provider:toggle-provider` | Allows you to search for Hack function, classes and constants within you Hack project.
| `Cmd-Shift-I` | `Ctrl-Shift-I` | `nuclide-format-js:format` | Automatically tries to insert missing `require` statements to your [Flow](/docs/languages/flow/) or [JavaScript](/docs/languages/other/#javascript) project.


### Code Diagnostics

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Option-Shift-D` | `Alt-Shift-D` | `diagnostics:toggle-table`  | Display the window showing you messages about your code. Possible messages include lint, compiler errors, etc. |
| `Option-Shift-A` | `Alt-Shift-A` | `diagnostics:fix-all-in-current-file` | Nuclide can fix certain types of problems for you automatically, including various lint problems. This will allow all those to be fixed in the current file. |
| `Option-Ctrl-<` | `Alt-Ctrl-<` | `diagnostics:go-to-first-diagnostic` | Go to the first diagnostic. |
| `Option-Ctrl->` | `Alt-Ctrl->` | `diagnostics:go-to-last-diagnostic` | Go to the last diagnostic. |
| `Option-<` | `Alt-<` | `diagnostics:go-to-previous-diagnostic` | Go to the previous diagnostic. |
| `Option-Ctrl->` | `Alt->` | `diagnostics:go-to-next-diagnostic` | Go to the next diagnostic. |

## Project Explorer's File Tree

The [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree tab in the left side pane is a tree of all of your project files.

| Key (macOS) | Key (Linux) | Command | Description | Alternative |
|-----------|-------------|---------|-------------|-------------|
| `Right` | `Right` | `expand-directory` | Expand the current directory. | `Ctrl-]` |
| `Left` | `Left` | `collapse-directory` | Collapse the current directory. | `Ctrl-[` |
| `Option-Right` | `Alt-Right` | `recursive-expand-directory` | Expand all the directories from the current to the final directory child. | `Ctrl-Alt-]` |
| `Option-Left` | `Alt-Left` | `recursive-collapse-directory` | Collapse all the directories to the top parent. | `Ctrl-Alt-[`
| `Ctrl-{` | `Ctrl-{` | `recursive-collapse-all` | Collapse the entire [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree to the root. | |
| `Delete` | `Delete` | `remove` | Remove a file or directory from the tree. You will be prompted first to avoid accidental mistakes. | |
| `Cmd-\` | `Ctrl-\` | `toggle` | Toggles whether the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree is shown. | `Cmd-K`, `Cmd-B` |
| `Home` | `Home` | `move-to-top` | Move the selection to the very top of the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree. | |
| `End` | `End` | `move-to-bottom` | Move the selection to the very bottom of the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree. | |
| `Enter` | `Enter` | `open-selected-entry` | Opens the selected entry in the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree. If a directory is selected, then the directory is expanded. If a file is selected, then the file is opened in the main [Editing Area](/docs/editor/basics/#editing-area). | |
| `Cmd-K-Down` | `Ctrl-K-Down` | `open-selected-entry-down` | If a file is selected, it opens the file in the bottom pane. | |
| `Cmd-K-Right` | `Ctrl-K-Right` | `open-selected-entry-right` | If a file is selected, it opens the file in the right pane. | |
| `Cmd-K-Up` | `Ctrl-K-Up` | `open-selected-entry-up` | If a file is selected, it opens the file in the top pane. | |
| `Cmd-K-Left` | `Ctrl-K-Left` | `open-selected-entry-left` | If a file is selected, it opens the file in the left pane. | |
| `Cmd-|` | `Ctrl-|` | `reveal-active-file` | Shows the file that is currently active in the main workspace in the [Project Explorer](/docs/editor/basics/#project-explorer)'s File Tree. | `Cmd-Shift-\` (macOS) or  `Ctrl-Shift-\` (Linux)
| `Ctrl-O` | `Ctrl-O` | `toggle-focus` | Toggles the focus of the current active file. | |

## Files

Whether switching between or searching for or within files, there are some keyboard shortcuts to
help accomplish file tasks a bit faster.

| Key (macOS) | Key (Linux) | Command | Description | Alternative |
|-----------|-------------|---------|-------------|-------------|
| `Cmd-T` | `Ctrl-T` | `nuclide-quick-open:find-anything-via-omni-search` | Use this for a global search of anything within your project, including all files, currently open files, etc. | `Cmd-P` (macOS) or `Ctrl-P` (Linux) |
| `Option-Cmd-O` | `Alt-Ctrl-O` | `nuclide-open-filenames-provider:toggle-provider` | This lets you switch between files that are currently open in the editor. Useful for quickly accessing files if you have a bunch of files open. |
| `Option-Cmd-R` | `Alt-Ctrl-r` | `nuclide-recent-files-provider:toggle-provider` | This will show you files that you have recently opened and used in previous sessions of Nuclide.  |
| `Option-Cmd-T`| `Alt-Ctrl-T` | `nuclide-fuzzy-filename-provider:toggle-provider` | This allows you to search for files based on patterns. |
| `Option-Cmd-N`| `Alt-Ctrl-N` | `nuclide-related-files:jump-to-next-related-file` | Find files related to the current file. A file is related if they have the same basename, but a different extension, for example. |

## Task Runner

Nuclide has support for running some common tasks on a variety of projects, like building a Buck project or debugging a React-Native one. For these tasks there is a set of useful keybord shortcuts you can use.

| Key (macOS) | Key (Linux) | Command | Description |
|-------------|-------------|---------|-------------|
| `Cmd-B B` | `Alt-B B` | `nuclide-task-runner:build` | Executes the Build task for the currently selected Task Runner or the default one|
| `Cmd-B D` | `Alt-B D` | `nuclide-task-runner:debug` | Executes the Debug task for the currently selected Task Runner or the default one|
| `Cmd-B R` | `Alt-B R` | `nuclide-task-runner:run` | Executes the Run task for the currently selected Task Runner or the default one|
| `Cmd-B T` | `Alt-B T` | `nuclide-task-runner:test` | Executes the Test task for the currently selected Task Runner or the default one|
| `Cmd-B P` | `Alt-B P` | `nuclide-task-runner:run-selected-task` | Executes the currently selected Task|

## Debugger

The [Nuclide Debugger](/docs/features/debugger/) attaches to a running process. [Breakpoints](/docs/features/debugger/#basics__breakpoints) are managed in the [gutter](/docs/editor/basics/#gutter) to the left of your code and line numbers.

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Option-Cmd-I` | `Alt-Ctrl-I` | `window:toggle-dev-tools` | Toggle the developer tools UI. |
| `Shift-Cmd-A` | `Shift-Ctrl-A` | `debugger:show-attach-dialog` | Shows the process attachment UI where you will choose the process on which you would like to debug (e.g., a Node process, etc.) |
| `Cmd-F8` | `Ctrl-F8` | `debugger:show-launch-dialog` | Shows the process launch UI where you will choose the process on which you would like to debug (e.g., a Node process, etc.) |
| `Cmd-Alt-J` | `Ctrl-Shift-J` | `nuclide-output:toggle` | Toggle the [Console](/docs/features/debugger/#basics__evaluation) pane. |
| `F8` | `F8` | `debugger:continue-debugging` | After stopping at a breakpoint, and possibly stepping through code, this will enable debugging to continue to the next breakpoint or end of the process. |
| `Shift-F8` | `Shift-F8` | `debugger:run-to-location` | After breaking at a certain position or breakpoint, it will continue to cursor location. |
| `F9` | `F9` | `debugger:toggle-breakpoint` | If a breakpoint is set, this will unset that breakpoint and vice-versa. |
| `F10` | `F10` | `debugger:step-over` | Step over a piece of code. For example, if you are stopped at a method call, this will execute that method without stepping through it line-by-line. |
| `F11` | `F11` | `debugger:step-into` | Step into a piece of code. For example, if you are stopped at a method call, this will go into the first line of that method. |
| `Shift-F11` | `Shift-F11` | `debugger:step-out` | If you have stepped into a piece of code, this will step out to the point on which you entered that piece of code. For example, if you stepped into a method, this will step out back to the method call itself. |
| `Shift-F5` | `Shift-F5` | `debugger:stop-debugging` | Detach debugger. |
| `Cmd-Shift-F8` | `Ctrl-Shift-F8` | `debugger:restart-debugging` | Restart the current debugging session with the same configuration settings. |

## Editor Panes

These are keyboard shortcuts with respect to moving currently active files in the editor around the
main panes.

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Cmd-K-Down` | `Ctrl-K-Down` | `nuclide-move-pane:move-tab-to-new-pane-down` | Moves the currently active file in the editor to a bottom pane. |
| `Cmd-K-Right` | `Ctrl-K-Right` | `nuclide-move-pane:move-tab-to-new-pane-right` | Moves the currently active file in the editor to a right pane. |
| `Cmd-K-Up` | `Ctrl-K-Up` | `nuclide-move-pane:move-tab-to-new-pane-up` | Moves the currently active file in the editor to a top pane. |
| `Cmd-K-Left` | `Ctrl-K-Left` | `nuclide-move-pane:move-tab-to-new-pane-left` | Moves the currently active file in the editor to a left pane. |

## Navigation

These are keyboard shortcuts with respect to navigation within files, etc.

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Ctrl-,` | `Ctrl-<` | `nuclide-navigation-stack:navigate-backwards` | Moves the cursor to a previous position from the current position. |
| `Ctrl-.` | `Ctrl->` | `nuclide-navigation-stack:navigate-forwards` | Moves the cursor to the next position from the current, but former, position. |

## Miscellaneous

These are other key-based shortcuts that are included with Nuclide, including [Hyperclick](#hyperclick), clipboard
and Nuclide health actions.

| Key (macOS) | Key (Linux) | Command | Description |
|-----------|-------------|---------|-------------|
| `Option-Cmd-Enter` | `Alt-Ctrl-Enter` | `hyperclick:confirm-cursor` | When using [Hyperclick](#hyperclick), this will confirm the Hyperclick action you want to take. |
| `Ctrl-Option-Shift-H` | `Ctrl-Alt-Shift-H` | `nuclide-health:toggle` | Toggle the Nuclide Health tab, which show details about the Nuclide process itself (how much CPU, memory is being used, etc.). |
| `Ctrl-Option-Shift-X` | `Ctrl-Alt-Shift-X` | `nuclide-clipboard-path:copy-project-relative-path` | Copy the relative path of the current file to the clipboard. |
| `Ctrl-Shift-X` | `Ctrl-Shift-X` | `nuclide-clipboard-path:copy-absolute-path` | Copy the absolute path of the current file to the clipboard. |
| `Ctrl-Option-X` | `Ctrl-Alt-X` | `nuclide-clipboard-path:copy-repository-relative-path` | Copy the relative path of the current file starting at the root of the Mercurial repository. |

### Hyperclick

Hyperclick Trigger keys are configurable.

1. Open the [Nuclide Settings](/docs/editor/basics/#preferences-pane) tab either by pressing `Cmd+,` (`Ctrl-,` on Linux) or by going to `Package | Settings View | Open`.
2. Select **Packages** from the list at the left, and search for `nuclide`.
3. Click on the **Settings** button for the `nuclide` package.

The Hyperclick Trigger key settings are right at the top and set to the defaults.  You can change them by clicking on the selection bar and choosing from the provided list.

![](/static/images/docs/editor-keyboard-shortcuts-hyperclick.png)
