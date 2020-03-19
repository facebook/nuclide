---
pageid: platform-react-native
title: React Native
layout: docs
permalink: /docs/platforms/react-native/
---

Nuclide has built-in support for the [React Native](https://facebook.github.io/react-native/)
framework. React Native provides a set of components and extensions that allows you to easily write
native iOS and Android applications using the [Flow](/docs/languages/flow) and
[JavaScript](/docs/languages/other#javascript) programming languages and the
[React](http://facebook.github.io/react/) UI library.

* TOC
{:toc}

## Features

If your React Native apps are primarily written in [Flow](/docs/languages/flow), you get all of its
[features](/docs/languages/flow/#features) within Nuclide, including
[Autocomplete](/docs/languages/flow/#autocomplete),
[Code Diagnostics](/docs/languages/flow/#features__code-diagnostics), etc.

![](/static/images/docs/platform-react-native-feature-autocomplete.png)

> [JavaScript](/docs/languages/other/#javascript) works well with Nuclide as well.

> You can also write [native iOS (Objective-C)](/docs/platforms/ios) code with React Native, and get
> features such as [Automatic Square Bracket Completion](/docs/languages/objective-c/#default-features__automatic-square-bracket-completion) from Nuclide when doing so. Native Android code written in conjunction with React Native has [minimal support](/docs/platforms/android).

## Running applications

All React Native features are currently available from the [Command Palette](/docs/editor/basics/#command-palette).

You run Metro from Nuclide and your application from the command line.

### Metro

From the [Command Palette](/docs/editor/basics/#command-palette), choose `Nuclide Metro: Start` to start Metro. The output in the `Console` panel indicates if Metro started or if it encountered any errors.

![](/static/images/docs/platform-react-native-start-packager.png)

The server runs on the default `port 8081`. You can stop and restart the server at anytime.

### Command Line

Ensure that you are in the root directory of the React Native project, then run the application from the command-line:

```bash
$ react-native run-ios
$ react-native run-android
```

This should bring up the Simulator with your running application inside.

## Support

Nuclide has support for [React Native](https://facebook.github.io/react-native/) for [iOS](/docs/platforms/ios).

From Nuclide, you can start a React Native development server, inspect React Native elements.

> In order to use React Native within Nuclide, you must
> [install](https://facebook.github.io/react-native/docs/getting-started.html) it.

### Loading a React Native Project

You open a React Native project the
[usual way](/docs/quick-start/getting-started/#adding-a-project). Nuclide will automatically
establish that you have a React Native project by seeing the `node_modules/react-native` directory
from the root of your project.

### Metro

[Launch Metro from within Nuclide](#running-applications__metro).

### Run the React Native Application

[Start your React Native application from the command-line](#running-applications__command-line).

### Element Inspector

Nuclide provides an Element Inspector, where you can view and toggle properties of your application.

From the [Command Palette](/docs/editor/basics/#command-palette), choose `Nuclide React Inspector: Show` to open the **React Inspector** tab in the
main [Editing Area](/docs/editor/basics/#editing-area).

![](/static/images/docs/platform-react-native-element-inspector.png)

To see the actual elements highlighted in the Nuclide Element Inspector also highlighted in the
Simulator, you must enable the Simulator Inspector as well. Press `Cmd-D` (`Ctrl-D` on Linux) within
the Simulator and choose **Show Inspector**.

![](/static/images/docs/platform-react-native-show-inspector.png)

## Simulator Logs

Nuclide supports the [iOS Simulator logs](/docs/platforms/ios#simulator-logs) and
[Android Emulator logs](/docs/platforms/android#emulator-logs) directly within Nuclide.

## Debugging

Nuclide's new React Native debugger support is ported from
[vscode-react-native](https://github.com/Microsoft/vscode-react-native) at
version 0.5.7 ([fork source](https://github.com/pelmers/vscode-react-native/tree/nuclide)).
There are two ways to invoke the React Native debugger. Nuclide can either attach to
a running packager, or it can launch the debug target in a new packager for
debugging. Note that the debugger from Nuclide can only attach if the default
Chrome debugger is not already running.

Both cases require a workspace path which should be set to the directory
containing the `package.json` file of the debug target. Launching the debugger
also requires specifying the platform to debug, either `ios` or `android` as
well as the target, either `simulator` or `device`. Note that debugging on an
iOS device requires some manual setup; see
[these instructions](https://github.com/Microsoft/vscode-react-native/blob/master/doc/debugging.md#debugging-on-ios-device).
In most cases the default port setting of 8081 will be correct.

> Changing the port setting in the debugger may require external setup, see
> [the issue on GitHub](https://github.com/facebook/react-native/issues/9145)

![](/static/images/docs/platform-react-native-debugger-ex.png)

> A DeprecationWarning: 'root' is deprecated error may appear when the program
> first runs, which can be safely dismissed.
