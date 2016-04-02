---
id: platform-react-native
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
[autocomplete](/docs/languages/flow/#autocomplete),
[code diagnostics](/docs/languages/flow/#features__code-diagnostics), etc.

![](/static/images/docs/platform-react-native-feature-autocomplete.png)

> [JavaScript](/docs/languages/other/#javascript) works well with Nuclide as well.

> You can also write [native iOS (Objective-C)](/docs/platforms/ios) with React Native, and get
> features such as automatic bracket completion from Nuclide when doing so. Native Android code
> written in conjunction with React Native has [minimal support](/docs/platforms/android).

## Running applications

### Buck Integration

> Buck Integration currently only works with React Native iOS apps. If you have an Android app, you
> can still use the
> [command-line](/docs/platforms/react-native/#running-applications__command-line) to run your
> application.

If you have built your React Native *iOS* application with Buck, you may be able to utilize the
built-in Nuclide Buck integration to build and run your application.

Bring up the [Buck build toolbar](/docs/features/toolbar/#buttons) from the Nuclide
[toolbar](/docs/features/toolbar/) or go to the command palette and serach for
`Nuclide Buck Toolbar: Toggle`.

![](/static/images/docs/platform-react-native-running-buck-toolbar.png)

In the Buck toolbar, enter a build target that you specified in your `.buckconfig` file. Nuclide
will search for targets for you and populate a list; autocomplete of your targets will occur as
you type.

After you enter a valid target, the `React Native Server Mode` checkbox will appear, allowing you,
when checked, to start the the React Native Server (i.e., Packager) when you run or debug your
application.

> There is currently a bug as to where you must have a project file open in order for the
> `React Native Server Mode` checkbox to appear.

Now you can click on `Build`, `Run` or `Debug`. `Build` will compile your Buck application.
`Run` will run your Buck application. And `Debug` will bring up the
[React Native debugger](/docs/features/debugger/#react-native).

If you had checked the `React Native Server Mode` box, the React Native Server will also appear
after pressing `Run` or `Debug`.

![](/static/images/docs/platform-react-native-running-server.png)

### Command-Line

If you are not using [Buck](#running-applications__buck-integration), you can still run your React
Native application during development. You run the React Native Packager and Server from Nuclide and
your application from the command line.

From the [command palette](/docs/editor/basics/#command-palette), choose
`Nuclide React Native: Start Packager`

![](/static/images/docs/platform-react-native-running-server-command.png)

This will bring up the React Native server.

Then at the command-line:

```bash
$ react-native run-ios
$ react-native run-android
```

## Debugging

[React Native](https://facebook.github.io/react-native/) for [iOS](/docs/platforms/ios) has
first-class support within Nuclide. The debugger is no exception.

> Debugging React Native for Android is currently not supported except for the
> [simulator logs](#simulator-logs).

From Nuclide, you can start a React Native development server, inspect React Native elements and
use the [debugger](/docs/features/debugger#basics) to set and stop on breakpoints, etc.

> In order to use React Native within Nuclide, you must
> [install](https://facebook.github.io/react-native/docs/getting-started.html) it.

### Loading a React Native Project

You open a React Native project the
[usual way](/docs/quick-start/getting-started/#adding-a-project). Nuclide will automatically
establish that you have a React Native project by seeing the `node_modules/react-native` directory
from the root of your project.

### Command Palette

All React Native features are currently available from the
[command palette](/docs/editor/basics/#command-palette).

![](/static/images/docs/feature-debugger-languages-react-native-command-palette.png)

### React Native Server

The first step to debugging React Native is to launch the React Native Server from within Nuclide.
Using the [command palette](/docs/editor/basics/#command-palette), launch
`Nuclide React Native: Start Packager`. This will bring up a tab in the
[main editing](/docs/editor/basics/#editing-area) area titled "React Native Server".

![](/static/images/docs/feature-debugger-languages-react-native-server.png)

Notice that the server is running on the default port `8081`. You can stop and restart the server
at anytime.

### Prime the Debugger

After starting the server, you can prime the React Native debugger for when the application begins
running. From the [command palette](/docs/editor/basics/#command-palette), launch
`Nuclide React Native: Start Debugging`.

You might see that the Nuclide debugger will not load yet; instead showing you a waiting condition.

![](/static/images/docs/feature-debugger-languages-react-native-debugger-priming.png)

This means that the debugger is waiting to attach to the actually running process of the React
Native application.

### Run the React Native Application

Start the React Native Application. If running from the command-line, ensure that you are in the
root directory of the React Native project.

Here is an example of how you might run the Application

```bash
$ react-native run-ios
```

This should bring up the simulator with your running application inside.

### Enable Debugging from the Application

From the simulator, you will want to enable debugging the application. Press `cmd-D` (`ctrl-D` on
Linux). This will bring up the debug options for your application. Choose `Debug in Chrome`.

![](/static/images/docs/feature-debugger-languages-react-native-application-debug-options.png)

> `Debug in Chrome` in this case is a bit of a misnomer since you will actually be debugging
> through the Nuclide debugger (based on Chrome Dev Tools).

> If you have enabled debugging in a previous session, then debugging will still be enabled; thus,
> this step will not be necessary.

### Start Debugging

After you enable debugging from the simulated application, Nuclide will attach to that debugging
process automatically, since we primed the debugger above. You can now set breakpoints, watches,
etc.

> You can set breakpoints, watches, etc. earlier than this step, but access to them will not be
> available until the debugging has been enabled.

> In order to actually break into debug mode, you may have to click the resume execution button
> (![](/static/images/docs/feature-debugger-languages-react-native-debugger-resume.png)) one time.
> If, when the debugger appears, you are
> paused (![](/static/images/docs/feature-debugger-languages-react-native-debugger-pause.png)),
> click the button and debugging should begin.

Now you can start debugging your React Native application as
[normal](/docs/features/debugger#basics).

![](/static/images/docs/feature-debugger-languages-react-native-debugging.png)

### Element Inspector

The React Native debugger in Nuclide also provides an Element Inspector, where you can view and
toggle properties of your application.

From the [command palette](/docs/editor/basics/#command-palette), choose
`Nuclide React Native Inspector: Show`. This will bring up a tab in the
[main editing](/docs/editor/basics/#editing-area) area titled "React Native Inspector".

![](/static/images/docs/feature-debugger-languages-react-native-element-inspector.png)

To see the actual elements highlighted in the Nuclide element inspector also highlighted in the
simulator, you must enable the simulator inspctor as well. Press `cmd-D` (`ctrl-D on Linux`) within
the simulator and choose `Show Inspector`.

![](/static/images/docs/feature-debugger-languages-react-native-application-show-inspector.png)

## Simulator Logs

Nuclide supports the [iOS emulator logs](/docs/platforms/ios#simulator-logs) and
[Android emulator logs](/docs/platforms/android#emulator-logs) directly within Nuclide.
