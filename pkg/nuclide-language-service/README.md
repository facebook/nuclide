# Nuclide Language Service

This package provides `AtomLanguageService` which makes it easy to add new language integrations to
Nuclide including:

- auto complete
- goto definition(aka hyperclick)
- diagnostic errors and warnings
- outline view
- type coverage
- type hints
- automatic code preview (via context view)
- find references
- code formatting
- messages from the language service to be shown in the UI
- debugger expression evaluation

## Overview

Nuclide's language services are designed to provide rich language integration for both local files
as well as for remote files. Enabling remote editing impacts the design of Nuclide's language services.

When connected to a remote server, there are 2 processes: the Atom process which includes all the UI
running locally, and the NuclideServer process running on the remote machine. The Atom process
communicates with the NuclideServer process via the `nuclide-rpc` protocol. Note that the Atom
process contains an instance of the NuclideServer which handles local requests. In this way the
Atom/NuclideServer design handles both local and remote requests.

The `AtomLanguageService` class implements all of the code in the Atom process for integrating a new
language into the Atom UI.

* For places where Atom calls into the language (e.g. to obtain the go-to destination
  for the current caret position), Atom communicates to the NuclideServer via the
  `LanguageService` interface.

  * Some languages need per-project persistent state, e.g. because they delegate to some
    out-of-process language server. In these cases the `LanguageService` interface on the server
    is implemented by `MultiProjectLanguageService`. It's job is to lazily create
    subsidiary `LanguageService` instances on the server, one per project directory,
    and delegate all requests it receives to the appropriate project.

  * Other languages don't need per-project persistent state. For these, the `LanguageService`
    interface on the server is typically implemented by the `ServerLanguageService` class.
    The `ServerLanguageService` then defers to an implementation of the `SingleFileLanguageService`
    interface which implements the language specific analysis.

* For places where the language services call into Atom (e.g. to display a message to the console log,
  or display busy status), Atom offers them a `HostServices` interface.

  * Whenever the language service needs to multiplex (e.g. because two languages want to
    display their busy status), it *forks* the `HostServices`. It gets its own private
    fork of `HostServices`, which it must dispose of when done. A given `HostService`
    instance knows how to aggregate reports from all of its children. Aggregation is done
    locally where the fork was performed, either on the server or on the client.

* Sometimes it's ambiguous which direction a call should go:
  whether the language should into the Atom to display something
  using `HostServices`, or Atom should call into the language to obtain an `Observable`
  stream of things to display using `LanguageServices`. The simple answer is this:
  if the language can hold off its work until such time as the Atom has asynchronously
  subscribed to the observable, then `LanguageServices` and `HostServices` are equally
  good; if the language can't hold off, then `HostServices` is best because it allows
  the most laziness; if the language needs a response from Atom, then `HostServices`
  is the only possibility.

TODO: Add Picture

Creating a new language service requires defining 2 packages:
- Adding a new remote package which implements the `LanguageService` interface.
  The simplest implementation can be provided by `ServerLanguageService` which defers to a `SingleFileLanguageService` for each new remote `ServerConnection`. This has some limitations
  in fidelity and performance but is easier to implement. More sophisticated providers
  can implement the `LanguageService` interface directly.
- Adding a new package to Nuclide which creates an instance of `AtomLanguageService` during activation,
  and creates instances of the `LanguageService` defined in the remote package.

## Implementing the `SingleFileLanguageService` Interface

Add a new npm package to the `pkg` directory named `nuclide-<new-language>-rpc`.
The `-rpc` suffix indicates that the package runs on the server.

Add an implementation of the `SingleFileLanguageService` interface to your new package.
The `SingleFileLanguageService` interface is a low level API for providing language analysis.
The API contains methods for all of the available Nuclide language services.
Likely your language service will not provide every service. For services that
are unavailable for your language just provide an implementation which throws an exception.

#### `stripped-text-buffer`

Note that these `TextBuffer` objects in the NuclideServer process are stripped down from the full
Atom versions. They cannot save/load from disk, or use the marker portions of the TextBuffer API.
The source for the stripped TextBuffer is in the `simple-text-buffer` npm package if you need details.

TODO: Add StrippedTextBuffer type annotation once we have property variance from flow.

### An Example `SingleFileLanguageService` API implementation

