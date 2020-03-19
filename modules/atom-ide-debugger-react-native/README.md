# atom-ide-debugger-react-native

React Native Debugger for Atom IDE is ported from
[vscode-react-native](https://github.com/Microsoft/vscode-react-native) at
version 0.5.7 ([fork source](https://github.com/pelmers/vscode-react-native/tree/nuclide)).
There are two ways to invoke the React Native debugger. Either attach to
a running packager, or it can launch the debug target in a new packager for
debugging. Note that the debugger can only attach if the default
Chrome debugger is not already running.

Both cases require a workspace path which should be set to the directory
containing the `package.json` file of the debug target. Launching the debugger
also requires specifying the platform to debug, either `ios` or `android` as
well as the target, either `simulator` or `device`. Note that debugging on an
iOS device requires some manual setup; see
[these instructions](https://github.com/Microsoft/vscode-react-native/blob/master/doc/debugging.md#debugging-on-ios-device).
In most cases the default port setting of 8081 will be correct.

> NOTE: Changing the port setting in the debugger may require external setup, see
> [the issue on GitHub](https://github.com/facebook/react-native/issues/9145)

> NOTE: A DeprecationWarning: 'root' is deprecated error may appear when the program
> first runs, which can be safely dismissed.

## Usage

Run `apm install atom-ide-debugger-react-native` to install the Atom package.

## License

`atom-ide-debugger-react-native` is BSD-licensed. We also provide an additional patent grant.
