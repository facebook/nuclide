# atom-ide-diagnostics

## Overview

`atom-ide-diagnostics` is responsible for consuming diagnostics from providers and sending
updates to a UI provider.
[`atom-ide-diagnostics-ui`](https://github.com/facebook/nuclide/tree/master/modules/atom-ide-ui/pkg/atom-ide-diagnostics-ui)
is our UI implementation.

We consume two APIs: Our own provider API, described below, and the
[`linter`](https://atom.io/packages/linter) [package
APIs](http://steelbrain.me/linter) (with some extensions).

The Nuclide API is designed to support a "push" model where providers notify the store
asynchronously about new diagnostics (and when to invalidate old ones). A provider may choose to
publish diagnostics in response to file change events from a `TextEditor`, but it may also report
diagnostics in response to other events, such as file changes that occur outside of Atom.

For simple pull-based use cases (linting on save), we recommend just using the Standard Linter API.

## Provider API

### API Overview

The Flow types that describe a provider are available in
[`main.js`](https://github.com/facebook/nuclide/blob/master/modules/atom-ide-ui/pkg/atom-ide-diagnostics/lib/main.js).
A `DiagnosticProvider`, in particular, is simply an object that allows a consumer to register for
two events:

```js
type DiagnosticProvider = {
  onMessageUpdate: (callback: MessageUpdateCallback) => Disposable;
  onMessageInvalidation: (callback: MessageInvalidationCallback) => Disposable;
};
```

Where the callbacks are:

```js
type MessageUpdateCallback = (update: DiagnosticProviderUpdate) => mixed;
type MessageInvalidationCallback = (message: InvalidationMessage) => mixed;
```

And the messages themselves are:

```js
type DiagnosticProviderUpdate = {
  filePathToMessages?: Map<string, Array<FileDiagnosticMessage>>;
  projectMessages?: Array<ProjectDiagnosticMessage>;
};

type FileDiagnosticMessage = {
  scope: 'file';
  providerName: string;
  type: MessageType;
  filePath: string;
  text?: string;
  html?: string;
  range?: Range;
  trace?: Array<Trace>;
};

type ProjectDiagnosticMessage = {
  scope: 'project';
  providerName: string;
  type: MessageType;
  text?: string;
  html?: string;
  range?: Range;
  trace?: Array<Trace>;
};

type Trace = {
  type: 'Trace';
  text?: string;
  html?: string;
  filePath: string;
  range?: Range;
};

type InvalidationMessage = {
  scope: 'file';
  filePaths: Array<string>;
} | {
  scope: 'project';
} | {
  scope: 'all';
};
```

Note that when an update is sent, any file names that are keys in `filePathToMessages` implicitly
have their previous messages invalidated. This means that simple providers that act only on the
currently active file need not ever send an invalidation message.

## Linter API

`atom-ide-diagnostics` is compatible with the following APIs for the [`linter`](https://atom.io/packages/linter) package.
- [Standard Linter v1 API](https://github.com/steelbrain/linter/blob/v1/docs/types/standard-linter-v1.md)
- [Standard Linter v2 API](https://github.com/steelbrain/linter/blob/master/docs/types/standard-linter-v2.md)
- [Indie (push-based) Linter v2 API](https://github.com/steelbrain/linter/blob/master/docs/types/indie-linter-v2.md)

Note that a few v2 message features are currently unimplemented:

- markdown rendering of `description`
- the `url` and `icon` fields
- multiple `solutions` (only the first one is used)
- callback-based `solutions`
- callback-based `description`
