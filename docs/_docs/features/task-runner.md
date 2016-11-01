---
pageid: feature-task-runner
title: Task Runner
layout: docs
permalink: /docs/features/task-runner/
---

Nuclide provides the Task Runner toolbar for building, running, testing, and debugging projects.


* TOC
{:toc}

## Buck

Nuclide supports the [Build](#build), [Run](#run), [Test](#test), and [Debug](#debug) workflows for [Buck](/docs/features/buck), matching the corresponding Buck command-line tasks.

### Build

The Build task invokes [`buck build`](https://buckbuild.com/command/build.html),
displaying build output in the [Console](/docs/features/debugger/#basics__evaluation) below the [Editing Area](/docs/editor/basics/#editing-area).

In the Task Runner toolbar's text box, type in the name of the build target exactly
as you would specify on the command-line, i.e., `//path/to/dir:target_name#flavor`.

Note that the usual leading `//` is optional.

<img src="/static/images/docs/feature-task-runner-buck-build.png" />

Clicking on the Settings button (i.e., the gear icon) opens a dialog where you can provide extra flags to Buck.

<img src="/static/images/docs/feature-task-runner-buck-build-settings.png" width="625" />

Upon clicking **Build**, build progress displays via a blue progress bar below the toolbar and also periodically via messages in the [Console](/docs/features/debugger/#basics__evaluation).

Click the Stop button (i.e., the square icon) at any time to cancel an ongoing build.

<img src="/static/images/docs/feature-task-runer-buck-build-console.png" />

In addition to showing up in the [Console](/docs/features/debugger/#basics__evaluation), C++ compilation errors will surface in the [Diagnostics Table](/docs/editor/basics/#code-diagnostics).  Buck diagnostics will be cleared upon triggering a new build.

<img src="/static/images/docs/feature-task-runner-buck-build-diagnostics.png" />

### Run

The Run task is only enabled for iOS and Android application targets ([`apple_bundle`](https://buckbuild.com/rule/android_binary.html), [`android_binary`](https://buckbuild.com/rule/android_binary.html), and [`apk_genrule`](https://buckbuild.com/rule/apk_genrule.html) rules). It invokes [`buck install --run`](https://buckbuild.com/command/install.html) and builds, installs, then runs the app. Build output will be reported as documented in the [Build workflow](#build) section above.

<img src="/static/images/docs/feature-task-runner-buck-run.png" />

The iOS simulator type can be explicitly selected via the drop-down menu to the right of the toolbar's Settings button.

The **React Native Server Mode** checkbox optionally starts the React Native packager
and debugging server while the app installs.

### Test

The Test task invokes [`buck test`](https://buckbuild.com/command/test.html), building and running valid test targets (e.g., `cxx_test`).
Build output will be reported as documented in the [Build workflow](#build) section above.

### Debug

The Debug task is only enabled for the following target types:

- iOS applications (`apple_bundle`)
- C++ unit tests (`cxx_test`)
- C++ binaries (`cxx_binary`)

The [LLDB debugger](/docs/languages/cpp/#debugging) is invoked after a successful build in all three cases, but with slight variations.

*iOS Applications*

For iOS applications, the Debug task invokes [`buck install --run --wait-for-debugger`](https://buckbuild.com/command/install.html), then attaches LLDB to the simulator process once the app starts.

As with the Run task, the iOS simulator type can be selected from the drop-down menu to the right of the toolbar's Settings button.  The `React Native Server Mode` checkbox must be selected for React Native apps to enable JavaScript debugging.

*C++ unit tests*

For C++ unit tests, LLDB is launched against the unit test binary with the `args` and `env` parameters [specified by the `cxx_test` target](https://buckbuild.com/rule/cxx_test.html) after a successful `buck build`.

*C++ binaries*

For C++ binaries, LLDB is launched directly against the output binary after a successful `buck build`.  Extra launch arguments can be specified using the Settings button.

<img src="/static/images/docs/feature-task-runner-buck-debug.png" width="564" />

## Swift

The Task Runner toolbar can build [Swift](/docs/languages/swift) packages and run their tests.

### Building a Swift package

1. Click the **Toggle Task Runner Toolbar** button on the [Nuclide toolbar](/docs/features/toolbar/#buttons) (or use the [Command Palette](/docs/editor/basics/#command-palette) to issue the **Nuclide Task Runner: Toggle Swift Toolbar** command) to display options for building a Swift package.<br /><br />
![](/static/images/docs/feature-task-runner-swift-build-toolbar.png)

2. Select **Build** from the Swift Task drop-down menu.
3. Enter the path to a Swift package's root directory, then click the **Build** button to build the package. (This path is entered automatically if your project root is set to
a Swift package root.) Build output is displayed in the [Console](/docs/features/debugger/#basics__evaluation) below the [Editing Area](/docs/editor/basics/#editing-area).

![](/static/images/docs/feature-task-runner-swift-build-output.png)

You can customize build settings, such as whether to build the package in a *Debug* or *Release* configuration, by clicking the Settings button (i.e., the gear icon) to the right
of the toolbar's text box.

![](/static/images/docs/feature-task-runner-swift-build-settings.png)

### Running a Swift package's tests

1. Select **Test** from the Swift Task drop-down menu to display options for running a Swift package's tests.<br /><br />
![](/static/images/docs/feature-task-runner-swift-test-toolbar.png)

2. Enter the path to a Swift package's root directory, then click the **Test** button to run the package's tests. (This path is entered automatically if your project root is set
to a Swift package root.) Test output is displayed in the [Console](/docs/features/debugger/#basics__evaluation) below the [Editing Area](/docs/editor/basics/#editing-area).

![](/static/images/docs/feature-task-runner-swift-test-output.png)

Clicking the Settings button (i.e., the gear icon) to the right of the toolbar's text box displays additional settings for running your Swift package's tests.

## HHVM Debug Toolbar

Nuclide provides an HHVM toolbar in the Task Runner for debugging [Hack](/docs/languages/hack) projects. You can launch the toolbar by clicking the **Toggle Task Runner Toolbar** button in the [Nuclide toolbar](/docs/features/toolbar/#buttons) or from the [Command Palette](/docs/editor/basics/#command-palette) with `Nuclide Task Runner: Toggle HHVM Toolbar`.

![](/static/images/docs/feature-task-runner-hack-toolbar.png)

> You must have a Hack or PHP file open to successfully launch the toolbar.

You can choose either **Attach to WebServer** or **Launch Script** from the drop-down menu.  If you select **Attach to WebServer**, the text box will fill automatically with the server to which you are connected.  If you select **Launch Script**, the text box will fill automatically with the path of the open file.

<img src="/static/images/docs/feature-task-runner-hack-selection.png" align="middle" style="width: 500px;"/>

Set [breakpoints](/docs/features/debugger/#basics__breakpoints) in your code.

Click the **Debug** button to open the Debugger; it will stop at the first breakpoint.

You can then follow the [basic Debugger information](/docs/features/debugger/#basics) and use the additional features of the [Console](/docs/languages/hack/#debugging__console), [Evaluation](/docs/languages/hack/#debugging__evaluation), [Filtering](/docs/languages/hack/#debugging__filtering) and [other HHVM-specific debugging settings]( /docs/languages/hack/#debugging__other-settings) to debug your code.

![](/static/images/docs/feature-task-runner-hhvm-debug.png)

In both the script and server launching/attaching scenarios, the line at which you've set a
breakpoint will highlight in blue when the breakpoint is hit. When this happens, execution of your
code is paused and you can use the Debugger Controls to step, evaluate expressions, inspect the current
call stack, etc.
