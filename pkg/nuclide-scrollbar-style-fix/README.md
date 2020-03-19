# The Issue

Sometimes Atom will use unstyled, non-overlay scrollbars.

# The Reasons

There are actually two bugs at play here, both relating to the connection of
additional pointer devices (e.g. mice) that cause MacOS to change its preferred
scrollbar styling between "overlay" and "legacy."

1. [Chromium bug 454346][1] which results in styled scrollbars not being redrawn
   when their styling changes.
2. [Atom's scrollbar-style observation][2] doesn't notify of changes and reports
   incorrect values. ([atom/atom#18320][4])

# The Fixes

1. A stylesheet that deals with ugly scrollbars on startup caused by Bug 1. (See
   [this commit][3] for details.)
2. A duplication of Atom's scrollbar style observation, *but done in the main
   process*. We're not exactly sure why this works while observing in the
   renderer process doesn't, or whether it's related to Bug 1, but it does. Like
   with Atom's code, we update a class on the workspace element to reflect the
   preferred scrollbar style. Because of Bug 1, we need to force redraws after
   we update this class.

# Repro

1. Have Magic Mouse active on my computer.
2. Plug in Logitech M500 (I think?) mouse.
3. Turn off Magic Mouse.

## Expected Behavior

All scroll containers in the file tree should *immediately* get non-overlay,
styled scrollbars.

With this package enabled, this will happen. Before removing this package,
verify this behavior!

## Buggy Behavior

The scrollbars won't immediately be updated (Bug 1), but when you mouse over the
scroll containers, they'll get "ugly", non-overlay, unstyled scrollbars.

[1]: https://bugs.chromium.org/p/chromium/issues/detail?id=454346
[2]: https://github.com/atom/atom/blob/v1.32.0/src/workspace-element.js#L37
[3]: https://github.com/facebook/nuclide/commit/0a860a29acfa7ee4294907b92c658aa88b3be92e
[4]: https://github.com/atom/atom/issues/18320
