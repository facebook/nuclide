---
pageid: advanced-custom-keybindings
title: Custom Keybindings
layout: docs
permalink: /docs/advanced-topics/custom-keybindings/
---

Nuclide has a bunch of [built-in bindings](/docs/editor/keyboard-shortcuts) to help you be
productive from the keyboard. However, you may want to add your own keybindings for Nuclide
commands as well. This is fairly easily done with some CSON editing.

* TOC
{:toc}

## Keymap CSON

To create your own keybinding, you will need to edit your `~/.atom/keymap.cson` file. If you aren't
familiar with CSON, it is the [CoffeeScript equivalent of JSON](https://github.com/bevry/cson).

Here is an example `~/.atom/keymap.cson` file:

```coffeescript
'.editor:not(.mini)':
  'cmd-d': 'editor:delete-line'
  'cmd-home': 'core:move-to-top'
  'cmd-end': 'core:move-to-bottom'
  'cmd-l': 'go-to-line:toggle'
```

Because CSON is a superset of JSON this could also be written as:

```coffeescript
{
   '.editor:not(.mini)': {
     'cmd-d': 'editor:delete-line',
     'cmd-home': 'core:move-to-top',
     'cmd-end': 'core:move-to-bottom',
     'cmd-l': 'go-to-line:toggle'
   }
}
```

It may not be obvious, but each key in the top-level map is a CSS selector. Values are pairs of
commands and keybindings that are applicable in an element that matches the CSS selector. The
selector `.editor:not(.mini)` matches an editor in Nuclide that is not used as a single-line input
text box. Therefore, when you want to add a keyboard shortcut for an editor, add it to the
`.editor:not(.mini)` map.

### Platform Specific Bindings

You can make your bindings platform specific with `.platform-xxxxx` as part of your CSS selector.
For example the Nuclide `nuclide-quick-open` CSON looks like this:

```
{
  ".platform-darwin atom-workspace": {
    "cmd-t": "nuclide-quick-open:find-anything-via-omni-search"
  },
  ".platform-win32 atom-workspace, .platform-linux atom-workspace": {
    "ctrl-t": "nuclide-quick-open:find-anything-via-omni-search"
  }
}
```

where `.platform-darwin` represents macOS, `.platform-win32` represents Windows, and `.platform-linux` represents Linux.
