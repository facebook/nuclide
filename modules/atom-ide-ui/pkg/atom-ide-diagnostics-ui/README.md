# atom-ide-diagnostics-ui

Provides a default UI for diagnostics stored in [`atom-ide-diagnostics`]
(https://github.com/facebook/nuclide/tree/master/modules/atom-ide-ui/pkg/atom-ide-diagnostics)

As shown in the screenshot, this feature adds the following UI to Atom:

1. For diagnostics that correspond to a particular file, a marker will appear in the gutter of
the corresponding text editor. Mousing over the marker will display the details of the diagnostic.
2. A checkbox can be used to filter the list of diagnostics to show only those that apply to the
file for the active text editor.
3. List view showing all of the diagnostics.
4. Clicking on the diagnostics count in the status bar will toggle the display of the list view.

![screenshot of diagnostics UI](./docs/diagnostics-ui-with-callouts.png)

As shown in the upper-right-hand corner of the table, the default keyboard shortcut to toggle the
list of diagnostics is `alt-shift-d`.
The name of the command is `diagnostics:toggle-table` if you want to remap this in
your `~/.atom/keymap.cson` file.
