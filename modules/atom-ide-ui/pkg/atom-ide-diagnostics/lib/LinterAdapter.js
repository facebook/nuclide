/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import type {
  DiagnosticMessage,
  LinterMessage,
  LinterMessageV1,
  LinterMessageV2,
  LinterProvider,
} from '..';
import type {
  DiagnosticProviderUpdate,
  InvalidationMessage,
  FileDiagnosticMessage,
  ProjectDiagnosticMessage,
} from './rpc-types';

import {Point, Range} from 'atom';
import {Observable, Subject} from 'rxjs';
import {observeTextEditorEvents} from 'nuclide-commons-atom/text-event';
import {getLogger} from 'log4js';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// Exported for testing.
export function linterMessageToDiagnosticMessage(
  msg: LinterMessageV1,
  providerName: string,
): DiagnosticMessage {
  // The types are slightly different, so we need to copy to make Flow happy. Basically, a Trace
  // does not need a filePath property, but a LinterTrace does. Trace is a subtype of LinterTrace,
  // so copying works but aliasing does not. For a detailed explanation see
  // https://github.com/facebook/flow/issues/908
  const trace = msg.trace
    ? msg.trace.map(component => ({...component}))
    : undefined;
  if (msg.filePath) {
    const {fix} = msg;
    return ({
      scope: 'file',
      providerName: msg.name != null ? msg.name : providerName,
      type: msg.type,
      filePath: msg.filePath,
      text: msg.text,
      html: msg.html,
      range: msg.range && Range.fromObject(msg.range),
      trace,
      fix: fix == null
        ? undefined
        : {
            oldRange: Range.fromObject(fix.range),
            oldText: fix.oldText,
            newText: fix.newText,
          },
    }: FileDiagnosticMessage);
  } else {
    return ({
      scope: 'project',
      providerName: msg.name != null ? msg.name : providerName,
      type: msg.type,
      text: msg.text,
      html: msg.html,
      range: msg.range && Range.fromObject(msg.range),
      trace,
    }: ProjectDiagnosticMessage);
  }
}

const LinterSeverityMap = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

// Version 2 only handles file-level diagnostics.
export function linterMessageV2ToDiagnosticMessage(
  msg: LinterMessageV2,
  providerName: string,
): FileDiagnosticMessage {
  let trace;
  if (msg.trace != null) {
    trace = msg.trace.map(component => ({...component}));
  } else if (msg.reference != null) {
    const point = msg.reference.position != null
      ? Point.fromObject(msg.reference.position)
      : null;
    trace = [
      {
        type: 'Trace',
        filePath: msg.reference.file,
        range: point ? new Range(point, point) : undefined,
      },
    ];
  }
  // TODO: handle multiple solutions and priority.
  let fix;
  const {solutions} = msg;
  if (solutions != null) {
    const solution = solutions[0];
    if (solution.replaceWith !== undefined) {
      fix = {
        oldRange: Range.fromObject(solution.position),
        oldText: solution.currentText,
        newText: solution.replaceWith,
        title: solution.title,
      };
    }
    // TODO: support the callback version.
  }
  let text = msg.excerpt;
  // TODO: use markdown + handle callback-based version.
  if (typeof msg.description === 'string') {
    text = text + '\n' + msg.description;
  }
  return {
    scope: 'file',
    providerName,
    type: LinterSeverityMap[msg.severity],
    filePath: msg.location.file,
    text,
    range: Range.fromObject(msg.location.position),
    trace,
    fix,
  };
}

export function linterMessagesToDiagnosticUpdate(
  currentPath: ?NuclideUri,
  msgs: Array<LinterMessage>,
  providerName: string,
): DiagnosticProviderUpdate {
  const filePathToMessages: Map<
    NuclideUri,
    Array<FileDiagnosticMessage>,
  > = new Map();
  if (currentPath) {
    // Make sure we invalidate the messages for the current path. We may want to
    // figure out which other paths we want to invalidate if it turns out that
    // linters regularly return messages for other files.
    filePathToMessages.set(currentPath, []);
  }
  const projectMessages = [];
  for (const msg of msgs) {
    const diagnosticMessage = msg.type === undefined
      ? linterMessageV2ToDiagnosticMessage(msg, providerName)
      : linterMessageToDiagnosticMessage(msg, providerName);
    if (diagnosticMessage.scope === 'file') {
      const path = diagnosticMessage.filePath;
      let messages = filePathToMessages.get(path);
      if (messages == null) {
        messages = [];
        filePathToMessages.set(path, messages);
      }
      messages.push(diagnosticMessage);
    } else {
      // Project scope.
      projectMessages.push(diagnosticMessage);
    }
  }
  return {
    filePathToMessages,
    projectMessages,
  };
}