Let's take a look at an example API and what a typical implementation might look like. We'll use the

```js
getDefinition(
  filePath: NuclideUri,
  buffer: atom$TextBuffer,
  position: atom$Point,
): Promise<?DefinitionQueryResult>,
```

API in our example. A typical implementation might look like:

```js
async getDefinition(
  filePath: NuclideUri,
  buffer: atom$TextBuffer,
  position: atom$Point,
): Promise<?DefinitionQueryResult> {
  const contents = buffer.getText();

  // Call the external language analysis process ...
  const result: ?Array<HackDefinition> = (await callHHClient(
    /* args */ ['--ide-get-definition', formatAtomLineColumn(position)],
    /* errorStream */ false,
    /* processInput */ contents,
    /* cwd */ filePath,
  ): any);
  if (result == null) {
    return null;
  }

  // Convert the result to Nuclide format
  return convertDefinitions(result);
}
```

If you cannot provide a given service for your language, just have the implementation
throw an Error:

```js
getCoverage(
  filePath: NuclideUri,
  buffer: atom$TextBuffer,
): Promise<?CoverageResult> {
  throw new Error('No type coverage information available');
}
```

Methods in your `SingleFileLanguageService` will only be called if the feature is enabled in the config
provided to your `AtomLanguageService`, so these unimplemented methods will not be called.

## Adding Your Server package to the Nuclide Server

Once you have an implementation of the `SingleFileLanguageService` interface in your new package, add it to the
nuclide server's set of RPC services:

- Add an entry in `pkg/nuclide-server/services-3.json` for your new package.
  - The implementation entry is the path to your `LanguageService` implementation.
  - Assign your package a unique service name. Typically: `<my-language>Service`

## Enabling Your New Language in Nuclide

Once you have the `SingleFileLanguageService` interface implemented for your new language create an Atom
package for your language named `nuclide-<my-language>`. In the package's `activate` method
create a new instance of the `AtomLanguageService` for your new language. Creating an `AtomLanguageService`
requires 2 things: a factory for your `LanguageService` implementation and an `AtomLanguageServiceConfig`
which indicates which services your new language supports.

A simplified version of your Atom package might look like:

```js
import type {ServerConnection} from '../../nuclide-remote-connection';
import typeof * as MyRemoteLanguageService from '../../nuclide-my-language-rpc';

import {getServiceByConnection} from '../../nuclide-remote-connection';
import {AtomLanguageService} from '../../nuclide-language-service';

let languageService = null;

async function languageServiceFactory(connection: ?ServerConnection): Promise<LanguageService> {
  const remoteService: MyRemoteLanguageService = getServiceByConnection('MyLanguageService', connection);

    // Get the connection specific FileCache ...
    const fileNotifier = await getNotifierByConnection(connection);

    // Create the remote LanguageService
    return remoteService.initialize(
      fileNotifier,
      config);
}

export function activate() {
  languageService = new AtomLanguageService(
    languageServiceFactory,
    {
      name: 'MyLanguage',
      grammars: ['source.mylanguage'],
      outlines: {
        version: '0.0.0',
        priority: 1,
      },
      definition: {
        version: '0.0.0',
        priority: 20,
      },
    });
}

export function deactivate(): void {
  languageService.dispose();
  languageService = null;
}
```

And the nuclide-my-language-rpc implementation would be:

```js
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import {ServerLanguageService} from '../../nuclide-language-service-rpc';

export async function initialize(
  fileNotifier: FileNotifier,
  config: MyLanguageConfig,
): Promise<LanguageService> {
  return new ServerLanguageService(fileNotifier, new MyLanguageService(config));
}

class MyLanguageService {
  constructor(config: MyLanguageConfig) { ... }

  // Implementation of the SingleFileLanguageService interface goes here
  // ...
}
```

## Implementing the `LanguageService` Interface Directly

The `ServerLanguageService` is easy to implement but it has some limitations in fidelity and performance. More sophisticated providers can implement the `LanguageService` interface directly.

TODO: Finish writing this section...


## Supporting Multiple Connections

A single NuclideServer process can be connected to multiple Atom processes. A new Atom process
is created for each top level Atom window.
In the example code above, each connected Atom process will call `initialize` and create their own
`MyLanguageService` instance.

