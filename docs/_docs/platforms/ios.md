---
pageid: platform-ios
title: iOS
layout: docs
permalink: /docs/platforms/ios/
---

Nuclide supports both native iOS development in [Objective-C](/docs/languages/objective-c) and
cross-platform development in [React Native](/docs/platforms/react-native).

> This section discusses primarily native iOS development since there is a whole separate section
> dedicated to [React Native](/docs/platforms/react-native).

<br/>

* TOC
{:toc}

## Features

When you open an [Objective-C](/docs/languages/objective-c/) file (e.g., `.h`, `.m`, `.mm`), you
automatically get support for default [features](/docs/languages/objective-c/#default-features) such
as [Automatic Square Bracket Completion](/docs/languages/objective-c/#default-features__automatic-square-bracket-completion).

However, if you compile your project with [Buck](http://buckbuild.com), you get richer
[features](/docs/languages/objective-c/#buck-enabled-features) such as
[Autocomplete](/docs/languages/objective-c/#buck-enabled-features__autocomplete) and
[Jump to Definition](/docs/languages/objective-c/#buck-enabled-features__jump-to-definition).

![](/static/images/docs/platform-ios-native-autocomplete.png)

## Running Applications

Currently, the easiest way to build and run a native iOS application is from Xcode itself.
You can also use the command-line tools such as `xcodebuild`, etc.

### Buck Integration

Nuclide supports the [Buck](https://buckbuild.com/) build system. See the
[Buck guide](/docs/features/buck) for how to build, run, and debug iOS apps.

## Debugging

Debugging native [Objective-C](/docs/languages/objective-c/) iOS applications is
[supported using Buck](/docs/features/buck/#debug).

## Simulator Logs

When running your iOS project in the iOS simulator, you can open and view the simulator logs
directly within Nuclide. From the [Command Palette](/docs/editor/basics/#command-palette), search
for `Nuclide iOS Simulator Logs: Start`.

![](/static/images/docs/platform-ios-toggle-simulator.png)

![](/static/images/docs/platform-ios-simulator-output.png)

> Currently, the logs are very verbose as they do not delineate between actual underlying simulator
> information with the actual running application.
