# Nuclide Changelog

**Changelogs for v0.274.0 and onward have moved to https://github.com/facebook/nuclide/releases.**

## v0.273.0

### Hotfix Release

* No longer use localRpc by default on windows
* Fix inability to connect to remote projects

## v0.272.0

### Fixathon Highlights

* Tune down aggressive expensive health monitoring (responsible for 10% of CPU usage).
* Improve Nuclide's startup time by 3 seconds (down from 8 to 5).
* Improve performance of console (most actions are now O(1) instead of O(n)).
* Improve breadcrumbs, file tree & file icons expensive DOM operations (was affecting keyboard & scrolling latency).
* Cleanup unused functionality & some rolled-out GKs (for better consistency on & off lighthouse).
* Fix various UX and runtime issues throughout Nuclide!

### Java

* Java Language Service logging has been greatly expanded, and Java logs are included when reporting bugs through Nuclide's bug nub.

### C++

* Surface Buck warnings and errors when building compilation databases.
* Related file finding (switching between source/header files) no longer has to wait for Buck to build first.

### General

* Scrolling pinned datatips now does not also scroll the editor behind it.

## v0.271.0

### General

* Fix 'ripgrep' option for Code Search pane in Omnisearch.
* Can preview changes before confirming a refactoring.
* Fixed a variety of memory leaks causing text editors to be retained.

### Debuggers

* Make React Native debugger visible in open source UI.

## v0.270.0

### Highlights

* Node, Python, and React Native debuggers now included in the open source version of Nuclide.
* Updated Python language services to use Jedi v0.11 - Python3 files should now have better language support.

### General

* Integrated terminal now detects and launches the default shell on Linux and Mac by default rather than hardcoding /bin/bash.  If it exists, configuration in ~/.nuclide-terminal.json still overrides this.
* The path to Flow setting now affects remote projects.
* Improved changed-files list ui so that diff/revert actions are always visible on hover.
* Fixed tuple and generic parsing in Hack grammar.

## v0.269.0

Hotfix release:

* Prevent the git-diff package from throwing `TypeError: Cannot read property 'length' of undefined` on startup.
* Prevent Buck build toolbar from disappearing.

## v0.268.0

### Highlights

* Nuclide's SSH tunnel now works in both directions!

### General