Each Atom process could open and edit the same file. Your language service could receive requests
for language services for the same file with wildly different content from 2 connections.

## Tracking Multiple Opened Files with Observable File Events

The `FileVersion` abstraction makes it easy to get the text for the file containing the request.
However, the user may have multiple files open and edited at a given time. The language service
analysis should reflect all of the edits in all open files.

Each connected Atom process creates a `FileCache` in the NuclideServer which tracks the current
state of all open files in the corresponding Atom process. Changes to files can be tracked via
the `observeFileEvents()` method on the `FileCache` instance.

The `FileCache` for a given connection can be retrieved on the Atom process with the `getNotifierByConnection()`
call. Its a good idea to pass this into your initialization function.

So your `languageServiceFactory` becomes:

```js
async function languageServiceFactory(connection: ?ServerConnection): Promise<LanguageService> {
  const remoteService: MyRemoteLanguageService = getServiceByConnection('MyLanguageService', connection);

  // Get my custom configuration, from atom's config object
  const config = getConfig();

  // Get the connection specific FileCache ...
  const fileNotifier = await getNotifierByConnection(connection);

  // Create the remote LanguageService
  return remoteService.initialize(
    fileNotifier,
    config);
}
```

And your initialization becomes:

```js
export async function initialize(
  fileNotifier: FileNotifier,
  config: MyLanguageConfig,
): Promise<LanguageService> {
  // The fileNotifier from Atom is always an instance of FileCache.
  invariant(fileNotifier instanceof FileCache);
  const fileCache = (fileNotifier: FileCache);
  return new ServerLanguageService(fileNotifier, new MyLanguageService(
    fileCache,
    config));
}

export class MyLanguageService {
  constructor(fileCache: FileCache, config: MyLanguageConfig) { ... }

  // Implementation of the SingleFileLanguageService interface goes here
  // ...
}
```

## Observable Diagnostics

Observable diagnostics allows Nuclide to publish diagnostics as soon as the language analyzer can produce them.

To implement push based diagnostics, implement the `observeDiagnostics` member of the `LanguageService` or `SingleFileLanguageService` interfaces. The main steps include:
- watch for open projects on a given Atom connection
- manage connections to your language analyzer processes for each open process
- subscribe to diagnostics for each connected process
- aggregating and invalidating the diagnostics for the connected processes

### Projects

A project consists of a set of source files which must be analyzed as a unit to produce consistent and complete results. For example, a Hack project is identified by a file named `.hhconfig`. The directory containing a `.hhconfig` file called the project directory. All `.php` and `.hh` files in subdirectores of the project directory are part of the project.

Whenever a `.php` file in a given project directory is opened in Nuclide,
or a directory containing a `.hhconfig` file is added to the file tree, that
project is considered to be open.

The `ConfigObserver` class in the nuclide-open-files-rpc package provides
an Observable of open projects for a given language.

### Analyzer Processes

An analyzer process provides diagnostics(and possibly other language analysis services) for a single project.

Each time a project is opened in Nuclide, an analyzer process for that project
is started. When a project is closed in Atom the corresponding analyzer process is shut down.

TODO: Process lifetime is currently handled by the `processes`,
`ensureProcess`, `observeConnections` in HackProcess.js. These
should be abstracted into a reusable Language agnostic API.

One additional complexity is that a given project may be opened
by multiple Atom windows simultaneously. A LanguageService must choose between
starting a new analyzer process per connected Atom window; or having one analyzer
process per project which is then synchronized to the active Atom window making
requests.

Each connected Atom window is tracked via a FileCache (which implements the FileNotifier interface).

NOTE: Hack starts a new process when a new Atom window opens a
project already open in another window. The process connected to
the other window is closed (by Hack) and the new process subsumes
ownership of the underlying hack server process. When the previous
Atom window makes a request on that project it starts another
connection process (closing the one started by the other window)
and resynchronizes its open files. It turns out the cost of
switching the hack server between the different Atom windows is
quite reasonable.

### Observing Diagnostics for an Analyzer Process

This will be language specific.

### Aggregating and Invalidating Diagnostics

Currently this occurs in `observeDiagnostics` in HackService.js.

TODO: Move this to a reusable component which maps Observable<Observable<FileDiagnosticMessages>> for each project to an Observable<FileDiagnosticMessages> which handles the invalidations and flattening.
