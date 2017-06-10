# nuclide-commons-ui

A collection of React components for use with Atom in Nuclide and related packages.

To use, first `require('nuclide-commons-ui')` to load the stylesheets and then start importing individual components.

```
// Load stylesheets in activate()...
const disposable = require('nuclide-commons-ui');

// Grab individual components as you need them!
const {Button} = require('nuclide-commons-ui/Button');
const button = <Button ... />;

// Unload stylesheets in deactivate()...
disposable.dispose();
```

List of React components:

- AtomInput
- AtomTextEditor
- Block
- Button
- ButtonGroup
- ButtonToolbar
- Checkbox
- CodeSnippet
- Highlight
- Icon
- LoadingSpinner
- Message
- PanelComponentScroller
- ProgressBar
- ReactMountRootElement
- Table
- Toolbar
- ToolbarCenter
- ToolbarLeft
- ToolbarRight

Check out the \*.example.js files for some examples on how to use the components.