/**
 * Provides an adapter between Atom linters (defined by the LinterProvider
 * type), and Nuclide Diagnostic Providers.
 *
 * The constructor takes a LinterProvider as an argument, and the resulting
 * LinterAdapter is a valid DiagnosticProvider.
 */
export class LinterAdapter {
  _provider: LinterProvider;
  _disposables: UniversalDisposable;

  _updates: Subject<DiagnosticProviderUpdate>;
  _invalidations: Subject<InvalidationMessage>;

  constructor(provider: LinterProvider) {
    this._provider = provider;
    this._updates = new Subject();
    this._invalidations = new Subject();
    this._disposables = new UniversalDisposable(
      observeTextEditorEvents(
        this._provider.grammarScopes[0] === '*'
          ? 'all'
          : this._provider.grammarScopes,
        this._provider.lintsOnChange || this._provider.lintOnFly
          ? 'changes'
          : 'saves',
      )
        // Group text editor events by their underlying text buffer.
        // Each grouped stream lasts until the buffer gets destroyed.
        .groupBy(
          editor => editor.getBuffer(),
          editor => editor,
          grouped =>
            // $FlowFixMe: add durationSelector to groupBy
            observableFromSubscribeFunction(cb =>
              // $FlowFixMe
              grouped.key.onDidDestroy(cb),
            ).take(1),
        )
        .mergeMap(bufferObservable =>
          // Run the linter on each buffer event.
          Observable.concat(
            bufferObservable,
            // When the buffer gets destroyed, immediately stop linting and invalidate.
            Observable.of(null),
          )
            // switchMap ensures that earlier lints are overridden by later ones.
            .switchMap(
              editor =>
                editor == null ? Observable.of(null) : this._runLint(editor),
            )
            // Track the previous update so we can invalidate its results.
            // (Prevents dangling diagnostics when a linter affects multiple files).
            .scan((acc, update) => ({update, lastUpdate: acc.update}), {
              update: null,
              lastUpdate: null,
            }),
        )
        .subscribe(({update, lastUpdate}) =>
          this._processUpdate(update, lastUpdate),
        ),
    );
  }

  _runLint(editor: TextEditor): Observable<DiagnosticProviderUpdate> {
    return Observable.defer(() => {
      const lintPromise = this._provider.lint(editor);
      if (lintPromise == null) {
        return Observable.empty();
      }
      return Promise.resolve(lintPromise).catch(error => {
        // Prevent errors from blowing up the entire stream.
        getLogger('atom-ide-diagnostics').error(
          `Error in linter provider ${this._provider.name}:`,
          error,
        );
        return null;
      });
    }).switchMap(linterMessages => {
      if (linterMessages == null) {
        return Observable.empty();
      }
      const update = linterMessagesToDiagnosticUpdate(
        editor.getPath(),
        linterMessages,
        this._provider.name,
      );
      return Observable.of(update);
    });
  }

  _processUpdate(
    update: ?DiagnosticProviderUpdate,
    lastUpdate: ?DiagnosticProviderUpdate,
  ): void {
    if (lastUpdate != null && lastUpdate.filePathToMessages != null) {
      this._invalidations.next({
        scope: 'file',
        filePaths: Array.from(lastUpdate.filePathToMessages.keys()),
      });
    }
    if (update != null) {
      this._updates.next(update);
    }
  }

  dispose(): void {
    this._disposables.dispose();
    this._updates.complete();
    this._invalidations.complete();
  }

  getUpdates(): Observable<DiagnosticProviderUpdate> {
    return this._updates.asObservable();
  }

  getInvalidations(): Observable<InvalidationMessage> {
    return this._invalidations.asObservable();
  }
}
