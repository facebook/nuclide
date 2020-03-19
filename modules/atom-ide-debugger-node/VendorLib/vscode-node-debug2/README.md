# VS Code Node Debug 2
[![build status](https://travis-ci.org/Microsoft/vscode-node-debug2.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-node-debug2)
[![Build status](https://ci.appveyor.com/api/projects/status/qrr2hff3eagw5k05?svg=true)](https://ci.appveyor.com/project/roblourens/vscode-node-debug2)

This repository contains a debug extension for [node.js](https://nodejs.org) that ships with [VS Code](https://code.visualstudio.com) and uses the [Chrome Debugging Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/v8/), which Node now exposes via the `--inspect` flag, only in Node versions 6.3+. It's built on the [vscode-chrome-debug-core](https://github.com/Microsoft/vscode-chrome-debug-core) library.

This extension has essentially reached feature-parity with vscode-node-debug. You can see the remaining issues in the [vscode-node-debug2](https://github.com/Microsoft/vscode-node-debug2/issues) repo and the [vscode-chrome-debug-core](https://github.com/microsoft/vscode-chrome-debug-core/issues) repo. You should be able to set `"type": "node2"` in your existing Node launch config and have things work the same, as long as it's running in Node v6.3+.

See an overview of debugging Node.js in VS Code [here](https://code.visualstudio.com/docs/editor/debugging).

## Node version compatibility
Typically it should work with any version of Node greater than 6.3. But there is some instability in Node with this option before 6.8, especially in Windows. Due to [nodejs/node#8155](https://github.com/nodejs/node/issues/8155), I recommend using at least 6.8 in Windows.

## Troubleshooting
* If something doesn't work, please try on the original Node debug adapter (`"type": "node"`) and this one, and file an issue for any regression.
* If there may be an issue with sourcemaps, try running with sourcemaps disabled and setting breakpoints in the generated script.
* Or try adding 'debugger' statements to ensure that the debugger pauses.
* Watch for error messages in the debug console or terminal. There may be bugs on Node's side and it could crash. It's most stable in Node v6.9 and v7. If Node seems to be crashing, you can launch with `"console": "integratedTerminal"` to watch for error messages that don't show up in the debug console.
* Set `"diagnosticLogging": true` or `"verboseDiagnosticLogging": true` in your launch config. The adapter will log its own diagnostic info to the console, and to a file in your temp directory, the path to which will be printed at the top of the console. This is useful in figuring out why breakpoints don't resolve, or why sourcemaps don't work properly, or anything else. This is often useful info to include when filing an issue on GitHub. Note that it will include paths and file names from your machine.

## When breakpoints don't bind (turn gray when debugging)
Typically this is because of an issue with sourcemaps. VS Code needs to be able to map the sources in your sourcemap file to the source files in your workspace.
* Ensure that `outFiles` is set correctly in your launch config, so that VS Code can find your scripts and its sourcemaps before they're loaded in Node. Example: `"outFiles": ["${workspaceFolder}/out/**/*.js"]`. (This may not be possible if your scripts are built in-memory or on demand.)
* Type `.scripts` into the Debug Console to see information about the scripts loaded in Node, and their sourcemaps. (Details below). Check the output for correctness.
* If the local paths of sources have been inferred incorrectly, you can correct it with the `sourceMapPathOverrides` option. See details below.
* You can set the `diagnosticLogging` or `verboseDiagnosticLogging` options to see the details of the sourcemap resolving process.

## The `.scripts` command
This feature is extremely useful for understanding how the extension maps files in your workspace to files running in Node. You can enter `.scripts` in the debug console to see a listing of all scripts loaded in the runtime, their sourcemap information, and how they are mapped to files on disk. The format is like this:

```
› <The exact URL for a script, reported by Node> (<The local path that has been inferred for this script, if applicable>)
    - <The exact source path from the sourcemap> (<The local path inferred for the source, using sourceMapPathOverrides if applicable>)
```

Example:
```
.scripts
› /Users/roblou/project/out/app.js
    - ../app.ts (/Users/roblou/project/app.ts)
```

## sourceMapPathOverrides
The `sourceMapPathOverrides` option lets you set a mapping of source paths from the sourcemap, to the locations of these sources on disk. Useful when the sourcemap isn't accurate or can't be fixed in the build process. The left hand side of the mapping is a pattern that can contain a wildcard, and will be tested against the `sourceRoot` + `sources` entry in the source map. If it matches, the source file will be resolved to the path on the right hand side, which should be an absolute path to the source file on disk. A couple mappings are applied by default, corresponding to the default configs for Webpack and Meteor -
```
"sourceMapPathOverrides": {
    "webpack:///./*":   "${cwd}/*", // Example: "webpack:///./src/app.js" -> "/users/me/project/src/app.js"
    "webpack:///*":     "*",        // Example: "webpack:///C:/project/app.ts" -> "C:/project/app.ts"
    "meteor://💻app/*": "${cwd}/*"  // Example: "meteor://💻app/main.ts" -> "c:/code/main.ts"
}
```
If you set `sourceMapPathOverrides` in your launch config, that will override these defaults. `${workspaceFolder}` and `${cwd}` can be used here. If you aren't sure what the left side should be, you can use the `.scripts` command (details below). You can also use the `diagnosticLogging`/`verboseDiagnosticLogging` options to see the contents of the sourcemap, or look at the paths of the sources in Chrome DevTools, or open your `.js.map` file and check the values manually.

## Skipping "library code"/"blackboxed scripts"
The `skipFiles` option allows you to specify an array of names of folders/files to skip when debugging. For example, if you set `"skipFiles": ["lib.js"]`, then you will skip any file named 'lib.js' when stepping through your code. You also won't break on exceptions thrown from 'lib.js'. This works the same as "blackboxing scripts" in Chrome DevTools. Note that this is just an experiment at the moment. The supported formats are:
  * The name of a file (like `lib.js`)
  * The name of a folder, under which to skip all scripts (like `node_modules`)
  * A path glob, to skip all scripts that match (like `node_modules/**/*.min.js`)

You can also skip a file at runtime by right clicking on the stack frame and selecting "Toggle skipping this file". This option only persists for the current debugging session. You can also use it to stop skipping a file that is skipped by the `skipFiles` option in your launch config.

When a file is skipped, it will be grayed out in the callstack.

## Contributing
Contributions are welcome, please see [CONTRIBUTING.txt](https://github.com/Microsoft/vscode-node-debug2/blob/master/CONTRIBUTING.txt).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](https://github.com/Microsoft/vscode-node-debug2/blob/master/mailto:opencode@microsoft.com) with any additional questions or comments.

## License
[MIT](https://github.com/Microsoft/vscode-node-debug2/blob/master/LICENSE.txt)
