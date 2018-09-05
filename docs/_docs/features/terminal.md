---
pageid: feature-terminal
title: Integrated Terminal
layout: docs
permalink: /docs/features/terminal/
---

Nuclide includes support for a terminal via the excellent [xterm.js](https://github.com/xtermjs/xterm.js). It uses Nuclide's remote connection to give command-line access to project directories. Here are some notes regarding common customization issues.

* TOC
{:toc}

# Getting Started

To open a new terminal window, right-click on a folder or file in the file tree and choose 'New Terminal Here'.

You can also open a terminal by running the command `atom-ide-terminal:new-terminal` from the command-palette or via a key-binding.  For example, here is a keymap.cson (menu command Atom/Keymaps) you can use to bind `ctrl-t` to create a new terminal:

```
'atom-text-editor':
  'ctrl-t': 'atom-ide-terminal:new-terminal'
```
By default, this command is bound to `ctrl-shift-t` on macOS and `alt-shift-t` on Windows and Linux.

# Copy/Paste

Copy and Paste work in terminal from the menu commands Edit/Copy and Edit/Paste.  On OS X, these commands are bound by default to Cmd-C and Cmd-V respectively, similar to editor windows in Nuclide.  On Windows, these commands are bound to right-click with and without selection like Quick-Edit mode in cmd.exe.

Some programs (e.g. emacs, tmux, vim) running in a terminal enable mouse support.  This requests that the terminal forward mouse events to the program, and by default this prevents the local terminal from selecting text for copy.  On a mac it is possible to temporarily override this by holding `option`/`alt` while selecting the text you want to copy.

# Key Repeat on OS X

OS X introduced a keyboard feature similar to iOS that affects Atom, where holding down a key offers diacritical options rather than repeating the ASCII character.  If you prefer to have keys repeat in Atom/Nuclide, run the following command:

```
defaults write com.github.atom ApplePressAndHoldEnabled -bool false
```

(from [this gist](https://gist.github.com/rastasheep/bfc8266eeb58b899054c))

# Custom Shell

By default, Nuclide terminal starts a new shell by running `/bin/bash --login -i`.  You can customize this behavior by adding a file `$HOME/.nuclide-terminal.json` **on the machine where the shell process runs**.  Here is an example you can use on OSX to start the version of bash from MacPorts:

```
{
  "command": [
    "/opt/local/bin/bash",
    "--login"
  ]
}
```

# Detecting Nuclide Terminal

Nuclide terminal binds an environment variable `$TERM_PROGRAM` to the value 'nuclide'.  This allows you to add special-cases to your `~/.bash_profile`, `~/.bashrc`, or similar startup script:

```
if [[ "$TERM_PROGRAM" == "nuclide" ]]; then
  # Run Nuclide-terminal-specific initialization
else
  # Run initialization for terminals other than in Nuclide
fi
```

For instance, if you want to use Nuclide as your editor if you've opened a terminal from within nuclide

```
if [[ "$TERM_PROGRAM" == "nuclide" ]]; then
  export EDITOR='atom --wait'
else
  export EDITOR=emacs # your favorite editor here
fi
```

# Scrollback

Go to Atom > Preferences > Packages > Nuclide, expand `atom-ide-terminal`, and there is a setting there.  Note that xterm.js does an eager memory allocation proportional to the size of the number here, so there is no 'unlimited' value.

# Preserved Commands

When you are using a terminal window, you might want a key binding to go to Atom/Nuclide rather than to the terminal.  The commands bound to these keys are called 'Preserved Commands'.  To add a preserved command, go to Atom > Preferences > Packages > Nuclide, expand `atom-ide-terminal`, and add the command to the list under 'Preserved Commands'.

If you do not already know the name of the command, you can use 'key-binding-resolver:toggle' (cmd-. on mac) in a context where the command works, like another editor window, and type the key you want.  The pane at the bottom of the screen will show you what you pressed and the command(s) for that key binding.

# Setting the Title

You can set the title of a nuclide terminal tab with an escape sequence.  In `bash`, you can do the following:

```
echo -ne "\033]0;The Title\007"
```

This will set the terminal tab's title to "The Title".

Similarly, if you wanted to have the terminal tab to always display the current directory name, in `bash` you could do something like:

```
PS1='\e]0;\W\a\$ '
```

Tabs in Atom also have a 'path' property. E.g. you can right click a tab and `Copy Full Path`. Normally the path of a terminal tab is the original directory where the terminal was opened (e.g. right-click a file/directory and `New Terminal Here`). If you use a prompt hack like the one above and want the 'path' property to match the tile, you can set a property in `~/.nuclide-terminal.json` to make this happen:

```
{
  "useTitleAsPath": true
}
```

# Clearing the Screen

Some terminal emulators bind `cmd-k` to clear the screen.  Unfortunately, this key combination is used already for splitting windows in Atom.  To avoid conflicting keybindings, we don't automatically bind this, but in your Atom > Keymap..., you can bind the command `atom-ide-terminal:clear` to get this functionality.

Note that just binding `atom-ide-terminal:clear` to `cmd-k` will result in conflicting bindings, which manifests as needing to hit `cmd-k` twice to get it to work.  To fix this, you need to unbind all commands that use `cmd-k` as a prefix.  Here are the settings to put in Atom > Keymap... to get this working:

```
'.terminal-pane':
  'cmd-k alt-cmd-w': 'unset!'
  'cmd-k cmd-b': 'unset!'
  'cmd-k cmd-down': 'unset!'
  'cmd-k cmd-left': 'unset!'
  'cmd-k cmd-n': 'unset!'
  'cmd-k cmd-p': 'unset!'
  'cmd-k cmd-right': 'unset!'
  'cmd-k cmd-up': 'unset!'
  'cmd-k cmd-w': 'unset!'
  'cmd-k down': 'unset!'
  'cmd-k left': 'unset!'
  'cmd-k right': 'unset!'
  'cmd-k up': 'unset!'
  'cmd-k': 'atom-ide-terminal:clear'
```

# Binding Meta Keys

Many terminal programs interpret `ESC`+//key// to mean `Meta`+//key//.  Nuclide terminal supports a command  `atom-ide-terminal:add-escape-prefix` for this scenario. When you bind a key combination to this command, the terminal sends `ESC` followed by the key with modifiers removed.

Here is an example keymap.cson (Under the menu: Atom > Keymap...) that enables the `Command` key as `Meta` for several combinations:

```
'.terminal-pane':
  'cmd-b b': 'unset!'
  'cmd-b t': 'unset!'
  'cmd-b r': 'unset!'
  'cmd-b d': 'unset!'
  'cmd-b s': 'unset!'

  'cmd-a': 'atom-ide-terminal:add-escape-prefix'
  'cmd-b': 'atom-ide-terminal:add-escape-prefix'
  'cmd-c': 'atom-ide-terminal:add-escape-prefix'
  'cmd-d': 'atom-ide-terminal:add-escape-prefix'
  'cmd-e': 'atom-ide-terminal:add-escape-prefix'
  'cmd-f': 'atom-ide-terminal:add-escape-prefix'
  'cmd-g': 'atom-ide-terminal:add-escape-prefix'
  'cmd-m': 'atom-ide-terminal:add-escape-prefix'
  'cmd-p': 'atom-ide-terminal:add-escape-prefix'
  'cmd-q': 'atom-ide-terminal:add-escape-prefix'
  'cmd-r': 'atom-ide-terminal:add-escape-prefix'
  'cmd-v': 'atom-ide-terminal:add-escape-prefix'
  'cmd-w': 'atom-ide-terminal:add-escape-prefix'
  'cmd-x': 'atom-ide-terminal:add-escape-prefix'
  'cmd-y': 'atom-ide-terminal:add-escape-prefix'
  'cmd-z': 'atom-ide-terminal:add-escape-prefix'
  'cmd-.': 'atom-ide-terminal:add-escape-prefix'
  'cmd-/': 'atom-ide-terminal:add-escape-prefix'
  'cmd-\\': 'atom-ide-terminal:add-escape-prefix'
```

Note that `cmd-b` is a prefix for several commands, all of which must be unbound to make `cmd-b` work as a standalone key binding.

You can achieve a similar effect for the `Option` key by using `alt` instead of `cmd` in these key bindings.
