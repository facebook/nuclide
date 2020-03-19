# nuclide-clipboard-path

Adds keyboard shortcuts to copy Nuclide remote aware paths to the clipboard.
  ctrl-shift-X Copy Absolute path, removing any remote nuclide URI prefix.
  ctrl-alt-shift-X Copy path relative to the nearest open Nuclide project.
  ctrl-alt-X Copy path relative to the nearest 'repository'. Precedence is:
    - TODO: Hg/Git repository root
    - arc repository root
    - open project
    - absolute path
  ctrl-alt-shift-C Copy basename of current active file
Displays a notification of what was (or wasn't) copied.