* Upgrade to [Atom 1.22](http://blog.atom.io/2017/11/07/atom-1-22.html). Along with other improvements, this resolves an issue with copying the current file's relative path from the status bar.
* The JavaScript imports services now uses an on-disk cache to reduce CPU usage during subsequent runs.
* Fixed server crashes from misbehaving LSP servers.

## v0.267.0

Another hotfix:
* Fix remote text buffer reload on Windows.
* Fix broken React Native packager launch.

## v0.266.0

Hotfix release to fix task runner issues with remote directories.

## v0.265.0

### Highlights

* Revamped the remote file reload experience.
  * Restarting Nuclide with remote files open now preserves unsaved changes.
  * Instead of displaying a blank file, remote files are now viewable in read-only mode during reconnection, and are no longer closed if the connection fails to reload.

### General

* Improved performance of diagnostics table rendering.
* Fixed spurious Flow highlights for older Flow versions (< 0.55).
* Reduce flakiness of Hyperclick underlines and loading indicators.
* Outline view is now less aggressive about auto-focusing the search input.
* Added new terminal option to the context menu of breadcrumbs

### Debugger

* Add autocomplete support for currently in scope variables (in all debuggers).
* Fix debugger hover evaluation race with language services' type hints.
* Add loading indicator while evaluating expressions on hovers & inline failure message.

## v0.264.0

### General

* Added a `JS Symbols` provider inside of Quick Open (`Cmd-T`).
* Improved scrolling performance on file tree (now using `react-virtualized`).
* Fixed incorrect JS import suggestions for mocks and node_modules.
* Datatips now appear at the cursor position rather than at the start of the highlighted range.
* Datatip highlights no longer obscure 'Go to definition' underlines.
* Type Coverage diagnostics are now blue (info-level).
* Reduced performance overhead of logging and error analytics.

### Debugger

* Fixed regression in console where multiple debugger messages could be collapsed into a single message if their text was the same.
* Add autocomplete support for nuclide debuggers (starting with Node).
* Add debugger commands (repl) history autocomplete support.

### Diagnostics Table

* Improved logic around resizing and column widths.
* Icons are now color-coded (matching gutter icons).
* Line number column is now displayed when messages are limited to current file only.

## v0.263.0

### Misc

* Selected diagnostic is now expanded only when the table has focus.
* Added an option to automatically hide/show diagnostics when available.

### Hack

* Improve Hack grammar parsing of types, constants in argument positions, and default arguments.
* Fix parsing for lambda and pipe operators in Hack grammar.

### Debugger

* PHP/Hack Debugger: Added missing tooltips to debugger control buttons.
* C++ Debugger: Fixed a bug that was causing “Continue To Location” not to work at all.
* C++ Debugger: now accepting paths starting with './' or '~/' in all fields in the Debugger Launch dialog, and they will be expanded properly to be relative to the current working directory, or the user's home directory.

### Flow

* Other occurrences of the local variable under your cursor will now be highlighted.

## v0.262.0

**Hotfix from 0.261.0**

* Fixed a bug causing some tooltips to not get dismissed
* Await generated file service instead of throwing

## v0.261.0

### Diagnostics
* Added text and regular expression filtering
* Added type filtering toggle buttons
* Improved column sorting
* Fixed misc. table bugs
* File directories are now hidden by default (but can be shown via the gear button and resized independently)
* Added a setting to move status bar icons to the right side.

### General

* Fuzzy filename search on Windows now uses the significantly better native matching library
* Integrated Terminal is now included in the open-source version of Nuclide.

## v0.260.0

### C++

* A busy signal now indicates when Nuclide is building a compilation database with Buck. (Thanks Anthony Miller!)

### Debugger

* Native debugger: Added disassembly and register views
* Native debugger: Added ability to set a breakpoint at an instruction address (even without source code available)
* Native debugger: now allows specifying an executable path beginning with “./” to refer to the current working directory, or “~/” to refer to the user's home directory.

## v0.259.0

**Hotfix from 0.258.0**

* Fix hhvm debugger crashing nuclide server.
* Workaround broken reveal in remote file tree.

## v0.258.0

### General
* Fuzzy filename search results now correctly respect .hgignore (Thanks Roy Li!)
* File tree navigation performance was improved.
* Fixed a bug causing empty datatips to occasionally appear.
* The context menu in file-tree was found to sometimes target incorrect files. The menu was temporarily disabled to prevent accidental data loss.
* Archive files are now correctly treated as read-only.
* Updated to React 16
* All Arcanist-related code has been removed from the open-source Nuclide.

## Debugger
* Fixed bug where console would scroll to the bottom of an expanded object whenever a property was expanded or collapsed for that object.
* PHP Debugger: Fixed a bug causing variables in the Scopes pane not to update after issuing a console command that changed a variable's value.

## v0.257.0

### General
* The "Add Remote Connection Profile" dialog now supports tab and shift-tab focusing between inputs.
* File Tree: New setting to enable focusing the editor when previewing a file (after a single click). Defaults to `false`.
* For performance reasons, the file tree option to "Reveal File on Switch" is now turned off by default.
* Fixed bug where the console scroll would not be pinned to the bottom when many multiline comments are logged.
* Fixed bug where clicking "new messages" in the console will not always scroll all the way to the bottom.

### Debugger
* PHP Debugger: Added ability to launch a PHP script in the Nuclide terminal - this will allow interacting with STDIN and STDOUT while debugging.
* Watch Expressions now persist across reloads.
* Console will now scroll to the bottom if a command is executed in the debugger prompt.
* Fixed bug where "copy" command in scopes pane was not copying anything to the clipboard.


## v0.256.0

**Hotfix from 0.255.0**

* [Windows] Fix Atom failing to reopen with remote files
* Fix inline JavaScript import suggestions

## v0.255.0

### General

* Archive files (.zip and .jar) can be expanded directly in the file tree, and files inside can be opened locally or remotely in separate first-class editor tabs.

### Debugger

* C++ debugger: Added an option to the Native Launch and Attach dialog to specify an alternate source file path. This will allow you to debug a native binary that has been moved to a location other than the directory in which it was built when the binary contains only relative source file paths.
* Values are now colored/highlighted depending on their type.
* PHP Debugger: added message in the console indicating what exception was hit when breaking due to an exception in PHP
* PHP Debugger: fixed a bug where the action (Attach to Web Server vs Launch Script) in the HHVM toolbar doesn't persist when switching active editor tabs, even if the “Sticky” option is checked
* PHP Debugger: will now sort locals and object members alphabetically in the Scopes pane

## v0.254.0

* Hotfix to unbreak Hack language services.
* Enable OCaml services with ocamlmerlin 3.0.

## v0.253.0

### General

* This release drops support for Atom 1.18 and below.
* Find References and Code Formatting now use the busy signal to indicate that they're waiting on results.
* Many CSS classes have been renamed. If you had custom stylesheets, they'll have to be updated accordingly.
    + Affected classes: nuclide-datatip*, nuclide-outline-view*, nuclide-find-references*, nuclide-busy-signal*, nuclide-code-highlight*, nuclide-diagnostics*

### Debugger

* Fixed bug causing PHP debugger to display “EISDIR” error messages while debugging

## v0.252.0

### C++

* Added an inline action for running the “Clean & Rebuild” command from the “missing compilation database” warning.

## v0.251.0

**Hotfix from 0.250.0**

* Facebook-internal hotfix.

## v0.250.0

### General

* "Open Files" section in the file tree now has a context menu.
* Project roots in the file tree can now be rearranged.
* Copy and paste is now supported in the file tree.
* Datatip styling is now consistent with the syntax theme.
* Diagnostic tooltips now have priority over other tooltips, and will display all diagnostics at the cursor location.
* Fixed fuzzy filename search to prioritize shorter matches when there are multiple exact matches.

## v0.249.0

### Hotfix Release

* Fixes bug that prevents saving after renaming a remote file from the file tree on Atom 1.19+

## v0.248.0

* Hotfix for Facebook users

## v0.247.0

### Hotfix Release

* Fixes the issue where flow diagnostics would not show up for flow >= v0.53.0

## v0.246.0

### General

* Fixed a bug causing unstyled scrollbars with Atom 1.19.
* Added support for Nuclide deep links on Windows
* Changed the default value of the `nuclide-file-tree.revealFileOnSwitch` config to `true` so that, by default, the active file will be revealed in the file tree by default. This behavior can be disabled by unchecking "Reveal File on Switch" in Nuclide's settings.
* Fix a bug that was causing the app to shift and scroll at apparently random times

### Debugger

* Changed conditional breakpoints to be orange in the gutter to indicate conditional vs normal breakpoints.
* PHP Debugger: fix Nuclide re-adding breakpoints after they're removed.
* PHP Debugger: fixed a bug causing exceptions to be thrown while enabling/disabling multiple breakpoints at the same time.
* PHP Debugger: fixed a bug causing the debugger to sometimes stop at a line even after removing the corresponding breakpoint.

## v0.245.0

### General

* Added a command (“Nuclide Task Runner: Stop Task”) and keyboard shortcut (⌘B S) for stopping the running build task.
* Outline View no longer obscures search area when outline contents overflow.

### Debugger

* Fixed “Toggle Debugger” in the view menu. (Previously, it did nothing.)
* Fixed editing watch expressions.

### Buck

* Buck toolbar now detects connected physical iOS devices and allows to build for and deploy to them.

### GraphQL

* Incorporated graphql-config for more granular project controls.
* Missing Watchman no longer triggers a red box notification.

## v0.244.0

### General

* More Atom 1.19 compatibility updates
* Fixed misaligned file-tree highlights while horizontally scrolling
* Fixed minor wrapping issues in long diagnostics popups

### Debugger

* Added “Manage Devices” button to debugger pane to allow quick access to the Device Panel
* Fixed a bug preventing "Copy Callstack" from working properly
* Fixed an issue causing red error boxes when dragging debugger panes around on Atom 1.18+

## v0.243.0

### General

* Items in the View context menu are now sorted alphabetically
* Many compatibility fixes for Atom 1.19.
* Fixed broken go-to-definition / code-formatting for OCaml files.

### Debugger

* Fixed an issue where right clicking the background of the breakpoints pane doesn't offer breakpoint options like "remove all breakpoints"
* Fixed a bug preventing the debugger from auto attaching to a cxx_test target from the when clicking debug on the Buck toolbar


## v0.242.0

### Highlights

* The file-icons package is now installed for all users by default.

### General

* Fixed a bug causing spurious segments of code to be highlighted.

### Debugger

* Added the ability to debug native core dumps.
* Added breakpoint hit counts for PHP, Python, C++ and Java debuggers.
* Debugger will now remember the width of the debugging panes when the debugger is stopped, and use your preferred size the next time it is launched.
* Fixed the “Debug” button on the task runner toolbar for iOS targets was not working.
* Fixed a bug causing occasional warning messages when removing or editing a breakpoint.


## v0.241.0

### Hotfix Release

* Fixes the issues that were created with the latest `graphql-language-service` release:
* Fixes the breakage happening from using user's local node, which may have a different version from Atom's node
* Fixes Nuclide's LSP implementation to handle `null` value
* Fixed `graphql-language-service` incorrectly using node's `URL` module

## v0.240.0

### Debugger

* Added support for **conditional breakpoints **in Java, PHP/Hack, C++ and Python debuggers. Right click any breakpoint and choose “Edit Breakpoint...” to add conditions!
* Fixed bug that caused the File Tree to open when starting the debugger, even if the file tree had previously been hidden
* Removing request memory limit when debugging PHP with Nuclide to avoid OOM exceptions when using the debugger console. (Note: requires an HHVM patch: should be available with the next HHVM release)

## v0.239.0

### Hotfix Release
* Revert Atom 1.19 buffer changeCount fix

## v0.238.0

### Hotfix Release
* Fix build

## v0.237.0

### General

* Fixed a regression that made the file-tree's selected element behavior erratic.
* Updated Find in Project to search in your active Working Set (remote only) `Cmd-Ctrl-Shift-F` (windows: `Ctrl-Alt-Shift-F`) to try

### Debugger

* Strip ANSI codes from stdout/stderr debugger output.

## v0.236.0

### Highlights

* Add a key binding hint to the status bar which shows available key bindings for the most recently taken action.

### General

* Fixed stale diagnostics after file renames.
* Fixed some issues with keyboard navigation shortcuts in the file tree on Windows.
* Fixed remote connection restoration with Atom 1.18.
* Dropping node and react native support from Nuclide based on low internal usage and feedback outside Facebook -- that'd enable us to improve Nuclide's debugger quality first and later, add proper debugging support.

### Debugger

* PHP/Hack Debugger: Fixed bug causing output to stdout to be echo'ed twice in the Nuclide console.
* Added support for nested debugger tabs so that the debugger panes share docks nicely with other components (such as Outline View or the Commit Form) while retaining the ability to individually close, stack or move debugger panes around the workspace.

## v0.235.0

### Hotfix Release
* Removed an improper watchman version check.


## v0.234.0

### Highlights
* The Outline View now has a search box to filter results.

## General

* Nuclide now requires Atom ≥ 1.17.2.
* File Tree now shows your current working directory name in the title, and hovering over the title shows the full path including remote machine name.
* File Tree: When opening a file, the Open Files section will no longer resize until  the mouse leaves the File Tree.
* File Tree's Open Files listing now supports the file-icons package.
* Main menu: Items in the “Nuclide” menu are now sorted alphabetically.
* Working Sets: Fixed a bug preventing people from being able to close the Working Set selection modal.
* “Find References” now defaults to opening in the bottom pane.
    * This is configurable in Nuclide Settings (“where to open the find references pane”).
* Console: Fix autoscroll when large messages are added.

## Languages

* Faster autocompletion in Flow (when using v48+) thanks to using the persistent connection.

## Debugger

* Fix error when remote root folder is removed (ie. disconnected) after debugging.


## v0.233.0

### General

* Fixed an issue where running code format on a large file could end up hanging Nuclide and Atom
* Added a "Set Current Working Root Here" context menu to file tabs.
* The owner and group of remote files are now preserved.

### Debugger

* Updated Debugger documentation to reflect many changes to the launch/attach workflow, debugger panes and updated screenshots to match latest UI.
* Added work around to fix an issue in Atom 1.17+ where opening a new pane like the Outline View or Commit Form while the debugger is open causes an odd and difficult to use pane layout
* Added “Enable All” and “Disable All” commands to the Breakpoint pane context menu

## v0.232.0

### Hotfix Release

* Fixed format-on-save throwing exceptions when saving while closing files.

## v0.231.0

### General

* The "Full description" checkbox in Diagnostics is now hidden when traces are unavailable.

### Debugger

* Enable/Disable breakpoint in breakpoint window will not navigate to source location anymore.

## v0.230.0

### General

* Added a system toast notification if remote connection 2FA prompt comes up while Nuclide does not have focus.
* Fixed missing Hack autocomplete results for classnames.

### Debugger

* Fixed php debugger "sometimes can't start successfully" bug.
* Removed “gear” icon that was taking up vertical space above the debugger controls
* New separated "Launch" and "Attach" debugger dialogs with simplified configuration options, will now remember your debugger settings
* [Atom 1.17+ Only] Added support for tearing out the various debugger panes into their own Atom tabs, moving them around the workspace and to other docks, remembering their preferred locations, and hiding individual panes.

## v0.229.0

### General

* Fixed Nuclide reporting "arc build" succeeding even if it failed
* Fixed issue where Nuclide would offer a Terminal for unsupported paths on Windows and then generate an error
* "Create Paste" button above console will now include REPL commands and responses from a debug session
* toolbar@1.1.0 is now installed by default.

## v0.228.0

**Hotfix from 0.226.0**

## v0.227.0

**Hotfix from 0.226.0**

* Fixing issue with debugger panes when running Nuclide on Atom 1.17

## v0.226.0

### General

* Fixed URL matcher inadvertently including punctuation (like parentheses) in the Console.
* Fixed a performance issue with Ctags symbol search (from Quick Open).

### Java

* The Java language service now supports symbol-based identifier highlighting.

### Hack

* Hack type tooltips are now properly syntax highlighted.

## v0.225.0

**Hotfix from 0.224.0**

* Facebook-internal hotfix.

## v0.224.0

### General

* Added a keyboard shortcut for refactoring (cmd-ctrl-R on Mac, ctrl-shift-R elsewhere).
* Windows: Fuzzy filename matcher now works with extensions.

### Source control

* The commit form won't let you submit an update without having entered a message.
* The commit form will remember your last update message in the case that you exit the form or the update fails for some reason.
* Various small conveniences+bug fixes.
* Canceling `arc build/rebuild` actually stops the build (not just marks it as stopped).
* Add `arc build` support for `configerator`.

### Debugger

* Added a “Restart Debugger” button that will quickly and easily disconnect and restart your debugging session with the same configuration and parameters as the current session.

## v0.223.0

* Fixed an issue with stream error handling.

## v0.222.0

* Fixed a redbox when right-clicking a file in the uncommitted changes section.
* Fixed an issue with uncaught errors when spawning processes.

## v0.221.0

### Highlights

* Perf: Reduce calls to `hg bookmarks` from O(n) users to O(1) (sharing managed data).
* Improved reliability of console auto-scrolling.
* PHP/Hack debugger: stdout from launched scripts is now redirected to the Nuclide console while debugging.

### General

* The Hack and Flow icons will now appear alongside the type coverage indicator in the status bar.
* Fuzzy file search now strongly prioritizes exact-case matches when the query includes an uppercase character.
* Fixed some minor flickering issues in Quick Open.
* Fixed Cmd-F from the file-tree. The directory is auto populated.
* Fix Ctrl-Click highlighting in the file-tree on Mac.
* Fixed test runner invocation from the menu.
* Remove the desktop computer icon in the status bar for local connections.
* Upgraded the React Developer Tools for a host of improvements (thanks [Dan](https://github.com/gaearon) and [Andres](https://github.com/zertosh)!)
* Nuclide's Diagnostics now supports (most of) the Linter [Standard and Indie v2 APIs](https://github.com/steelbrain/linter/tree/master/docs). See the [Nuclide Diagnostics README](https://github.com/facebook/nuclide/blob/master/pkg/nuclide-diagnostics-store/README.md) for more info.

### C++

* Fixed edge case causing invalid diagnostic highlighting.

### Source Control

* The “update” button in Interactive Smartlog is now labeled “Check out” to make it more intuitive.
* Redundant “clean up” buttons on landed stacks are now being grouped as “clean up stack”.
* Tooltips on uncommitted files now show the file's status and use the shorter, project-relative path.
* Fix a bug with bookshelf serialization that wouldn’t restore open files when `hg bookmarks` failed.
* UX: Add editor context menu item for “Open in Phabricator”.
* Fix “Open in Diff View” editor context menu item.
* Fix space-separated bookmark handling.

### Debugger

* Cleaned up debugger interface a bit and removed extra “stop” buttons from debugger pane
* Fixed UX flashing/jitter when rendering a loading spinner in the console while waiting for an expression to be evaluated by the debugger.
* Fixed several UX jitter issues with pinned data tips.
* PHP/Hack debugger: added functionality to show exceptions with stack traces when a launched script exits due to an uncaught exception.

### Console

* Hide the "New Messages" button on console clear.
* Fixed an issue that prevented the console from auto-scrolling after first opening it.

## v0.220.0

**Hotfix from 0.219.0**

* Fix an exception being thrown when dragging files in the file-tree.

## v0.219.0

**Highlights**

* Fuzzy-filename search is ~50% faster.
* PHP Debugger: Added run to cursor location functionality.
* New feature: “Open nearest `BUCK` (or `TARGETS`) file.” For the current file, opens the Buck build file that owns it. Use the keyboard shortcut `cmd-shift-k` on OS X (`ctrl-shift-k` on Windows/Linux), or search for “Open Nearest Build File” in the command palette.

**General**

* The number of active “arc lint” processes is now limited to half the number of CPUs.
* Fixed a bug in “Search in Directory” returning duplicate results in remote Hg repositories.
* Optimized outline tree rendering (especially for large files).
* The “Nuclide File Tree: Reveal in File Tree” command has been renamed back to its original name, “Nuclide File Tree: Reveal Active File.”
* Added support for `file-icons`.
  * Install the third-party `file-icons` [package](https://atom.io/packages/file-icons) to get extension-specific icons in the file tree, Smartlog, quick-open, and source control sidebar.

**Debuggers**

* Added “Copy” to copy to clipboard in context menu for all variables in the Scopes pane.
* Fixed a bug causing line numbers in the call stack pane to be off by one in all debuggers.
* Fix an issue where debugger context menu items would act on wrong line numbers.
* Fix an error case when deleting a breakpoint.
* PHP/Hack - Fixed bug causing fatal “cannot find xdebug breakpoint” errors.
* PHP/Hack - Fixed a bug that caused scopes, watch expressions and data tips not to update if an eval command is executed from the console that causes side effects.

**UI**

* Fixed a bug whereby the contents of the test runner panel would be hidden.
* Fixed file-tree weird scrolling issues.

## v0.218.0

**Performance**

* Quick Open should feel snappier (default 200ms debounce has been removed).
* Fuzzy file search indexing is now faster in Hg repositories.
* Fixed a bug where rebasing remote Hg repositories would flood the Nuclide server connection.
* Significantly reduced the network/CPU usage of listing directories (e.g. in the file tree).

**General**

* Hyperclick URL matching is more accurate.
* The Buck toolbar's target typeahead now suggests the owner of the current file at the top.

**C++**

* Language features are now compatible with the [language-cpp14](https://github.com/jbw3/language-cpp14) grammar package.

**Debugger**

* Fixed bugs around setting breakpoints by clicking in the gutter, and issues where clicking a line number to select a line of text sets unwanted breakpoints.
* PHP/Hack: Fixed bug where debugger doesn't exit when the script being debugged finishes.
* PHP/Hack: Fixed exceptions that can occur when resolving breakpoints that have already been removed.
* C++ debugger: Fixed an issue where the child process is launched with an empty set of environment variables.
* Added scrollbars to datatips so you can see all the content when examining variables that have lots of members.
* Fixed weird scrolling issues in Watch Expressions pane.

## v0.217.0

**Debugger**
* Fixed a bug causing fetching native processes on a remote server with many running processes was saturating Nuclide server remote connection and slowing things down.

**Flow**
* Fix a bug that could break Flow integration when the .flowconfig changed to specify a different Flow version.

**PHP/Hack Debugger**

* UX: Improved wording of several confusing error messages.
* Fixed issue where the console indicated it was ready for use before it actually was, and attempts to use it resulted in odd behavior.
* Fixed issue where issuing an eval command caused a breakpoint to be hit in xdebug_includes.php instead of the script being debugged.
* Requests window now indicates if a thread is stopped due to an Exception vs hitting a breakpoint.
* Fixed issue where unchecking “Pause on exception” and hitting continue did not stop breaking in on requests hitting exceptions.
* Launch script window now resolves “~” to your home directory path when launching a script.
* Added a “recently launched scripts” drop-down to the launch dialog.
* Debugger now shows an error and exits if it fails to attach to an HHVM instance rather than waiting forever.
* Debugger now shows an error and exits if an invalid HHVM binary path is specified for launching a script.

**Source Control**

* Remove diff-view and source control sidebar features from the public release of Nuclide.

According to user feedback, these features have enjoyed very low usage outside of Facebook, negatively impact the performance of Nuclide, and generally don't (yet) meet the quality bar we'd like to set for Nuclide.

In order to improve on this, we will be moving these features to a Facebook-internal version of Nuclide for the foreseeable future, allowing us to iterate more quickly, clean up tech debt, and polish the experience.

## v0.216.0

### Hotfix from 0.215.0

* Limit the number of console records serialized to avoid UI freezes.

## v0.215.0

General

* Fixed issue causing flow not to be found when running Nuclide on Windows with the flow-bin npm package installed.
* This changelog will automatically open when Nuclide updates.
* Nuclide server certificates now expire after 14 days.
* .python2 / .python3 files are now respected by the Python linter.

Hack

* You can now use Cmd-/ to toggle <!-- comments --> in XHP.

Debugger

* Added ability to show if breakpoints are unresolved or disabled in the gutter to the left of a source line.
* Remember if breakpoints are disabled across Nuclide sessions.
* Added ability to enable/disable breakpoints by right clicking them in the gutter.

PHP / Hack Debugger

* UX: added display of Vector/Map/Set counts.
* Fixed issue where breakpoints appear to keep hitting after you have removed or disabled them.
* Fixed issue where “loading” spinner on the Requests debugger pane sometimes spins forever.

## v0.214.0

### Hotfix from 0.213.0

* Fix update to bookmark from source control sidebar failing.

## v0.213.0

### Hotfixes from 0.212.0

* Fixed odd stretching behavior of some panels (Diagnostics, Conflict Resolver)
* Properly deserialize timestamps in console

## v0.212.0

### GENERAL

* Remote file deletions are now debounced by 1s, so tools like hg revert should no longer mark tabs as modified.
* Console is now windowed, improving Nuclide performance when there are a lot of entries
* Fixed exception thrown on Windows when expanding “~” to the user's home directory path in a file path.

### C++

* Faster autocomplete (thanks to Nat's autocomplete cacher).
* Additionally, autocompletion results are now fuzzily matched.
* Buck builds from within Nuclide should be significantly (5-10s) faster than before.

### Debugger

* Replaced callstack window with a table, fixed many rendering issues with call stacks
* Added ability to copy callstack to clipboard by right-clicking the call stack table
* Fixed issues with multiple nested scrollbars in Threads, Callstack, and Scopes debugger panes
* Fixed issue causing Threads pane to have a “loading” spinner forever when breaking into a C++ target
* Fixed large numbers (anything bigger than JavaScript's max int) being truncated or displayed incorrectly in all debuggers. This fixes outputting FBIDs in the PHP/Hack debugger.
* Breakpoints in the gutter in the Nuclide editor now indicate if the bp is disabled or unresolved
* Fixed a regression causing all breakpoints to show as unresolved in PHP/Hack debugger

### Source Control

* Increased timeout for updating bookmarks to 5 minutes

### Quality Jam

* Improve console styling for light/dark them combinations
* Test runner: fix misc. UI issues
* “Find References” context menu item now uses the right-clicked symbol rather than the editor cursor.
* Fixed issue where fuzzy filename search would fail if it took more than 60s to index.
* Flow type-hint tooltips will no longer appear over whitespace.
* Removed “Context View” toolbar icon (you can still find it in View > Toggle Context View)


## v0.211.0

# Hotfix

* Fix 'resolve' button not working from Merge Conflicts pane.
* Fix right clicking on uncommitted changes throwing 'invalid rootpath error'.
* Properly respect Atom's 'Close Deleted File Tabs' option for remote files.

## v0.210.0

### Highlights

* Minimally required version of Atom is now 1.15.0.

### C++

* Update clang version since PCH was broken in older versions.
* Optimize how Nuclide invokes Buck to build compilation database.

### Console

* Improved the way console records are highlighted to make them more readable.

### Debugger

* Support right clicking and deleting a single breakpoint.
* Show loading spinner while waiting for debugger async break.
* Speed up fetching thread stacks on debugger pause.
* Show 'Unresolved breakpoint' tooltip when hovering over unresolved breakpoint label.
* Fixes unresolvable breakpoints always show as resolved if set after debugger is attached.
* 'Single thread stepping' checkbox doesn't disappear when switching to debugger that doesn't support it.

### Flow

* Add outline support for export default arrow & anonymous functions.

### Source Control

* Fixes context menu not showing on uncommitted changes list.

### Bug Fixes + Misc

* File Tree: Fixed scrolling during a Working Set definition.
* File Tree: Fixed contents occasionally not being rendered on visibility toggle.
* Outline View: Fixes flashing and hiding of outline view.
* Removed react-for-atom, replacing it with react instead.


## v0.209.0

### Debugger

* Switched to using an Atom preview window when opening source due to clicking on call stack frames during debugging rather than opening a new text editor tab for every frame clicked.
* Breakpoints section of debugger now remains visible in the debugger, even when no target is attached so breakpoints can still be added and removed while not debugging.
* UX improvements to breakpoint section.
* UX improvements to indicate when new thread stacks are being loaded from the debugger backend.

### Misc

* Diagnostic Datatips are now available to everyone.
* Remote files will now stay open when deleted in Atom 1.15+.
* Fixed rare server crash when log directory gets deleted.

## v0.208.0

### Highlights

* The session key is now correctly stored in the keyring on Linux, only requiring one authentication per session.
* Improve Flow client-side autocomplete filtering heuristic to filter fast in more scenarios.

### Hack

* Filter out errors with empty paths, which crash the RPC connection.

### Debugger

* Show `(no variables)` in the Scopes window for frames with no local variables.
* Changed debug type for `PHP` to `PHP / Hack` in the debugger launch window.

### Misc

* Fixed bug whereby tools would sometimes not fill entire panel until resized.
* Fixed `nuclideUri.uriToNuclideUri` which used to return malformed file paths on Windows.
* Fixed Quick Open remembering undo history across invocations.
* Fixed switching between header and source.
* Nuclide server start-up performance improvements due to the V8 compile cache.
* Fixed bug where buck targets with `...` wouldn't build.
* Fixed `Package already activated` error.
* `atom://` URL handler is updated to work for Atom 1.15+.


## v0.207.0

### Highlights

* Lots of Workspace View improvements! This greatly improves UX when (re)-arranging the pane layout, e.g. via drag-and-drop.

### Debugger

* The threads window is now sortable.

### Languages

* Hack Grammar: Fix variable capture in lambdas.
* Hack: Fix errors disappearing after restarting the Hack server.
* Flow: Highlight typehints according to the exact range returned from Flow.

### Misc bug fixes & improvements

* Fixed a bug that caused Nuclide to overwrite the symlink itself instead of the target file when editing a remote file that is a symlink.
* Prevent spawning multiple cursors whenever it conflicts with hyperclick.
* Fixed the styling of links in the console.


## v0.206.0

### Highlights

* Minimally required version of Atom is now 1.14.0

### Debugger

* Fixed a bug that caused the debug session not to end if the debugger proxy is killed
* Fixed a bug causing exception breakpoint messages to be formatted incorrectly

### PHP

* Faster autocomplete thanks to new caching

### Misc

* Support device groups in platform/device selection dropdown
* Fixed Diagnostics "Try it" button on Home screen
* Support skipping local lint and unit tests


## v0.205.0

Hotfix for internal changes.


## v0.204.0

### Mobile JS

* Improved disposal logic for the experimental debugger, resulting in fewer crashes.

### Hack

* With this week's HHVM release, asynchronous callstacks in the debugger will no longer be missing frames.

### Improvements and Fixes

* Improved Atom responsiveness when using flow by offloading more work to the nuclide-server.
* Fixed issue with remote connection that would cause Atom to not be able to serialize state.
* Improved task runner toolbar UI.


## v0.203.0

Hotfix for internal changes.


## v0.202.0

### Highlights

* GraphQL Integration. Autocomplete, syntax errors, go to definition, outline and context views integrations... All you need for `.graphql` files!

### HACK

* Syntax highlighting fixed for methods that start with magic method names (eg `__getBlah()`).

### Logcat

* Fixed parsing for some versions of adb that included extra CRs (Thanks @fcFn!).
* Added "unknown:React" to default tag whitelist.

### Reason

* Fixed slow syntax highlighting (Thanks @freebroccolo!).

### Source Control

* Fixed double context menu bug in source control sidebar.
* Fix Diff View changed sections gutter highlighting.

### Debugger

* Watches in the debugger now have the 'x' on the left.
* Clicking the selected frame in the debugger callstack window navigates to the expected file.

### Misc

* File permissions are preserved when using search and replace on remote files.
* Bugfix for Xdebug on PHP 5.3 (Thanks @jesseschalken!)
* Windows - fixed panel being stuck occasionally in an endless resize.
* When opening a file from the CLI, prefer windows which already have the directory open.
* Flow autocomplete will no longer work with Flow v0.19 and below.


## v0.201.0

### Highlights

* URLs in console messages are now clickable. Thanks @nmn!
* Sections in the debugger panel are now resizable.

### General

* Hyperclick now creates a navigation stack entry before performing an action. Thanks Sandor!
* Fixed a bug that prevented “opening all“ bugs from the diagnostics table when there were more than 20. Thanks Sandor!
* We now only show the most relevant datatip for a given location, rather than all applicable ones. Thanks Sandor!
* A warning will show up if several of the remote profiles connect to same server by different names. Thanks Kody!
* Removed confusing “split” context menu items from file tree.

### Debugger

* Make JavaScript debugger names more clear. (iOS Webkit Debug Proxy → Mobile JS, JavaScript -> NodeJS)
* Detaching the Node debugger no longer crashes the Node process.
* Node and Native debugger process selection lists refresh as soon as the dialog is opened.
* Bugfixes for attaching the Node debugger to a Node process.

## v0.200.0

Hotfix for internal changes.


## v0.199.0

Hotfix for quick-open providers selection for multiple projects case.


## v0.198.0

### Highlights

* Project-level replace now works remotely.

### General

* Fix bug causing server crash when using different hostnames for the same server.
* Atom 1.13 is now the minimal required version of Atom.

### Source Control

*  Improved Commit Workflow:
  * Warn against publishing public commits.
  * Improved console logging for arcanist errors.
  * Toggle console, showing the error in case of failed commits.
  * Publish only after successful commit/amend.

### Flow

* Remove experimental structured type hints option from Flow.
* Enabled definition preview in Context View.


## v0.197.0

Hotfix for 0.196.0 with backwards-compatible Atom 1.13.x shadow DOM fixes.

## v0.196.0

### Bug Fixes

* Flow's autocomplete prefix matching is now more exact.
* `flow-bin` is now correctly located on Windows.
* When Nuclide kills a process, all of that process' children are gone too - this fixes an issue with the RN packager lingering around after being stopped.

### UI

* Datatips that expand beyond the bottom of the screen are now correctly displayed.
* Descriptions from the diagnostics table can now be copied.
* Long gutter popups (like from Diagnostics) are now narrower so they're easier to read.

### Quick Open

* `nuclide-quick-open`'s Atom service API got a major facelift.
* Many internal improvements. It's faster, smoother and less jittery. More features coming to it soon.

## v0.195.0

### Highlights

* Upgrade to Atom 1.12.7
* Add tooltip with key bindings for navigation stack

### Bug Fixes

* Fix native debugger callstack printing
* task runner fixes
* Improve C++ debugger start debugging failure error message

## v0.194.0

* OCaml Hyperclick provider now only triggers on success.
* Hotfix for internal changes.

## v0.193.0

### Highlights

* Improve Flow autocomplete performance by caching and filtering previous results more often.

### General

* Recreate closed workspace view items in previous location.
*  `~`  is now expanded to the user's home dir by default in user provided config paths.
* Task runner failure notifications are now automatically hidden when you start running another task.
* Task runner visibility is now serialized based on current working root.

### Source Control

* Add option to create bookmark on commit.

### Fixes

* Fix bug causing Mercurial operations to sometimes never terminate.
* Fix dragging tabs between panels.
* Fix Diff View sometimes missing original file.
* Clang: fix blank outline views for some C++ files.
* Fix remote atom when folks have overridden their `TMPDIR`.
* Fixed several File Tree regressions including
    * Re-introduce `⌘K` `⌘B` alias for toggling.
    * Fix `⌃0` / focus toggling.
    * Ability to move files using drag-and-drop.

## v0.192.0

Hotfix various hanging processes and Diff View operations.

## v0.191.0

Hotfix Diff View gutter highlighting for Atom <= 1.12.x.

## v0.190.0

Hotfix for internal changes.

## v0.189.0

### Highlights

* React Native: Experimental JavaScriptCore JS debugger support for Android.
* Vastly improved Mercurial blame UI.
* Flow types are now pretty-printed into multiple lines.
* Debugger, file tree, and source control panels are now normal, draggable Atom tabs.

### General

* `atom://nuclide/open-arc` URLs can now remember and re-open your previous paths.
* Brought back the remote connection status-bar indicator.
* Fixed opening remote directories via the remote Atom CLI.
* Fixed diagnostics table resizing bug.
* Datatips no longer appear after leaving the editor.

### Debugger

* Breakpoints are no longer restricted to certain file extensions.
* HHVM: fixed debugger crashes related to evaluations coming back in an unexpected order.
* HHVM: Debugger now displays a warning if hphpd is attached.
* C++: Fixed toggle uncaught exception crash.
* iOS: Fixed app debugging via the Buck toolbar.

### Source Control

* Diff View icon has been changed from the branch icon to a "diff" icon.

### React Native

* Improved adb logcat error messages.

## v0.188.0

Hotfix release for Source Control sidebar styling and goToLocation errors.

## v0.187.0

### Highlights

* Debugger "Locals" window is now a "Scopes" window, and can show non-local variables in scope, such as global variables.
* Fixed an issue that would cause the "Hack Diagnostics" spinner to spin forever and also cause Atom to hog the CPU.

### General

* When opening a file with `cmd+t`, prefer to focus an existing editor in a different pane rather than re-opening the file.
* Fixed a bug causing occasional Hg / Buck errors at Atom startup.

### Debugger

* Fix C++ debugging attach "missing envPythonPath" regression.
* "Run to location" debug command for C++ debugging.
* Remove C++ start debugging flickering because of loader breakpoint.
* Fixed caching of nested value expansion state during stepping.

### React Native

* React Native redboxes will automatically open files using the current Atom window when the packager is run from Nuclide.

### Source Control

* Add confirmation prompt for **Revert** and **Delete** context menu options.
* Added publish options and an input for publish update message in commit/amend mode.
* Added verbatim mode to enable updating summary and title on Phabricator to match the data entered in the diff view.
* Removed amend button in diff view form.

### Buck

* Allow building with the `path/to/target/...` target syntax.
* `buck test` test failures are treated as diagnostics, and appear inline in the test's source code's buffer.

## v0.186.0

### Hotfix

* Fix case-sensitivity issue that manifested on Linux and Windows.
* Fix issue where datatips would close when they are clicked on.

## v0.185.0

### Highlights

* When you right click on the file tree, it now highlights the row you clicked on!

### General

* Make remote "Search in Directory" behaviour more consistent.
* Performance improvements for remote "Search in Directory".
* Make remote "Search in Directory” work with multiple projects.
* Fix Task Runner alphabetical ordering.
* Buck toolbar no longer includes a “React Native Server” checkbox for iOS/Android targets.
* New icon for active project root in the file tree.
* File Tree no longer “jumps” when editing a Working Set.

### File tree

* The `[+]` icon for the working set no longer jumps around when scrolling.
* Do not show (default) bubble next to the root.

### Debugger

* Watch expressions are working again.
* Debugger highlights the current stack frame in the call stack.
* Fix issue with launching scripts with arguments under the PHP debugger.

### Diagnostics

* The yellow and red `~~~~` underlines no longer extends to the end of the line.

### Datatip

* Once interacted with (clicking, selecting text or scrolling horizontally), the datatip closes less aggressively when you mouse out of it.
* When switching tabs or applications, it should no longer trigger a datatip without moving the mouse.

### Diff view

* The amend button is no longer enabled when the top commit isn't yours.
* Clicking on the diff gutter no longer creates a breakpoint.

### OCaml/Reason

* Fix bug in formatting `rei` and `mli` files.

### Task Runner Toolbar

* Task selection dropdown  and action button have been separated.
* UI no longer jumps when the active project root changes or is set for the first time.

## v0.184.0

* Fixes regression in backspace/enter events not working in input fields of the debugger.
* Workaround for unprepared Atom environment during package activation.

## v0.183.0

* Fix inadvertent infinite loop in work deferral queue.

## v0.182.0

### Highlights

* You can now open files with [atom://nuclide/open-arc?project=<project_id>&path=<path>](http:) URLs.

### General

* Arc Lint processes can no longer stack - saving a file while a lint is running will kill the old lint process.
* Nuclide settings filter now matches on Section and Package names.
* Arc lint timeout is now configurable in Nuclide Settings.

### Health

* Add list of calls to external processes and their duration.
* You can now use cmd-c to copy the content.

### Source Control

* No longer display some random stranger commit and now clicking on a commit shows its own changes.
* Lots of small tweaks to make the UI stop jumping around all the time.

### Debugger

* Add support for selecting text and copy/paste.
* PHP debugger can be started if active file is not remote.

## v0.181.0

Hotfix for gutter breakpoint click-listener regression.

## v0.180.0

### General

* Put quick-open results for the current working directory at the top.
* Diagnostics now appears in a tab, which users can manage.
* The blue dot in the gutter should no longer be stuck.

### Python

* Respect the user `PYTHONPATH` when resolving modules.

### PHP/Hack

* End PHP debugger session when we have a fatal socket error.


## v0.179.0

Hotfix to prevent debugger serialization performance regression Atom 1.12.

## v0.178.0

### Highlights

* Diagnostics: Added an "Open All" button that opens all files with errors.
* Improved datatip UX.

### General

* Add grammars for the [Reason](https://facebook.github.io/reason/) language.
* Numerous quality, stability and performance improvements.
* Numerous updates to our extensive public docs at [nuclide.io](https://nuclide.io).

### Fixes

* Don't close files when they're renamed from the file tree.
* Numerous Atom 1.12 compatibility fixes.

### Flow

* Don't show Flow type hints for comments.
* Support default exports for Flow outline view.
* Support destructuring in top-level assignments in Flow outline view.

### Debugger

* C++ debug tab now lets you pause on all exceptions (i.e. when they're thrown). The other options (don't pause / pause on uncaught exceptions) continue to pause only on `SIGABRT`, i.e. unhandled exceptions.
* Add keybinding tooltip for debugger icons.
* Update all Debugger Launch/Attach dialogs to handle 'ENTER' keypress.


## v0.177.0

### General

* Enable showTraces in diagnostics.
* Add keyboard shortcuts for cycling through diagnostic traces.
* Files can be closed now by middle-clicking on their name in "Open Files" section.

### React

* Updated React Inspector now works with all different kinds of React apps! See facebook/react-devtools#440.

### Debugger

* More intuitive icons for step over/in/out.
* Doesn't jump anymore when you expand a local.

### Smart Log

* Fix cmd-click to checkout a branch.


## v0.176.0

### Highlights

* Reduce the number of calls to `hg` asking for commit info to only when a change (commit, strip, rebase, amend, histedit) is applied. Makes React Native experience better!
* Test runner now defines a keyboard bindable command for Test/Re-Test action. (Thanks Stepan!)

### General

* A handful of bug fixes for Atom 1.12 beta.
* Display remote “Opening...” and “Saving...” notification less often.
* HHVM debug toolbar availability now depends on the Current Working Root.

### C++ Debugger

* Add C++ debugger redirect stdin file during launch.
* Resolve "~" in launch arguments into home directory for C++ debugger launch.

### Flow

* Drop support for Flow v0.22 and below.
* Update outline view for the upcoming Flow v0.34's AST changes.

### Related Files

* Allow Related-Files feature to specify which file types to switch between.


## v0.175.0

### Highlights

* The number of Mercurial calls made on save has been reduced by 50%.
* An option has been added to enable/disable the editor gutter and status-bar line diff info display.
* Added a new debugger for the [iOS Webkit Debug Proxy](https://github.com/google/ios-webkit-debug-proxy) which targets the JS runtime JavaScriptCore on iOS targets.

### General

* The tool-bar button order has been reworked to group items that are used at a similar point in the development lifecycle (writing code, running/building, committing).
* Fixed missing Clang diagnostics in certain cases.
* Buck build errors now trigger an error notification.
* Arrow keys now scroll through history in Nuclide Console.
* The format-js package is no longer bundled with Nuclide.
* `arc lint` is run with lower CPU and IO scheduling priority.
* Arc build steps are now displayed in a dropdown instead of a Combobox.

### Android Logging

* Fixed the error when running logcat on older devices.
* Fixed parsing for older versions of logcat.

### Source Control

* A loading indicator has been added to the Diff View "selected files" section.
* Fixed git repository changes highlighting in the file tree.
* Fixed a rare CPU usage issue with the Diff View.

## v0.174.0

Hotfix for the exception thrown by requiring the `'invariant'` module in production.

## v0.173.0

Hotfix for rare cases of uncommitted changes view throwing exception when folder is removed.

## v0.172.0

### Highlights

* Enabled context view for C family languages.
* Task runner is now displayed by default.

### Hack

* Added rudimentary hack typedecl and generics syntax highlighting support.
* HHVM toolbar has been moved into the Task Runner.

### Ui

* Updated diagnostics table UI: Consistent look & feel, resizable columns, more content per pixel.
* Improved Breakpoint list UI in the debugger.
* File-tree now supports range selection with shift-click and shift-arrow keys. (thanks Li Li!)
* Ensure that Buck loading messages are displayed in the console.
* Display a loading notification for slow remote file saves/loads.
* Outline view now has an option to display only the short symbol name (thanks Pankaj Kakkar!)
* Clicking on file in uncommitted changes section opens file in editor instead of diff view.

### Flow

* Autofix certain Flow errors caused by slight misspellings.

### OSS

* New console debugger REPL is now available for OSS.
* OSS Nuclide now has access to the new Debugger Selection UI.
* Context view is now available for the OSS.
* PHP debugger supports "Single Request Stepping".

### Fixes

* Fixed uncommitted changes section breaking when there are too many uncommitted files.
* Fix blame error on remote repositories when it needs to pull info from hg server.
* Fixed setInterval timer leak under certain circumstances in debugger's entry point code.
* Fixed remote mercurial repository detection.

## v0.171.0

### Highlights

* Debugger support for attaching to local and remote Node processes.
* Adds a file changes file tree section to quickly browse and diff changes.

### General

* Autofix can now remove unused Flow suppression comments.
* Add keyboard shortcuts for navigating the list of diagnostic messages:
  * Previous: `alt-<`, Next: `alt->`, First: `alt-ctrl-<`, Last: `alt-ctrl->`.
* Diff View is now only showing the current working directory diff / stack changes.
* Console position is now preserved across Atom reloads.
* Distraction Free Mode now also hides "Find and Replace".
* Fix 100% CPU usage infinite loop when opening `atom://` uris (e.g. preferences).

### Debugger

* Added UI in PHP debugger for editing and sending HTTP requests to a chosen endpoint.
* Attach Debugger UI now collapses a row if its content is too large.

## v0.170.0

Hotfix release for spurious Diff View errors.

## v0.169.0

### General:

* Columns in the Diagnostics table are now sortable.
* Dragging the last tab out of a panel will now hide it.
* Outline View is now rendered as a tab.
* Improved React Native Packager errors.
* Task Runner: Unavailable tasks are now marked as disabled in the dropdown.

### Buck:

* Auto-detect the build target of the active file in the targets typeahead.

### Flow:

* Top-level variables are now displayed in Outline View.

## v0.168.0

### General:

* Merged RN iOS Log Tailer & iOS Log Tailer; Filtering is controlled via a setting (which only shows RN logs by default).
* Added tag whitelist setting, with an RN appropriate default.
* Add keyboard shortcut for clearing the console. (Shortcut: `⌃L`)
* tool-bar@^1.0.0 are now the only versions supported.
* Fixed Hack grammar type hinted default parameters.

### Debugger:

* Breakpoint checkboxes in the new debugger UI for enabling and disabling breakpoints now works.
* Fixed bug where the C++ debugger wouldn't attach to a process in certain scenarios.

### Source Control

* Add navigation buttons and keyboard shortcuts (`cmd-ctrl-[` & `cmd-ctrl-]`) to Diff View's toolbar.

## v0.167.1

_OSS only release_

* Workaround possible deferred activation.

## v0.167.0

### General

* Fix incorrect remote file save / reload conflict warnings.

### Languages

* Objective-C: Support go-to-declaration for `#imports`.
* C++: fix out-of-memory crashes with large compile_commands.json files
* Fix default Hyperclick trigger keys for Linux/Windows to be the same as before.

### Debugger

* Fix breakpoint line numbers off by one.
* Breakpoints can now be placed in files with no extension.
* PHP scripts without file extensions are now able to be launched under the debugger from the HHVM toolbar.

### Source Control

* Add navigation buttons and keyboard shortcuts (`cmd-ctrl-]` & `cmd-ctrl-[`) to Diff View's toolbar.
* Add 'Rebase Stacked Commits' option in Diff View's Amend Form.

## v0.166.0

### Highlights

* Allow subdirectories of project roots to be the Current Working Root
* Added Open File in Atom from your remote server:
  * `nuclide/pkg/nuclide-remote-atom-rpc/bin/atom [--wait] <FileName>[:line[:column]]`
* Hyperclick trigger keys are now customizable

### General

* Added Atom commands for all Task Runner tasks (Buck, Swift, etc)
* Remote connection config is now stored under `nuclide.nuclide-remote-projects`
* Remove Recent Files keyboard shortcut (`cmd-alt-r`) due to conflict with React Native packager
* File tree: Only show the "Open Files" label if there are open files

### Languages

* C++: Fix `#pragma mark` positioning in Outline View
* Python: Enable language features for MagicPython users

### Buck

* C++ build errors are now displayed as in-editor diagnostics
* Enable the “Debug” toolbar option for C++ binaries
  * Launch arguments can be provided from the settings button in the toolbar
* Added a Nuclide > Buck submenu for Buck tasks
* Fix race condition with build output

### Debugger

* Single thread/request stepping option for PHP and C++
* Improved UI for attaching the native debugger to a process
* Improved Threads List table
* For C++
  * Suspends all threads besides the active thread while stepping
  * Fix LLDB launch arguments with quotes/escapes
  * Enable Buck "Debug" button for C++ binaries
* For PHP: prevents the debugger from jumping between requests while debugging

### Source Control

* Improve Nuclide's merge conflicts detection to report conflicts only when not resolved in any other merge tool / editor

### Fixes

* Removed hardcoded paths in the debugger in favor of a new PHP Runtime Arguments field in settings
* Removed hack to work around debugger XML corruption bug in HHVM
* Make arc lint autofix more robust

## v0.165.0

### Hotfixes

* Fixed type-hint scroll bar on Atom 1.9.x

## v0.164.0

### Highlights
* New Debugger UI
* Fix issue with lingering code highlights when editing

### General

* Compatibility fixes for Atom 1.9.x
* 40+ quality, performance and & stability improvements
* UX Improvements to task runner, console, NUX tours, ctrl-clicking on mac, and more

### debugger

* UX & UI improvements to native launch/attach modal
* NUX for new debugger UI

### Languages

* Python: Fix outline view with Python 3 typehints
* Clang: Improvements and fixes to autocomplete, C++ diagnostics

### Remote connection
* Fixed: File-tree failed to expand a directory with file names containing `%` character

## v0.163.0

### Hotfixes

* Reverted changes to the diagnostics panel that caused refresh issues
* Put back quick-open modal styles for Atom Dark theme
* Fix a regression that you can't set breakpoint in a non-parsed source file after starting debugging

## v0.162.0

### Highlights

* Hovering over Unicode escape sequences shows a data tip with the phrase rendered
* Performance improvements:
    * Flow uses a lower CPU priority
    * Large remote files (over 2MB) no longer make the editor unusable

### General

* Added developmentMode for easier NUX debugging
* Created a NUX for Diff view
* Fix for horizontal scrolling in file tree in Atom 1.9
* Failed SSH authentication will automatically retry using a password prompt
* Server certificates/keys are no longer stored in `$ATOM_HOME/config.cson`

### C++

* You can specify environment variables in C++ debugger launch UI for target process
* Optional arguments (i.e. with a default) now show up in autocomplete results

## v0.161.0 (hotfix)

* Fix React Native packager (wasn't getting working root)
* Use new command for showing console in Debugger
* Fix file tree resizing in Atom 1.9

## v0.160.0

### General

* New User Experiences (NUXes) are now released and ready for use! These can be used by developers to introduce and guide users around Nuclide features
* `arc build` is now enabled in the task runner (build toolbar) for any repo that supports it
* Added “Always Ignore” option to popup that appears when active bookmark changes
* Fuzzy filename search now respects hg/gitignore

### PHP

* New PHP/HHVM debugger breakpoint calibration/resolution experience

### Python

* Fixed outline view breaking for functions without parameters

### Console

* New button for toggling console added to the toolbar
* Improved consistency of message styling
* Console now appears in panel (instead of the normal workspace)
* Size is restored after panel has been closed

### Task Runner

* Palette commands now give precedence to task runner of the selected task

### React Native

* Packager is now run from current working root

## v0.159.0

* Nuclide version is now reported in the 'Nuclide' menu in the menu bar.

### [New Feature] Swift

* Select "Swift" from the task runner toolbar to build and test Swift packages.
* After you've built a Swift package, Nuclide provides autocompletion suggestions for Swift source files in the package.
* More info https://nuclide.io/docs/languages/swift/
* Thank you @modocache!

### Remote Connection

* Connecting with an empty remote command will now use the default remote command.
* Significantly faster reloading of remote projects with many files open.

### C++:

* The user will now receive an in-editor notification telling them when they have switched threads while debugging.

### HACK:

* The user will now receive an in-editor notification telling them when they have switched requests while debugging.

### Python:

* Display a busy signal while waiting for code formatting results.

### Fixes

* Duplicate error messages from the PHP debugger in the console now report correctly.
* Remote files are restored correctly after restart on Windows.
* Restore cursor state correctly when code formatting large files.

## v0.158.0

* Quick Open: “Open All” button to open all search results (or `shift+enter`)
* Flow: Setting to use the version of Flow installed in individual projects via the `flow-bin` npm package
* Buck: Selected Simulator is now remembered between sessions
* Task Runner: Added toolbar toggle commands for each runner
* Settings: Add a search field that filters for relevant settings
* Code format: Preserve cursor location after full file format (`cmd-shift-c`)
* Performance: Health metric now shows in toolbar to highlight when Nuclide is waiting on external processes
* Python: Fix Find References on import statements

## v0.157.0

* Hotfix service framework erroring on undefined object values (fixes remote Flow type tooltips).

## v0.156.0

### General

* [New Feature] **Bookshelf** feature for tracking open files per bookmark and prompt to open those files on active bookmark changes and customize behavior to '**Always Restore**', '**Always Ignore**' or '**Prompt to Restore**' from Nuclide Settings.
* Added setting controlling the server shutdown confirmation dialog.
* Atom messages now show up in the console.
* [Fixed] Starting the RN debugger no longer pauses in the Executor.js file unexpectedly.
* Context View: Change hotkey from cmd+B to cmd+I to match OSX “Get Info” pattern.
* Context View: Add “open in main editor” button to Definition Preview which opens the currently selected definition displayed in Definition Preview in the main editor pane.
* Turn lint-on-fly on by default for packages compatible with the 'linter' package.

### C/C++

* GTest TEST/TEST_F macros now show up in clang outline view.
* One-click debugging of C++ unit tests via the "Debug" button in the Buck toolbar.


### Python

* Added a setting to disable linting in Python.
* Added a setting to enable linting on the fly.
* [Fixed] A bug with Python flake8 linting where unused `from .. import ..`s would crash the linter.

### UI

* Display a loading indicator while fuzzy filename search is starting up.


## v0.155.0

* v0.152.0, v0.153.0, and v0.154.0 could not be packaged internally - skipping them.
* Hotfix an overly-zealous python linter integration.

## v0.151.0

### General

* [Fixed] Working Sets are significantly faster now.

### React Native

* Improve ADB Logcat errors.
* Notify when the packager is running.

### Buck

* Added settings to allow providing of extra arguments to build/test/run.
* Fixed an issue where Buck project would not be found after reloading Atom.

### Python

* Builtin flake8 linting, uses configuration from the nearest .flake8 file.

### C/C++

* Fixed instability while working with (local) files in large Buck targets.

### Hack

* [Fixed] Autocomplete and XHP, don't insert duplicate ':'
* Improved the Autocomplete UI. In particular make function signatures easily visible.
* Code highlighting now highlights all symbols, not just local variables.

## v0.150.0

* Hotfix a file-tree de-serialization bug resulting in an empty file-tree despite having a project mounted.

## v0.149.0

### General

* Atom 1.8.0 is now the officially supported version of Atom.
* Clicking on Find References preview now takes you to the reference.
* Fixed Remote Project reconnection after a network interruption (like bad wifi or waking).
* Fixed a scrolling bug in Open Files when the selected entry is the active file.
* Fixed remote searching for things that look like broken regexes (e.g. `foo(`).
* Fixed the blame gutter not hiding if blame failed to load.

### C/C++

* Added local-only setting for specifying the clang library path.
* Fixed Nuclide buck source level iOS debugging.
* Show `#pragma mark` in Outline view.

### Console

* RN Packager output now appears in Console.
* Multiple sources can be shown at once in the console.
* Processes can be started and stopped from console source list.

### File Tree

* Added keyboard shortcut (`cmd-f`) to "Search in Directory" from the file-tree.
* Fixed canceling a "save" after a file's remote project root is removed.
* Fixed removing a project after a re-start when that project's directory no longer exists.

### Hack

* Hack grammar now handles `HEREDOC`'s correctly.

## v0.148.0

**General**

* 2-3X faster remote connection initialization
* Fix bug with autoscrolling console
* Various bugfixes for build toolbar
* Build system can be selected using command palette
* Path search: Now respects Atom's “Ignored Names” setting
* More responsive file tree deletion for hg projects

**Buck**

* Build / test output now appears in the console
* Buck commands are now cancellable (press the stop button in the toolbar)

**Python**

* Autocompletion/hyperclick support for Buck-based Python projects
  * Requires that a python_binary or python_unittest target for the source file has been built. Currently we don't automatically run buck build, so make sure to do so manually.
  * Will not work if a dependent python_binary or python_unittest isn't present in a parent directory's TARGETS/BUCK file.
* Import/module resolution for autocompletion/hyperclick relative to top-level module
* New setting to toggle arguments autocompletion

## v0.147.0

Hotfix release. Fixes:

* Conflict resolver opening invalid file paths.
* Check heartbeat version while starting connection for smoother upgrades when the RPC protocol changes.
* Properly handle `getDigestSync` for remote files that no longer exist.

## v0.146.0

Hotfix release. The Context View was misbehaving and causing the remote hack service to timeout.

## v0.145.0

**General**

* More detailed Flow error messages.
* Remote Connection Dialog: Added a “Save” button to save changes to Connection Profiles.
* Remote Connection Dialog: Double clicking a profile now connects to that profile.
* Performance improvements for C++ outline view / diagnostics.

**Source Control**

* Added “Rename bookmark” ability to the bookmarks side bar.

## v0.144.0

Hotfix release

## v0.143.0

**General**

* [New Feature] The file-tree can display a list of open files.
* [New Feature] Drag to move files and directories in the file-tree, including ability to move multiple files at once with cmd/ctrl click.
* Opt-in new behavior for moving editors across panes via keyboard shortcuts ([see details](https://github.com/facebook/nuclide/tree/master/pkg/nuclide-move-item-to-available-pane/#readme)).
* Double click on an outline view item to select it in the editor.
* Fixed docs navigation on nuclide.io.

**Internal**

* Lots of new integration tests that improve Nuclide's reliability & speed up releases.

**Source Control**

* Better error handling and messages for publish failures.
* Diff View: Update UI for project additions/removals.
* Diff View: rate-limit the calls to `hg status`.
* Show author in revision timeline
* Added “show history” to source control context menu.

**Debugger**

* C++ debugger: Various UX improvements for launching debuggee process
* More prominent debugger breakpoints


## v0.142.0

**General**

* Fixed: file-tree could spontaneously collapse on a flaky network.
* New Settings UI Pane (cmd-option-, or Nuclide Settings: Show from the command palette)

**Source Control**

* Diff View is now much faster showing the changed files.

**Python**

* Code formatting on local or remote using pyfmt or yapf, accessible using standard controls (context menu, cmd/ctrl+shift+c, or Edit→Text→Format Code). This will use rules from the nearest .style.yapf, or if not available use yapf's default (pep8). Currently pyfmt or yapf must be in the system path - the path to binary will be configurable in the near future.
* Find references, will only find results within the current file and PYTHONPATH at the moment.



## v0.141.0

* Hotfix for Python httplib server compatibility issues.

## v0.140.0

**General**

* After updating Nuclide, a notification now asks you to reload Atom.
* Atom 1.7.4 is now the minimally required version of Atom.

**Source Control**

* Clear diff view UI when the active file is deleted.
* Diff View: Fix various contents-override errors when the diff view is closed and opened on with a different file.

**Flow**

* Outline view now includes type declarations.
* Fixed race condition that often caused outdated Flow errors to appear, requiring multiple saves to get up-to-date errors.

**C++**

* Threads window for C++ debugger.

**Hack**

* Cmd-B Preview Definition Window.

## v0.139.0

**Python**

* Experimental: Autocompletion and go-to-definition for Python files.

**Hack**

* Debugger warns if HPHPD is attached.

**C++**

* Automatically select the first frame with source code during C++ debugging pause.
* Auto refresh C++ debugger attach process list.
* Decreased resource usage of background indexing processes.

**Buck**

* Added loading indicator for target selector.
* Re-enabled build progress indicator in the toolbar
* iOS simulator dropdown is now hidden for non-iOS projects.

## v0.138.0

Hotfix for an error being thrown during the upgrade process from <0.136 to >=0.137

## v0.137.0

### JavaScript & Hack

* New feature: Added the type-system coverage information.

### C/C++

* Added support for #include hyperclick.
* Improved flags detection for header files.

### OCaml

* Added support for switch between header/source.

### Hack

* Outline improvements:
  * Overall responsiveness.
  * Additional symbols and function params.
  * Modifiers.
  * Highlighting current symbol in the outline view.

### Debugger

* React Native attach UI.

### Source Control

* Typed in publish message is preserved if a publish is canceled.
* hg add and hg remove are reflected properly in the file-tree.
* Existing files can be added to and removed from the Mercurial from Source Control menu.

### General

* Bump Atom version dependency to 1.7.3 and Node to 5.1.1.
* Nuclide logs are always written under system temp dir now.
* Filename search now supports full paths.

### UI:

* z-index fix to combobox in buck build toolbar.
* Nuclide console now shows a notifications when there are new unseen messages.
* Reduced flickering in omni-search.
* Shadow breakpoint is displayed when hovering over the gutter for easier breakpoint toggle.


## v0.136.0

### General

* Fix: file-tree and remote connection modals now appear properly in Atom Beta v1.8.

### Debugger

* Highlight pinned debugger values when they change.
* HHVM Toolbar remembers script arguments for launched scripts when tabs are switched.
* PHP Debugger stability fixes.

### Source Control

* Fix fast editing/saving with long-delay saves reverting user changes.
* Fix diff view updating block decorations to sync with out-of-diff-view edits.
* Fix publish suggestions racing with commit/amend.
* Fix a case when scrolling gets out of sync when opening a new file.
* Fix race condition that leads to closing/re-opening the Diff View not loading the revisions.
* Fix stuck in publishing state after publish/amend.
* Fix padding and invalid scrolling of changes at the end of a buffer.
* [UI] Fixed blame usage for 3rd-party themes ([#484](https://github.com/facebook/nuclide/issues/484)).
* [UI] Better theme coloring for diff blocks.
* [UI] Easier switching to Commit/Amend/Publish.
* [UI] Fix highlighting removed by Atom when editor not focussed when updated.
* [Experiment] Change the default comparison revision to show dirty changes (hg diff result).

### Windows

* Fix: clicking on an item in the diagnostics panel no longer opens a new tab every click.
* Fix: reveal in file-tree does not freeze Nuclide any more.

## v0.135.0

### General

* Remote
    * Variety of remote project reliability improvements.
    * Unsaved file contents will be reopened in a new tab if saving fails while closing a tab.
    * Fix spurious 'file has changed on disk' messages in remote files.
* Quick-open: Fuzzy filename results now always rank at the top of Omnisearch.
* Working Sets now work on Windows.
* Fix z-index issue with Hyperclick suggestions.

### Source Control

* [New] Improved integration: Revert files/directories from the file tree and text editor context menu + shortcut (cmd+alt+shif+r).
* Fix file tree VCS status rendering with hg updates.
* Diff View Publish: faster feedback about the created/updated Phabricator revision.
* Fix mercurial diff stats spiking CPU with Atom >= 1.7 (open source).
* Show the `hg log` for a file or directory. You can launch this view in one of three ways:
    * In the active text editor, use the keyboard shortcut `ctrl-cmd-l` on OS X or `ctrl-shift-l` on Linux/Windows. (Mnemonic: L is for Log!).
    * In the file tree, right-click on a file or folder. From the context menu, select **Source Control** ▶ **Show history**.
    * In the active text editor, right click. From the context menu, select **Show history**.

### JS

* Render `module.exports` in Outline View.

### C/C++/Obj-C

* Go-to-declaration (cmd+click) now works for macros.
* Outline view fixed for Objective-C files.
* Improved autocompletion performance for large files.


## v0.134.0

Hotfix for outline view regression.

## v0.133.0

### General

* Vastly improved file-tree performance for large repositories.
* Added a "Kill Nuclide and Restart" menu option to kill the remote server.
* Output pane now autoscrolls correctly.
* Fixed file-tree appearance with the one-light-ui Atom theme.
* Quick Open: Fixed bug where filename search fails to load at startup.
* Diff View: Improved file switching performance.
* Diff View: Fixed off-by-one diff view blocks.

### PHP

* Added project selector in Debugger Launch/Attach UI (cmd+shift+A)

### C++

* Added outline view support for C++.
* Debugging:
  * Fixed crash while stepping into function with parameters pointing to non-utf8 characters.
  * Support simultaneous debugging from multiple Nuclide instances.

### React Native

* Updated bundled React Native inspector to 0.14.9.
* Improved error messages for adb, syslog, and React Native debugging.

## v0.132.0

* Hotfix double publish.

## v0.131.0

### Added

* cmd+click on npm packages in `package.json` files to open the package's page on npmjs.com.
* The file tree will now highlight changes from local git repositories.
* Test runner "Run in Debug Mode" checkbox.

### Fixed

* UX improvements for the Console window.
* UX improvements for Commit / Amend / Publish.
* Remote "Search in Directory" now finds all results.

### Changed

* Improved search in the file-tree. Contributed by Alexander Juarez (@alexjuarez).
* C++: Hover over 'auto' variable declarations to reveal their type.
* C++: Automatically update include paths when `TARGETS` files change.

## v0.130.0

### Added

* Distraction-Free-Mode:
  - Hide things the file tree and outline view to focus on your code.
  - Toggle Distraction-Free-Mode from the toolbar's eye icon (or trigger the `nuclide-distraction-free-mode:toggle` command).
* Debugging:
  - Native/C++ debugging for remote devserver.
  - Datatips while debugging, hover over identifiers to display their value. Value datatips can be pinned and will update while debugging.
* Settings for specifying the paths of `adb` and `syslog`.
* Source Control context menu in the file tree.
* Support for `BUCK.autodeps` files.
* Enable open files ouside of file-tree in remote server.
* Outline view for JSON files.

### Fixed

* User-visible errors (with troubleshooting tips) are now raised when adb and syslog aren't on the `PATH` and you try to run them.
* Made PHP debugger less crashy when stepping, setting breakpoints, and more.
* Text no longer jumps around while stepping in the debugger.

### Changed

* File-tree scrolling performance was improved.
* Hide debugger panel after stop debugging.
* Nuclide will not load at all in Atom <1.3.0.

## v0.129.0

* Fixes an issue where the Diff View would fetch Mercurial data even if not visible.
* Fixes an issue where Mercurial commands would inherit personal user settings resulting in unexpected behavior when standard commands where aliased with flags.

## v0.128.0

### Added

* Outline View:
  * Python support.
  * Show flow class fields.
  * Highlight the current location of the cursor for JavaScript.

### Fixed

* Made a handful of small improvements to outline view, including improving the UX when outlines are computed slowly.
* Datatip highlight color across themes.
* Async Repository incompatibility with v1.7.0-beta.
* Fix Diff View's tree highlighting deleted commit changes.

### Changed

* The "Nuclide" menu is now before "Window" and "Help".
* Atom 1.6.1 is now the minimally required version.

## v0.127.0

### Added

* Outline view for Flow and Hack. Toggle with the outline icon on the toolbar, or with alt+o.
* Forward/Backwards Navigation Stack with `ctrl-`, and `ctrl-`. (`ctrl-<` and `ctrl->` on linux).
* New "Nuclide" top-level menu.
* Diff View:
  - Browse history & commit (hg only).
  - Persist commit messages between mode switches.
  - Switching modes changes the diff method to show relevant changes only.
  - Open from file tree will select the nearest file change within that directory (or in the selected root).
  - Opening from the toolbar defaults to diffing the current working root (File tree Suitcase icon).
  - Show multiple repos changes in browse mode, while in Commit mode, show only the active repository's relevant changes.
* nuclide-console messages can be copied to clipboard.

### Fixed

* Diff View: Opening a changed file won't revert user changes nor clear undo history.
* React Native debugger no longer pauses on loader breakpoint.
* Performance and stability wins for PHP script debugging, approximately a 2s speedup when launching scripts.
* Fix Remote "file changed on disk" notification without actual changes.
* Fix file reloads, conflict popups or reverting user changes on flaky / slow network connections.
* C++: Significantly faster (~50%) initialization times on devservers.
  - Improved feature coverage for header files in Buck projects.
  - Restarting Atom now clears Clang server state (or try "Clean and Rebuild" from the Nuclide menu).
* Static/out-of-scope variables are no longer shown in “locals” section of lldb debugger.

### Changed

* Toolbar icons split into two groups when you upgrade to tool-bar 0.3.0.
* nuclide-output is now nuclide-console.

## v0.126.0

* Fixes for the `left-pad`/`relative-date` npm unpublishing.

## v0.125.0

### Added

* Buck tests can now be triggered from,
  - The "Test" button in the Buck toolbar, or
  - via Atom commands (command palette or custom keyboard shortcut).
* Diagnostic/linter results table columns are now resizable.
* Settings for custom HHVM, RN node executable and Merlin (OCaml) paths.
* Support Clang macros and brief comments for autocompletion.
* Improvements to evaluation in the HHVM debugger.

### Fixed

* Improved the support for multiple windows in Working Sets.
* Debugger doesn't refresh when reloading React Native apps.
* Opening an already open remote file won't not discard all local changes.
* Focus and blur side bar children (like file-tree).
* Continued improvements to fuzzy file searching.
* Remote search for matches with `:`.
* Preview tab support for Atom 1.6.0+.

## v0.124.0

Fixed:

* Server Crash related to Mercurial / Watchman upgrade rollout.
* Improved the support for multiple Nuclide windows in Working Sets.

## v0.123.0

Added:

* Show Hack Type Coverage - ctrl-alt-shift-V
* Display an error if the Flow server crashes, rather than silently ceasing to provide Flow features.
* Autofix for C++ diagnostics (e.g. for typos and missing semicolons)
* OCaml diagnostics and typehints
* Diff View auto-scroll to first change.
* Show connection profile info next to remote folders in file tree.

Fixed:

* Diff View: Fix multiple race conditions that caused user edits override.
* 3x Optimization to mercurial status queries during updates - fix halting nuclide.
* Better scrolling when navigating with hyperclick and diagnostics.
* Fix Hyperclick error when going out of screen range.
* Improved autocompletion for C++ function/method calls

## v0.122.0

Added:

* Added 'Current Working Root'

Fixed:

* Faster Path Search (blacklist yourself from GK nuclide_file_search_native in case of issues)
* Working Sets selection UI was aligned with core Atom for better compatibility with themes and other UI elements
* Correctly report invalid .buckconfig file
* A bug prevented certain types of Flow errors from appearing. This is now fixed.
* Some fixes for HHVM debugger printing of map-like arrays and other hierarchical data structures.
* HHVM script debugging breakpoints trigger more reliably.

## 0.121.0

Fixed:
* Slow typing caused by the FileTree - even when hidden.
* Fix Slow typing caused by health monitor.
* Fix FB login.
* Fix endDebugWhenNoRequests

## 0.120.0

Added:
* New feature: Working Sets - show only selected directories in the file-tree
* File tree keyboard navigation: Allows you to rapidly change the selected node by typing a prefix string.
* Buck toolbar now shows loading message while querying targets
* Diagnostics panel displays errors above warnings

Fixed:
* Improved Ctags search performance
* Fix some server connection issues

## 0.119.0

* Fix an assertion that can cause the server to crash periodically.

## 0.118.0

### Added

  * Open a newly duplicated file on duplication.
  * Pretty toolbar dividers.
  * React Native debugger w/o Buck.
  * React Native iOS simulator logs.
  * HHVM output is shown in the output window.

### Fixed

  * Correctly remember last connection profile.
  * Close project files when removing project.
  * CMD+C copying from "Find References".

## 0.117.0

* Add commands for debugging non-Buck React Native apps (requires [react-native#5717](https://github.com/facebook/react-native/pull/5715))
* Add commands for running RN Packager without building via Buck
* Fixed “unknown call” warning in RN element inspector
* Added limit on Clang server memory usage
* Improvements to datatip UX: Datatips disappear on keydown, and the default delay is now 200ms and can be configured in settings (Packages > Nuclide > Nuclide-datatip > debounce delay). Also improved the mapping of mouse coordinates to code.

## 0.116.0

* Datatips are now pinnable.
* Make diagnostics look a bit more like datatips.
* Improved arc lint autofix - handling multi-line.
* Improvements to Diff View syncing.
* Diff View supports opening revealing files in the file tree and directly in the editor.
* Fixed specifying custom buck command.
* Fix: Debugger scrolling works in Atom 1.4.x.
* Added code formatting for clang.
* Added custom clang flags in the settings page.
* Minor improvements to remote file handling.
* Disable blinking cursor from readonly editors in (Diff View, Test Runner & Smartlog).

## 0.115.0

* Fixed the OCaml Merlin path config setting
* Fixed Clang autocomplete latency regression
* Fixed diagnostics for local PHP files
* Fixed diagnostics for Hack
* Improved reloading multiple remote projects after a crash
* Improved server reliability by handling invalid marshalling and Watchman recrawls
* Prevent opening files larger than 10MB on the server to prevent crashes

## 0.114.0

### Added

* Output:
  * Panel for displaying log messages.
  * adb-logcat provider (and commands for starting and stopping `adb` logcat).
* Hack: XHP syntax to language grammar.

### Fixed

* Server connection flakiness.
* File-tree: clicking on a selected node with preview tabs enabled opens the file.

### Changed

## 0.113.0

### Added

* Type Hints:
  * Better (faster) UX for triggering and interacting with type hints.
  * ESC/cancel closes current type hint.
  * Experimental support for flow "hint trees" (interactive UI for exploring nested types in type hints). To try it out, enable the "nuclide-flow: Enable Tree-structured Type Hints" setting.
* Lint: Autofix is now enabled by default.
  * Eligible lint errors will have a "Fix" button in the gutter popup.
  * `alt+shift+a` will fix all eligible errors in the current file.
* Debugger: HPHPD-style leading `=` syntax for evaluating expressions is now supported in the debugger console.
* Debugger: Pass multi args to hhvm in script debugging.
* HHVM Debugger: Scripts launched from the HHVM toolbar can now be passed command line arguments.
* Debugger: Add a new contextual menu for regular breakpoints (conditional breakpoints in the works).
* Tool Bar: Add "Hide Tool Bar" context menu for Buck/HHVM.

### Fixed

* ctags: Improve relevancy for JS development, shows results even if Hack service is available.
* C++: Hyperclick performance improvements, better compile error messaging.
* Nuclide Server: Diagnostic improvements.

### Changed

* Blame: Replaced individual show/hide commands with toggle.
* UI: Move Health icon from statusbar to toolbar.

## 0.112.0

### Added

* Dedicated toolbar shortcut icons for toggling the HHVM and Buck top bar.
* Include type information with clang results.
* Quick open for ctags.
* "Reload Atom" on server crash button.
* Connection profiles got a total makeover.

### Fixed

* Reduced clang cache memory consumption.
* diff-view context menu items appear both in Nuclide's file-tree and in Atom's tree-view.
* fb-watchman exceptions.
* Race condition that prevented the diff-view from re-opening on restart.
* React Native debugging for newer versions of React Native (Note: Node v4 still needs to be on Atom's path).

### Changed

* Continued improvements to the experimental filename search.
* hg-repository now checks `default` instead of fb-specific `remote/master`.

## 0.111.0

Nuclide is now a single Atom package named 'nuclide'. All 'nuclide-*' packages are deprecated and
will be unpublished after this release.

* Node Debugger:
  * Now works on node processes running any major version of node/iojs including 0.10.x, 0.12.x,
  1.x, 2.x, 4.x, 5.x.
* Hyperclick:
  * Anything that looks like it might be a valid web address is clickable. Eg. http://cats.com
    (http://cats.com/) (a word with a valid TLD).
  * ctags support: any symbols in a valid 'tags' file in your project directory should be clickable.
  * Fix Hyperclick errors with split panes.
* Settings:
  * All settings are in one spot: Preferences → Packages → Nuclide → Settings.
* File Tree:
  * Preview Tab support. Enable from Packages →  tabs →  Use Preview Tabs.
* Buck Toolbar
  * RN Server checkbox value now remembered after restart
  * Output window can now be moved and split
* C++ support:
  * Significant performance improvements for diagnostics, autocompletion, and click-to-declaration
  * Loading indicator will display in status bar while C++ files are parsing
  * Stability: clang errors should no longer cause the Nuclide server to crash
  * “Find References” support for clang-enabled projects (right click on any symbol)
* More robust Watchman integration for Mercurial and file-change reload features.
* Fix Mercurial blame for remote projects.
* Fix Diff View offset rendering for large diffs and split panes errors.
* Arc lint autofix beta:
  * In the settings for the Nuclide package, check nuclide-diagnostics-ui: enableAutofix.
  * There will then be a 'Fix' button in the popup for eligible lint problems.

## 0.0.35

* Improvements to prevent spawning many Mercurial processes.
* Diff View:
  * Performance Optimizations (Caching and avoid expensive calls when Diff View is closed).
  * Add a 'Navigation Bar' for easier (add/delete/change) line change scrolling
* Hyperclick / Go to definition Improvements:
  * Go to definition doesn't collide with multi-cursor feature (not end up with multiple cursors).
  * Hack: Go to definition shows a navigable suggestion list when hh_server can't determine the
    exact location of the (e.g. dynamically-typed method calls).
  * Hack: XHP go to definition highlights XHP tags correctly (while it still jumps to the right
    place).
  * UX: Fix cursor indicator for loading and result-ready.
* Support formatting of `const` requires in format-js

## 0.0.34

npm-only release. Our Node packages were released so that external packages could consume them, but
we did not update any Atom packages.

## 0.0.33

This was tagged but not released due to an issue.

## 0.0.32

* **Bug Fix**
  * Exclude `nuclide-debugger-node` from `nuclide-installer` until we can fix the issue with
  its native dependencies getting built properly. Fixes
  [#193](https://github.com/facebook/nuclide/issues/193).
  * Hack and Flow diagnostics are now removed appropriately when the corresponding project folder
  is removed.

* **Documentation**
  * Added [README for `nuclide-diagnostics-store`](
  https://github.com/facebook/nuclide/tree/master/pkg/nuclide/diagnostics/store#readme).

## 0.0.31

* **New Feature**

  * **New Diagnostics UI** Previously, we encouraged Nuclide users to install the third-party
[linter](https://atom.io/packages/linter) package in order to see errors from our Flow and Hack
packages, but now we include our own packages for displaying diagnostics as part of Nuclide. We
divided this functionality across two Atom packages:
[nuclide-diagnostics-store](https://atom.io/packages/nuclide-diagnostics-store) and
[nuclide-diagnostics-ui](https://atom.io/packages/nuclide-diagnostics-ui). The former is the
model/controller component where diagnostics are reported and broadcast out to registered listeners.
The latter is the view component that subscribes to the model and presents diagnostics to the user
via editor gutters and a table view. The `nuclide-diagnostics-store` is capable of consuming
providers that conform to the `linter` API in addition to its own API. This means that even if you
disable the `linter` package, you will still see all of the same errors and warnings from packages
that adhere to the `linter` API in Nuclide.
![](https://raw.githubusercontent.com/facebook/nuclide/master/pkg/nuclide/diagnostics/ui/docs/diagnostics-ui.png)
  * **Buck** We now support building with [Buck](https://buckbuild.com/) in Nuclide. If the active
  editor corresponds to a file in a Buck project (which means it has a `.buckconfig` file in its
  ancestor directory), then the Buck toolbar will be displayed at the top of your Atom window.
  From there, you can enter a Buck [build target](https://buckbuild.com/concept/build_target.html)
  or alias, and then choose to build, run, or debug that target. (Note that like most features in
  Nuclide, this also works if you are [working with remote files](http://nuclide.io/docs/remote/).) We
  also syntax highlight `BUCK` files and make it possible to `cmd-click` on build targets to navigate
  between `BUCK` files. As Buck supplies all sorts of information about the structure of your project
  to Nuclide, you can expect us to provide even more integration with Buck going forward.
  * **iOS support** This release builds on top of the new Buck support to also provide support for
  iOS. The major caveat is that your iOS project must be configured to
  [build with Buck](https://buckbuild.com/rule/apple_bundle.html) in order to get support for iOS
  development in Nuclide. Once you have made this investment, common IDE features, such as
  autocomplete, click-to-symbol, and diagnostics reporting will be available for your iOS code in
  Nuclide. You can also build, run, and yes, *debug* your iOS app from Nuclide. As is common in most
  IDEs, you can click in the gutter of an editor to set a breakpoint. When running your app in debug
  mode and you encounter a breakpoint, you can inspect it via the familiar
  [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools/) UI. Note that the
  Console in the DevTools is wired up to the LLDB REPL, so you can issue LLDB commands such as
  `thread backtrace`.
  * **cxx support** In many ways, iOS support is just a special case of supporting the C-family of
  languages. However, the same caveat still applies: your cxx project needs to
  [build with Buck](https://buckbuild.com/rule/cxx_binary.html) in order to get support for
  autocomplete, click-to-symbol, and diagnostics.
  * **Hack** improvements:
    * Use `hh_client` for the diagnostics result if available for better accuracy and consistency
    and eliminate the false positives of cases not known for the local Hack model.
    * Prioritize Hack's context-sensitive autocompletions over grammar snippets.
    * Autocomplete of static and instance methods does not require a typed prefix (to be more
    predictable).
    * Updated [hh_ide.js](
    https://github.com/facebook/nuclide/blob/master/pkg/nuclide/hack/static/hh_ide.js) to the
    latest HHVM build.
  * **Flow** improvements:
    * Display all Flow errors in the entire project, rather than just those in files that have been
    recently opened.
    * Fix Flow autocomplete, and use snippets to pre-fill function arguments.
  * **hg blame** From the initial launch of Nuclide, one of our most unique features compared to
  most editors is tight integration with Mercurial. In this release, we take things one step further
  by adding support for `hg blame`. If your current file belongs to an Hg repository, you can
  right-click in the editor and choose **Show Blame** from the context menu to see the author and
  changeset ID for each line in a custom gutter. Right-click again and choose **Hide Blame** to
  remove the blame information. (Note that as stated in the
  [README](https://github.com/facebook/nuclide/blob/master/pkg/nuclide/hg-repository/README.md),
  this has been tested with Hg 3.4 and above.)
  * **Diff View** (works only for mercurial repositories): The Diff View now offers more help
  discovering the uncommitted source control changes by showing a highlighted up-to-date file status
  changes in a list on the right and changing the right pane editor to be editable and savable to
  allow previewing the changes in realtime and saving the contents to the filesystem, when ready.
  The Diff View is not yet able to detect and diff against the fork base of the source control to
  allow amend commit diffs iterating on the same commit.
  Usage (Open, Navigate, Edit and Save) is as follows:
    * For a certain file, either choose **Open in Diff View** from the context menu or
    **Packages > Open Diff View** from the Atom's menu bar.
    * Double-clicking changed files in the change list will load the diff for that file.
    * Edit the right pane editor with an updated change and see the diff in real-time.
    * (`cmd-s`) or **File > Save** will save the new contents to the filesystem.
  * **Connection Status:** We now display an icon in the status bar to indicate whether a file is
  local or remote, and whether the server is connected or disconnected.
  * **nuclide-file-tree-deux** We have heard your complaints about
  [nuclide-file-tree](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/file-tree) loud
  and clear, so we have embarked on a [rewrite of our file tree package](
  https://github.com/facebook/nuclide/tree/master/pkg/nuclide/file-tree-deux) named
  `nuclide-file-tree-deux` that uses proper React/Flux design patterns to ensure the tree is
  performant for the largest of directory structures. The new package has not reached feature
  parity with the existing `nuclide-file-tree` quite yet, so it is available for dogfooding, but
  it is not enabled by default. Once we have achieved feature parity, we will replace the code for
  `nuclide-file-tree` with that of `nuclide-file-tree-deux` and will delete the
  `nuclide-file-tree-deux` package.
  * **New service framework** One of the primary features of Nuclide is support for developing
  remote files. This is more than just the ability to edit files on a remote machine: it also means
  surfacing information from developer tools that are running locally on that machine, such as Buck,
  Mercurial, Clang, Hack, and Flow. To that end, we design our integration with these tools to use
  asynchronous APIs that are agnostic to where the tools are running. Our pattern for doing this has
  been continuously evolving, but our most recent implementation focuses on definition files written
  in JavaScript/Flow with RPCs that return promises or observables. Our [nuclide-buck-base](
  https://github.com/facebook/nuclide/tree/master/pkg/nuclide/buck/base) package is the first to
  take advantage of this new framework, but we plan to retrofit the rest of our codebase to use this
  soon. We also intend to document it so that you can define your own remote services that plug into
  [nuclide-server](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/server).
  * **New package: nuclide-move-pane** The [`nuclide-move-pane` package](
  https://atom.io/packages/nuclide-move-pane) overrides the default behavior of `cmd/ctrl-k arrow`
  to *move* the pane rather than split it.
  If you want the original behavior, we encourage you to disable this package.
  * **New package: nuclide-format-js** This package is meant to help format JavaScript code in order
  to speed up development. Currently, it has support for automatically adding, removing, and sorting
  requires. It also understands Flow types and will promote or demote a `require()` when
  appropriate. This feature is still in an experimental phase: please see the
  [README](https://github.com/facebook/nuclide/tree/master/pkg/nuclide/format-js#readme) for the
  heuristics involved and how best to integrate it into your workflow. In the future we will be
  adding more AST based transformations that can be configured on and off.

* **Bug Fix**
  * Improve [`nuclide-ocaml`](https://atom.io/packages/nuclide-ocaml) behavior when `ocamlmerlin` is
missing or errors. Previously this could cause a crash.

## 0.0.30

* **Bug Fix**
  * [#163](https://github.com/facebook/nuclide/issues/163)

## 0.0.29

* **Bug Fix**
  * Fixed the transpilation issue identified in [#162](https://github.com/facebook/nuclide/issues/162).

## 0.0.28

* **New Feature**
  * Babel files in Node and Atom packages are now pre-transpiled prior to publishing. This should
reduce initial startup time for `nuclide-server` as well as for Atom, post-Nuclide install.
Both `nuclide-server` and Atom have schemes to cache their transpilations, but

## 0.0.27

*Scrubbed this release because it would have missed [55efd78b](
https://github.com/facebook/nuclide/commit/55efd78b3eb949129fe582657b5988ce0aa70159).*

## 0.0.26

* **Bug Fix**
  * [#157](https://github.com/facebook/nuclide/issues/157)

## 0.0.25

* **New Feature**
  * Was long overdue for a release. There were 222 commits since `0.0.24`.
  * New Atom package: `nuclide-arcanist`.
  * New Atom package: `nuclide-diagnostics-store`.
  * New Atom package: `nuclide-diagnostics-ui`.
  * New Atom package: `nuclide-find-references`.
  * New Atom package: `nuclide-ocaml`.

## 0.0.24

* **Bug Fix**
  * Back out Facebook-specific code.

## 0.0.23

* **New Feature**
  * Was overdue for a release. There were 76 commits since `0.0.22`.

## 0.0.22

* **Polish**
 * Various small fixes in preparation for [CodeConf 2015](http://codeconf.com/) demo.

## 0.0.21

* **New Feature**
  * Target `linter-plus` rather than `linter` Atom package: [1fc2358e](
https://github.com/facebook/nuclide/commit/1fc2358e646d779c9fe9cb39b22b7c21ad61fa6c).

## 0.0.20

*Initial public release of Nuclide.*
