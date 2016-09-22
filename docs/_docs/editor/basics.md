---
pageid: editor-basics
title: Basics
layout: docs
permalink: /docs/editor/basics/
---

Nuclide is a code editor built on the backbone of [GitHub's Atom text editor](https://atom.io).
Like other code editors and IDEs, there is a familiar look and feel to Nuclide. On the left side is your project tree, which includes associated files and folders. On the right side is
the main editor that contains the code and text for files in your project. And at the bottom is a
status bar providing quick-look information such as errors, the path of the current file relative
to your project root, the type of file that is open, and other context-aware data.

![](/static/images/docs/editor-basics-intro.png)

* TOC
{:toc}

## Opening

Assuming you have it [installed](/docs/editor/setup/), Nuclide is opened by opening Atom via mouse
(Dock, Applications folder, etc.) or from the command-line in a terminal window by running:

```bash
$ atom
```

> To enable opening Atom from the command-line, you will need to install shell commands from the
> either the `Atom` menu or the Atom [Command Palette](/docs/editor/basics/#command-palette). In the
> Command Palette, search for "Window: Install Shell Commands".

To open a specific directory into the [Project Explorer](/docs/editor/basics/#project-and-file-explorer), you can add a path argument to the `atom` command.

```bash
$ atom /path/to/your/project/
```

By default, when you open Nuclide, the Home page appears.

![](/static/images/docs/editor-basics-homepage.png)

The Nuclide Home page gives you quick access to common Nuclide tools and features, as well as
information regarding how to provide feedback.

## Project Explorer

The Project Explorer is on the left side of Nuclide and contains two tabs: **File Tree** and **Source Control**. This is where you can open
projects, navigate through your project to open files in the [Editing Area](#editing-area),
create new files and folders, view source control information, etc.

### Adding Projects

The first time you open Nuclide, there will be no projects or files open. Instead you will see two options in the Project Explorer's File Tree tab: 1) **Add Project Folder**, which opens a local project, and 2) **Add Remote Project Folder**, which opens a project on a [remote machine](/docs/features/remote/).

![](/static/images/docs/editor-basics-adding-projects.png)

When you choose a project to open, you are choosing the root directory of that project. Upon
opening, the project's file tree appears with the root folder at the top.

![](/static/images/docs/editor-basics-file-tree.png)

To remove a project from the Project Explorer, *right-click* on the root folder, and choose **Remove Project Folder**.

### Multiple Projects

You can have more than one project open at a time. To open a second project, *right-click* anywhere in the Project Explorer's File Tree area, and choose **Add Project Folder** or **Add Remote Project Folder**.

> You can have both local and remote projects open at the same time.

With multiple projects open, default searching for files and in files will span both projects.
However, features such as debugging and error checking will still occur by project.

> For the `Find | Find In Project` task, you can add project-level granularity by specifying the
> root of the desired project as a filter for the search.

### Changed Files

If your project is under source control, the Project Explorer will highlight the files that have changed in your project since your last commit.

![](/static/images/docs/editor-basics-explorer-changed-files.png)

The Project Explorer's Source Control tab will indicate if uncommitted changes exist or not. If you are working with a Mercurial repository, the branches are listed.

### Context-Aware Menu

A context-aware menu appears when you *right-click* in the explorer. This menu provides
options such as adding new projects, searching within the project, opening the current file in
Diff View (assuming you are working in a Mercurial repository), etc.

![](/static/images/docs/editor-basics-explorer-context-aware.png)

## Editing Area

The Editing Area is the main area for working with your code and text files. Each file is represented by a
tab. You can split this area into various panes for easier modification of multiple files.
The Editing Area is also where you will find specialized tabs for the Nuclide Home page,
the settings page, etc.

### File Navigation

Navigating between files and within files is the same as in
[Atom](https://atom.io/docs/v1.5.0/using-atom-moving-in-atom).

You can quickly switch between open files by using `Ctrl-Tab` to cycle right or `Ctrl-Shift-Tab` to
cycle left.

Within files you can go straight to a line number by pressing `Ctrl-G`. If your project uses
a supported language, you can also jump to symbols with `Cmd-R` (`Ctrl-R` on Linux).

![](/static/images/docs/editor-basics-editing-area-symbols.png)

### Search

Most of the searching actions are the same as
[Atom](https://atom.io/docs/v1.5.0/using-atom-find-and-replace). For example, you can search within
a file (i.e., `Cmd-F`) or throughout your entire project(s) (i.e., `Cmd-Shift-F`).

In addition to the basic Atom searching, Nuclide adds an additional powerful search functionality
that allows you to search in various contexts. OmniSearch (`Cmd-T` on Mac and `Ctrl-T` on Linux)
provides a way to search, all at once, across your project, within your files, code symbols, etc.

![](/static/images/docs/editor-basics-editing-omnisearch.png)

### Context-Aware Menu

A context-aware menu appears when you *right-click* in the Editing Area. This menu provides options such as adding and closing panes, setting and removing breakpoints, showing line-by-line blame (if that information is available), etc.

![](/static/images/docs/editor-basics-editing-context-aware.png)

## Status Bar

The Nuclide status bar builds upon the
[Atom status bar package](https://github.com/atom/status-bar), adding powerful new
features, including code diagnostics and remote connection status.

![](/static/images/docs/editor-basics-status-bar-intro.png)

### Code Diagnostics

If you are using a supported language that provides linting and/or type checking capabilities
(e.g., [Hack](/docs/languages/hack/) or [Flow](/docs/languages/flow/)), then code diagnostics is built directly into Nuclide for that language.

![](/static/images/docs/editor-basics-status-bar-diagnostics.png)

### Remote Connection Status

If you are connected to a project on a remote machine, clicking the Remote Connection icon on
the status bar will provide information about the current status of that connection. Generally, if
all is well, the connection to the server is "healthy".

![](/static/images/docs/editor-basics-status-bar-connection.png)

> If you check the connection against a local project, you will get information regarding whether
> the current active file exists on the local filesystem.

### File Encoding

The default file encoding for Atom is `UTF-8`. Clicking on this in the status bar allows you to
change the encoding of the current file.

### Language Selection

Atom automatically determines the language of the current file. Normally, this is correct. However, you can change
the language, and Atom will change its syntax highlighting appropriately.

### Branch

Assuming your project is under source control, the status bar also shows the current branch on
which you are working.

## Gutter

Atom has a [gutter](https://atom.io/docs/latest/getting-started-atom-basics#basic-terminology) that
shows you information such as current line number, source control status and function/method
folding. Nuclide has added further features to the gutter, including setting breakpoints for the
debugger and showing diagnostics for supported languages.

![](/static/images/docs/editor-basics-gutter-intro.png)

### Code Diagnostics

If you hover over the code diagnostics errors, an inline window appears showing the problem.

![](/static/images/docs/editor-basics-gutter-code-diagnostics.png)

## Preferences Pane

Nuclide has its own set of customizable preferences and settings.

You get to these preferences by opening the Atom Settings view via the `Cmd-,` keyboard shortcut
(`Ctrl-,` on Linux) or through the `Packages | Settings View | Open` menu option.

A new tab opens in the [Editing Area](/docs/editor/basics/#editing-area) titled **Settings**. Select **Packages** from the list at the left of the Settings tab, and scroll down until you see `nuclide` under either **Community Packages** or **Development Packages**.

![](/static/images/docs/editor-basics-nuclide-package.png)

> If you linked the [Nuclide source code](https://github.com/facebook/nuclide) to Atom's development
> packages and opened Atom in development mode via the `--dev` flag, you will see the `nuclide`
> package under **Development Packages**.

Click on **Settings** to see all of the Nuclide preferences and settings.

![](/static/images/docs/editor-basics-nuclide-preferences.png)

## Command Palette

Atom is highly flexible in how you perform actions. Nuclide adds actions as well. There is a
variety of menu options, and many menu commands are equally accessible from the keyboard as well.

The Command Palette shows you every available command available in Atom and Nuclide.

`Cmd-Shift-P` toggles the Command Palette.

![](/static/images/docs/editor-basics-command-palette-intro.png)

You can narrow down the options that match your search by typing in the text box at the top of the Command Palette.

![](/static/images/docs/editor-basics-command-palette-search.png)
