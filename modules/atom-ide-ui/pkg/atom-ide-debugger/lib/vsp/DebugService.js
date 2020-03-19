/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/**
The following debug service implementation was ported from VSCode's debugger implementation
in https://github.com/Microsoft/vscode/tree/master/src/vs/workbench/parts/debug

MIT License

Copyright (c) 2015 - present Microsoft Corporation

All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import type {ConsoleMessage} from 'atom-ide-ui';
import type {RecordToken, Level} from '../../../atom-ide-console/lib/types';
import type {
  TerminalInfo,
  TerminalInstance,
} from '../../../atom-ide-terminal/lib/types';
import type {
  DebuggerModeType,
  IDebugService,
  IModel,
  IViewModel,
  IProcess,
  IThread,
  IEnableable,
  IEvaluatableExpression,
  IUIBreakpoint,
  IStackFrame,
  SerializedState,
} from '../types';
import type {
  IProcessConfig,
  MessageProcessor,
  VSAdapterExecutableInfo,
} from 'nuclide-debugger-common';
import type {TimingTracker} from 'nuclide-commons/analytics';
import * as DebugProtocol from 'vscode-debugprotocol';
import * as React from 'react';

import invariant from 'assert';
import {Icon} from 'nuclide-commons-ui/Icon';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {sleep, serializeAsyncCall} from 'nuclide-commons/promise';
import {
  VsDebugSession,
  localToRemoteProcessor,
  remoteToLocalProcessor,
  getVSCodeDebuggerAdapterServiceByNuclideUri,
} from 'nuclide-debugger-common';
import {Observable, Subject, TimeoutError} from 'rxjs';
import {TextEditorBanner} from 'nuclide-commons-ui/TextEditorBanner';
import ReadOnlyNotice from 'nuclide-commons-ui/ReadOnlyNotice';
import {track, startTracking} from 'nuclide-commons/analytics';
import nullthrows from 'nullthrows';
import {
  getConsoleRegisterExecutor,
  getConsoleService,
  getNotificationService,
  getDatatipService,
  getTerminalService,
  resolveDebugConfiguration,
} from '../AtomServiceContainer';
import {evaluateExpressionAsStream, capitalize} from '../utils';
import {
  Model,
  ExceptionBreakpoint,
  FunctionBreakpoint,
  Breakpoint,
  Expression,
  Process,
  ExpressionContainer,
} from './DebuggerModel';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Emitter, TextBuffer} from 'atom';
import {distinct, mapFromObject} from 'nuclide-commons/collection';
import {onUnexpectedError} from '../utils';
import uuid from 'uuid';
import {
  BreakpointEventReasons,
  DebuggerMode,
  AnalyticsEvents,
  DEBUG_SOURCES_URI,
} from '../constants';
import logger from '../logger';
import stripAnsi from 'strip-ansi';
import url from 'url';
import os from 'os';
import idx from 'idx';

const CONSOLE_VIEW_URI = 'atom://nuclide/console';

const CUSTOM_DEBUG_EVENT = 'CUSTOM_DEBUG_EVENT';
const CHANGE_DEBUG_MODE = 'CHANGE_DEBUG_MODE';
const START_DEBUG_SESSION = 'START_DEBUG_SESSION';
const ACTIVE_THREAD_CHANGED = 'ACTIVE_THREAD_CHANGED';

const DEBUGGER_FOCUS_CHANGED = 'DEBUGGER_FOCUS_CHANGED';
const CHANGE_EXPRESSION_CONTEXT = 'CHANGE_EXPRESSION_CONTEXT';

// Berakpoint events may arrive sooner than breakpoint responses.
const MAX_BREAKPOINT_EVENT_DELAY_MS = 5 * 1000;

class ViewModel implements IViewModel {
  _focusedProcess: ?IProcess;
  _focusedThread: ?IThread;
  _focusedStackFrame: ?IStackFrame;
  _emitter: Emitter;

  constructor() {
    this._focusedProcess = null;
    this._focusedThread = null;
    this._focusedStackFrame = null;
    this._emitter = new Emitter();
  }

  get focusedProcess(): ?IProcess {
    return this._focusedProcess;
  }

  get focusedThread(): ?IThread {
    return this._focusedThread;
  }

  get focusedStackFrame(): ?IStackFrame {
    return this._focusedStackFrame;
  }

  onDidChangeDebuggerFocus(
    callback: (data: {explicit: boolean}) => mixed,
  ): IDisposable {
    return this._emitter.on(DEBUGGER_FOCUS_CHANGED, callback);
  }

  onDidChangeExpressionContext(
    callback: (data: {explicit: boolean}) => mixed,
  ): IDisposable {
    return this._emitter.on(CHANGE_EXPRESSION_CONTEXT, callback);
  }

  _chooseFocusThread(process: IProcess): ?IThread {
    const threads = process.getAllThreads();

    // If the current focused thread is in the focused process and is stopped,
    // leave that thread focused. Otherwise, choose the first
    // stopped thread in the focused process if there is one,
    // and the first running thread otherwise.
    if (this._focusedThread != null) {
      const id = this._focusedThread.getId();
      const currentFocusedThread = threads.filter(
        t => t.getId() === id && t.stopped,
      );
      if (currentFocusedThread.length > 0) {
        return currentFocusedThread[0];
      }
    }

    const stoppedThreads = threads.filter(t => t.stopped);
    return stoppedThreads[0] || threads[0];
  }

  _chooseFocusStackFrame(thread: ?IThread): ?IStackFrame {
    if (thread == null) {
      return null;
    }

    // If the current focused stack frame is in the current focused thread's
    // frames, leave it alone. Otherwise return the top stack frame if the
    // thread is stopped, and null if it is running.
    const currentFocusedFrame = thread
      .getCachedCallStack()
      .find(f => f === this._focusedStackFrame);
    return thread.stopped
      ? currentFocusedFrame || thread.getCallStackTopFrame()
      : null;
  }

  _setFocus(
    process: ?IProcess,
    thread: ?IThread,
    stackFrame: ?IStackFrame,
    explicit: boolean,
  ) {
    let newProcess = process;

    // If we have a focused frame, we must have a focused thread.
    invariant(stackFrame == null || thread === stackFrame.thread);

    // If we have a focused thread, we must have a focused process.
    invariant(thread == null || process === thread.process);

    if (newProcess == null) {
      invariant(thread == null && stackFrame == null);
      newProcess = this._focusedProcess;
    }

    const focusChanged =
      this._focusedProcess !== newProcess ||
      this._focusedThread !== thread ||
      this._focusedStackFrame !== stackFrame ||
      explicit;

    this._focusedProcess = newProcess;
    this._focusedThread = thread;
    this._focusedStackFrame = stackFrame;

    if (focusChanged) {
      this._emitter.emit(DEBUGGER_FOCUS_CHANGED, {explicit});
    } else {
      // The focused stack frame didn't change, but something about the
      // context did, so interested listeners should re-evaluate expressions.
      this._emitter.emit(CHANGE_EXPRESSION_CONTEXT, {explicit});
    }
  }

  evaluateContextChanged(): void {
    this._emitter.emit(CHANGE_EXPRESSION_CONTEXT, {explicit: true});
  }

  setFocusedProcess(process: ?IProcess, explicit: boolean) {
    if (process == null) {
      this._focusedProcess = null;
      this._setFocus(null, null, null, explicit);
    } else {
      const newFocusThread = this._chooseFocusThread(process);
      const newFocusFrame = this._chooseFocusStackFrame(newFocusThread);
      this._setFocus(process, newFocusThread, newFocusFrame, explicit);
    }
  }

  setFocusedThread(thread: ?IThread, explicit: boolean) {
    if (thread == null) {
      this._setFocus(null, null, null, explicit);
    } else {
      this._setFocus(
        thread.process,
        thread,
        this._chooseFocusStackFrame(thread),
        explicit,
      );
    }
  }

  setFocusedStackFrame(stackFrame: ?IStackFrame, explicit: boolean) {
    if (stackFrame == null) {
      this._setFocus(null, null, null, explicit);
    } else {
      this._setFocus(
        stackFrame.thread.process,
        stackFrame.thread,
        stackFrame,
        explicit,
      );
    }
  }
}

function getDebuggerName(adapterType: string): string {
  return `${capitalize(adapterType)} Debugger`;
}

export default class DebugService implements IDebugService {
  _model: Model;
  _disposables: UniversalDisposable;
  _sessionEndDisposables: UniversalDisposable;
  _consoleDisposables: UniversalDisposable;
  _emitter: Emitter;
  _viewModel: ViewModel;
  _timer: ?TimingTracker;
  _breakpointsToSendOnSave: Set<string>;
  _consoleOutput: Subject<ConsoleMessage>;

  constructor(state: ?SerializedState) {
    this._disposables = new UniversalDisposable();
    this._sessionEndDisposables = new UniversalDisposable();
    this._consoleDisposables = new UniversalDisposable();
    this._emitter = new Emitter();
    this._viewModel = new ViewModel();
    this._breakpointsToSendOnSave = new Set();
    this._consoleOutput = new Subject();

    this._model = new Model(
      this._loadBreakpoints(state),
      true,
      this._loadFunctionBreakpoints(state),
      this._loadExceptionBreakpoints(state),
      this._loadWatchExpressions(state),
      () => this._viewModel.focusedProcess,
    );
    this._disposables.add(this._model, this._consoleOutput);
    this._registerListeners();
  }

  get viewModel(): IViewModel {
    return this._viewModel;
  }

  getDebuggerMode(process: ?IProcess): DebuggerModeType {
    if (process == null) {
      return DebuggerMode.STOPPED;
    }
    return process.debuggerMode;
  }

  _registerListeners(): void {
    this._disposables.add(
      atom.workspace.addOpener(uri => {
        if (uri.startsWith(DEBUG_SOURCES_URI)) {
          if (
            this.getDebuggerMode(this._viewModel.focusedProcess) !==
            DebuggerMode.STOPPED
          ) {
            return this._openSourceView(uri);
          }
        }
      }),
    );
  }

  async _openSourceView(uri: string): Promise<atom$TextEditor> {
    const query = (url.parse(uri).path || '').split('/');
    const [, sessionId, sourceReferenceRaw] = query;
    const sourceReference = parseInt(sourceReferenceRaw, 10);

    const process =
      this._model.getProcesses().find(p => p.getId() === sessionId) ||
      this._viewModel.focusedProcess;
    if (process == null) {
      throw new Error(`No debug session for source: ${sourceReference}`);
    }

    const source = process.getSource({
      path: uri,
      sourceReference,
    });

    let content = '';
    try {
      const response = await process.session.source({
        sourceReference,
        source: source.raw,
      });
      content = response.body.content;
    } catch (error) {
      this._sourceIsNotAvailable(uri);
      throw new Error('Debug source is not available');
    }

    const editor = atom.workspace.buildTextEditor({
      buffer: new DebugSourceTextBufffer(content, uri),
      autoHeight: false,
      readOnly: true,
    });

    // $FlowFixMe Debugger source views shouldn't persist between reload.
    editor.serialize = () => null;
    editor.setGrammar(atom.grammars.selectGrammar(source.name || '', content));
    const textEditorBanner = new TextEditorBanner(editor);
    textEditorBanner.render(
      <ReadOnlyNotice
        detailedMessage="This is a debug source view that may not exist on the filesystem."
        canEditAnyway={false}
        onDismiss={textEditorBanner.dispose.bind(textEditorBanner)}
      />,
    );

    this._sessionEndDisposables.addUntilDestroyed(
      editor,
      editor,
      textEditorBanner,
    );

    return editor;
  }

  /**
   * Stops the specified process.
   */
  async stopProcess(process: IProcess): Promise<void> {
    if (
      process.debuggerMode === DebuggerMode.STOPPING ||
      process.debuggerMode === DebuggerMode.STOPPED
    ) {
      return;
    }
    this._onSessionEnd((process.session: any));
  }

  async _tryToAutoFocusStackFrame(thread: IThread): Promise<void> {
    // The call stack has already been refreshed by the logic handling
    // the thread stop event for this thread.
    const callStack = thread.getCachedCallStack();
    if (
      callStack.length === 0 ||
      (this._viewModel.focusedStackFrame &&
        this._viewModel.focusedStackFrame.thread.getId() === thread.getId() &&
        callStack.includes(this._viewModel.focusedStackFrame))
    ) {
      return;
    }

    // Focus first stack frame from top that has source location if no other stack frame is focused
    const stackFrameToFocus = callStack.find(
      sf => sf.source != null && sf.source.available,
    );
    if (stackFrameToFocus == null) {
      return;
    }

    this._viewModel.setFocusedStackFrame(stackFrameToFocus, false);
  }

  _registerMarkers(process: IProcess): IDisposable {
    let selectedFrameMarker: ?atom$Marker = null;
    let threadChangeDatatip: ?IDisposable;
    let lastFocusedThreadId: ?number;
    let lastFocusedProcess: ?IProcess;

    const cleaupMarkers = () => {
      if (selectedFrameMarker != null) {
        selectedFrameMarker.destroy();
        selectedFrameMarker = null;
      }

      if (threadChangeDatatip != null) {
        threadChangeDatatip.dispose();
        threadChangeDatatip = null;
      }
    };

    return new UniversalDisposable(
      observableFromSubscribeFunction(
        this._viewModel.onDidChangeDebuggerFocus.bind(this._viewModel),
      )
        .concatMap(event => {
          cleaupMarkers();

          const {explicit} = event;
          const stackFrame = this._viewModel.focusedStackFrame;

          if (stackFrame == null || !stackFrame.source.available) {
            if (
              explicit &&
              this.getDebuggerMode(this._viewModel.focusedProcess) ===
                DebuggerMode.PAUSED
            ) {
              atom.notifications.addWarning(
                'No source available for the selected stack frame',
              );
            }
            return Observable.empty();
          }
          return Observable.fromPromise(stackFrame.openInEditor()).switchMap(
            editor => {
              if (editor == null) {
                const uri = stackFrame.source.uri;
                const errorMsg =
                  uri == null || uri === ''
                    ? 'The selected stack frame has no known source location'
                    : `Nuclide could not open ${uri}`;
                atom.notifications.addError(errorMsg);
                return Observable.empty();
              }
              return Observable.of({editor, explicit, stackFrame});
            },
          );
        })
        .subscribe(({editor, explicit, stackFrame}) => {
          const line = stackFrame.range.start.row;
          selectedFrameMarker = editor.markBufferRange(
            [[line, 0], [line, Infinity]],
            {
              invalidate: 'never',
            },
          );
          editor.decorateMarker(selectedFrameMarker, {
            type: 'line',
            class: 'debugger-current-line-highlight',
          });

          const datatipService = getDatatipService();
          if (datatipService == null) {
            return;
          }

          this._model.setExceptionBreakpoints(
            process,
            stackFrame.thread.process.session.capabilities
              .exceptionBreakpointFilters || [],
          );

          if (
            lastFocusedThreadId != null &&
            !explicit &&
            stackFrame.thread.threadId !== lastFocusedThreadId &&
            process === lastFocusedProcess
          ) {
            let message = `Active thread changed from ${lastFocusedThreadId} to ${
              stackFrame.thread.threadId
            }`;
            const newFocusedProcess = stackFrame.thread.process;
            if (
              lastFocusedProcess != null &&
              !explicit &&
              newFocusedProcess !== lastFocusedProcess
            ) {
              if (
                lastFocusedProcess.configuration.processName != null &&
                newFocusedProcess.configuration.processName != null
              ) {
                message =
                  'Active process changed from ' +
                  lastFocusedProcess.configuration.processName +
                  ' to ' +
                  newFocusedProcess.configuration.processName +
                  ' AND ' +
                  message;
              } else {
                message = 'Active process changed AND ' + message;
              }
            }
            threadChangeDatatip = datatipService.createPinnedDataTip(
              {
                component: () => (
                  <div className="debugger-thread-switch-alert">
                    <Icon icon="alert" />
                    {message}
                  </div>
                ),
                range: stackFrame.range,
                pinnable: true,
              },
              editor,
            );
            this._emitter.emit(ACTIVE_THREAD_CHANGED);
          }
          lastFocusedThreadId = stackFrame.thread.threadId;
          lastFocusedProcess = stackFrame.thread.process;
        }),

      cleaupMarkers,
    );
  }

  _registerSessionListeners(process: Process, session: VsDebugSession): void {
    this._sessionEndDisposables = new UniversalDisposable(session);
    this._sessionEndDisposables.add(this._registerMarkers(process));

    const sessionId = session.getId();

    const threadFetcher = serializeAsyncCall(async () => {
      const response = await session.threads();
      if (response && response.body && response.body.threads) {
        response.body.threads.forEach(thread => {
          this._model.rawUpdate({
            sessionId,
            thread,
          });
        });
      }
    });

    const openFilesSaved = observableFromSubscribeFunction(
      atom.workspace.observeTextEditors.bind(atom.workspace),
    ).flatMap(editor => {
      return observableFromSubscribeFunction(editor.onDidSave.bind(editor))
        .map(() => editor.getPath())
        .takeUntil(
          observableFromSubscribeFunction(editor.onDidDestroy.bind(editor)),
        );
    });

    this._sessionEndDisposables.add(
      openFilesSaved.subscribe(async filePath => {
        if (filePath == null || !this._breakpointsToSendOnSave.has(filePath)) {
          return;
        }
        this._breakpointsToSendOnSave.delete(filePath);
        await this._sendBreakpoints(filePath, true);
      }),
    );

    this._sessionEndDisposables.add(
      session.observeInitializeEvents().subscribe(async event => {
        const sendConfigurationDone = async () => {
          if (
            session &&
            session.getCapabilities().supportsConfigurationDoneRequest
          ) {
            return session
              .configurationDone()
              .then(_ => {
                this._onDebuggerModeChanged(process, DebuggerMode.RUNNING);
              })
              .catch(e => {
                // Disconnect the debug session on configuration done error #10596
                this._onSessionEnd(session);
                session.disconnect().catch(onUnexpectedError);
                atom.notifications.addError(
                  'Failed to configure debugger. This is often because either ' +
                    'the process you tried to attach to has already terminated, or ' +
                    'you do not have permissions (the process is running as root or ' +
                    'another user.)',
                  {
                    detail: e.message,
                  },
                );
              });
          }
        };

        try {
          await this._sendAllBreakpoints().then(
            sendConfigurationDone,
            sendConfigurationDone,
          );
          await threadFetcher();
        } catch (error) {
          onUnexpectedError(error);
        }
      }),
    );

    const toFocusThreads = new Subject();

    const observeContinuedTo = (threadId: ?number) => {
      return session
        .observeContinuedEvents()
        .filter(
          continued =>
            continued.body.allThreadsContinued ||
            (threadId != null && threadId === continued.body.threadId),
        )
        .take(1);
    };

    this._sessionEndDisposables.add(
      session.observeStopEvents().subscribe(() => {
        this._onDebuggerModeChanged(process, DebuggerMode.PAUSED);
      }),
      session.observeEvaluations().subscribe(() => {
        this._viewModel.evaluateContextChanged();
      }),
      session
        .observeStopEvents()
        .flatMap(event =>
          Observable.fromPromise(threadFetcher())
            .ignoreElements()
            .concat(Observable.of(event))
            .catch(error => {
              onUnexpectedError(error);
              return Observable.empty();
            })
            // Proceeed processing the stopped event only if there wasn't
            // a continued event while we're fetching the threads
            .takeUntil(observeContinuedTo(event.body.threadId)),
        )
        .subscribe((event: DebugProtocol.StoppedEvent) => {
          const {threadId} = event.body;
          // Updating stopped state needs to happen after fetching the threads
          this._model.rawUpdate({
            sessionId,
            stoppedDetails: (event.body: any),
            threadId,
          });

          if (threadId == null) {
            return;
          }
          const thread = process.getThread(threadId);
          if (thread != null) {
            toFocusThreads.next(thread);
          }
        }),

      toFocusThreads
        .concatMap(thread => {
          const {focusedThread} = this._viewModel;
          const preserveFocusHint =
            idx(thread, _ => _.stoppedDetails.preserveFocusHint) || false;

          if (
            focusedThread != null &&
            focusedThread.stopped &&
            focusedThread.getId() !== thread.getId() &&
            preserveFocusHint
          ) {
            // The debugger is already stopped elsewhere.
            return Observable.empty();
          }

          const thisThreadIsFocused =
            this._viewModel.focusedStackFrame != null &&
            this._viewModel.focusedStackFrame.thread.getId() === thread.getId();

          // Fetches the first call frame in this stack to allow the UI to
          // update the thread list. Additional frames will be fetched by the UI
          // on demand, only if they are needed.
          // If this thread is the currently focused thread, fetch the entire
          // stack because the UI will certainly need it, and we need it here to
          // try and auto-focus a frame.
          return (
            Observable.fromPromise(
              this._model.refreshCallStack(thread, thisThreadIsFocused),
            )
              .ignoreElements()
              .concat(Observable.of(thread))
              // Avoid focusing a continued thread.
              .takeUntil(observeContinuedTo(thread.threadId))
              // Verify the thread is still stopped.
              .filter(() => thread.stopped)
              .catch(error => {
                onUnexpectedError(error);
                return Observable.empty();
              })
          );
        })
        .subscribe(thread => {
          this._tryToAutoFocusStackFrame(thread);
          this._scheduleNativeNotification();
        }),
    );

    this._sessionEndDisposables.add(
      session.observeThreadEvents().subscribe(async event => {
        if (event.body.reason === 'started') {
          await threadFetcher();
        } else if (event.body.reason === 'exited') {
          this._model.clearThreads(session.getId(), true, event.body.threadId);
        }
      }),
    );

    this._sessionEndDisposables.add(
      session.observeTerminateDebugeeEvents().subscribe(event => {
        if (event.body && event.body.restart) {
          this.restartProcess(process).catch(err => {
            atom.notifications.addError('Failed to restart debugger', {
              detail: err.stack || String(err),
            });
          });
        } else {
          this._onSessionEnd(session);
          session.disconnect().catch(onUnexpectedError);
        }
      }),
    );

    this._sessionEndDisposables.add(
      session.observeContinuedEvents().subscribe(event => {
        const threadId =
          event.body.allThreadsContinued !== false
            ? undefined
            : event.body.threadId;
        this._model.clearThreads(session.getId(), false, threadId);
        this._viewModel.setFocusedThread(this._viewModel.focusedThread, false);
        this._onDebuggerModeChanged(process, DebuggerMode.RUNNING);
      }),
    );

    const outputEvents = session
      .observeOutputEvents()
      .filter(
        event => event.body != null && typeof event.body.output === 'string',
      )
      .share();

    const notificationStream = outputEvents
      .filter(e => e.body.category === 'nuclide_notification')
      .map(e => ({
        type: nullthrows(e.body.data).type,
        message: e.body.output,
      }));
    const nuclideTrackStream = outputEvents.filter(
      e => e.body.category === 'nuclide_track',
    );
    this._sessionEndDisposables.add(
      notificationStream.subscribe(({type, message}) => {
        atom.notifications.add(type, message);
      }),
      nuclideTrackStream.subscribe(e => {
        track(e.body.output, e.body.data || {});
      }),
    );

    const createConsole = getConsoleService();
    if (createConsole != null) {
      const name = getDebuggerName(process.configuration.adapterType);
      const consoleApi = createConsole({
        id: name,
        name,
      });
      this._sessionEndDisposables.add(consoleApi);
      const CATEGORIES_MAP = new Map([
        ['stderr', 'error'],
        ['console', 'warning'],
        ['success', 'success'],
      ]);
      const IGNORED_CATEGORIES = new Set([
        'telemetry',
        'nuclide_notification',
        'nuclide_track',
      ]);
      const logStream = outputEvents
        .filter(e => e.body.variablesReference == null)
        .filter(e => !IGNORED_CATEGORIES.has(e.body.category))
        .map(e => ({
          text: stripAnsi(e.body.output),
          level: CATEGORIES_MAP.get(e.body.category) || 'log',
        }))
        .filter(e => e.level != null);
      const objectStream = outputEvents
        .filter(e => e.body.variablesReference != null)
        .map(e => ({
          category: e.body.category,
          variablesReference: nullthrows(e.body.variablesReference),
        }));

      let lastEntryToken: ?RecordToken = null;
      const handleMessage = (line, level) => {
        const complete = line.endsWith('\n');
        const sameLevel =
          lastEntryToken != null && lastEntryToken.getCurrentLevel() === level;
        if (sameLevel) {
          lastEntryToken = nullthrows(lastEntryToken).appendText(line);
          if (complete) {
            lastEntryToken.setComplete();
            lastEntryToken = null;
          }
        } else {
          if (lastEntryToken != null) {
            lastEntryToken.setComplete();
          }
          lastEntryToken = consoleApi.append({
            text: line,
            level,
            incomplete: !complete,
          });
        }
      };
      this._sessionEndDisposables.add(
        logStream.subscribe(e => handleMessage(e.text, e.level)),
        notificationStream.subscribe(({type, message}) => {
          atom.notifications.add(type, message);
        }),
        objectStream.subscribe(({category, variablesReference}) => {
          const level = CATEGORIES_MAP.get(category) || 'log';
          const container = new ExpressionContainer(
            this._viewModel.focusedProcess,
            variablesReference,
            uuid.v4(),
          );
          container.getChildren().then(children => {
            this._consoleOutput.next({
              text: `object[${children.length}]`,
              expressions: children,
              level,
            });
          });
        }),
        () => {
          if (lastEntryToken != null) {
            lastEntryToken.setComplete();
          }
          lastEntryToken = null;
        },
        // TODO handle non string output (e.g. files)
      );
    }

    this._sessionEndDisposables.add(
      session
        .observeBreakpointEvents()
        .flatMap(event => {
          const {breakpoint, reason} = event.body;
          if (
            reason !== BreakpointEventReasons.CHANGED &&
            reason !== BreakpointEventReasons.REMOVED
          ) {
            return Observable.of({
              reason,
              breakpoint,
              sourceBreakpoint: null,
              functionBreakpoint: null,
            });
          }

          // Breakpoint events may arrive sooner than their responses.
          // Hence, we'll keep them cached and try re-processing on every change to the model's breakpoints
          // for a set maximum time, then discard.
          return observableFromSubscribeFunction(
            this._model.onDidChangeBreakpoints.bind(this._model),
          )
            .startWith(null)
            .switchMap(() => {
              const sourceBreakpoint = this._model
                .getBreakpoints()
                .filter(b => b.idFromAdapter === breakpoint.id)
                .pop();
              const functionBreakpoint = this._model
                .getFunctionBreakpoints()
                .filter(b => b.idFromAdapter === breakpoint.id)
                .pop();
              if (sourceBreakpoint == null && functionBreakpoint == null) {
                return Observable.empty();
              } else {
                return Observable.of({
                  reason,
                  breakpoint,
                  sourceBreakpoint,
                  functionBreakpoint,
                });
              }
            })
            .take(1)
            .timeout(MAX_BREAKPOINT_EVENT_DELAY_MS)
            .catch(error => {
              if (error instanceof TimeoutError) {
                logger.error(
                  'Timed out breakpoint event handler',
                  process.configuration.adapterType,
                  reason,
                  breakpoint,
                );
              }
              return Observable.empty();
            });
        })
        .subscribe(
          ({reason, breakpoint, sourceBreakpoint, functionBreakpoint}) => {
            if (reason === BreakpointEventReasons.NEW && breakpoint.source) {
              // The debug adapter is adding a new (unexpected) breakpoint to the UI.
              // TODO: Consider adding this to the current process only.
              const source = process.getSource(breakpoint.source);
              this._model.addUIBreakpoints(
                [
                  {
                    column: breakpoint.column || 0,
                    enabled: true,
                    line: breakpoint.line == null ? -1 : breakpoint.line,
                    uri: source.uri,
                    id: uuid.v4(),
                  },
                ],
                false,
              );
            } else if (reason === BreakpointEventReasons.REMOVED) {
              if (sourceBreakpoint != null) {
                this._model.removeBreakpoints([sourceBreakpoint]);
              }
              if (functionBreakpoint != null) {
                this._model.removeFunctionBreakpoints(
                  functionBreakpoint.getId(),
                );
              }
            } else if (reason === BreakpointEventReasons.CHANGED) {
              if (sourceBreakpoint != null) {
                if (!sourceBreakpoint.column) {
                  breakpoint.column = undefined;
                }
                this._model.updateProcessBreakpoints(process, {
                  [sourceBreakpoint.getId()]: breakpoint,
                });
              }
              if (functionBreakpoint != null) {
                this._model.updateFunctionBreakpoints({
                  [functionBreakpoint.getId()]: breakpoint,
                });
              }
            } else {
              logger.warn('Unknown breakpoint event', reason, breakpoint);
            }
          },
        ),
    );

    this._sessionEndDisposables.add(
      session.observeAdapterExitedEvents().subscribe(event => {
        // 'Run without debugging' mode VSCode must terminate the extension host. More details: #3905
        this._onSessionEnd(session);
      }),
    );

    this._sessionEndDisposables.add(
      session.observeCustomEvents().subscribe(event => {
        this._emitter.emit(CUSTOM_DEBUG_EVENT, event);
      }),
    );

    // Clear in memory breakpoints.
    this._sessionEndDisposables.add(() => {
      const sourceRefBreakpoints = this._model
        .getBreakpoints()
        .filter(bp => bp.uri.startsWith(DEBUG_SOURCES_URI));
      if (sourceRefBreakpoints.length > 0) {
        this._model.removeBreakpoints(sourceRefBreakpoints);
      }
    });
  }

  _scheduleNativeNotification(): void {
    const raiseNativeNotification = getNotificationService();
    if (raiseNativeNotification != null) {
      const pendingNotification = raiseNativeNotification(
        'Debugger',
        'Paused at a breakpoint',
        3000,
        false,
      );
      if (pendingNotification != null) {
        this._sessionEndDisposables.add(pendingNotification);
      }
    }
  }

  onDidChangeActiveThread(callback: () => mixed): IDisposable {
    return this._emitter.on(ACTIVE_THREAD_CHANGED, callback);
  }

  onDidStartDebugSession(
    callback: (config: IProcessConfig) => mixed,
  ): IDisposable {
    return this._emitter.on(START_DEBUG_SESSION, callback);
  }

  onDidCustomEvent(
    callback: (event: DebugProtocol.DebugEvent) => mixed,
  ): IDisposable {
    return this._emitter.on(CUSTOM_DEBUG_EVENT, callback);
  }

  onDidChangeProcessMode(
    callback: (data: {process: IProcess, mode: DebuggerModeType}) => mixed,
  ): IDisposable {
    return this._emitter.on(CHANGE_DEBUG_MODE, callback);
  }

  _loadBreakpoints(state: ?SerializedState): IUIBreakpoint[] {
    let result: IUIBreakpoint[] = [];
    if (state == null || state.sourceBreakpoints == null) {
      return result;
    }
    try {
      result = state.sourceBreakpoints.map(breakpoint => {
        const bp: IUIBreakpoint = {
          uri: breakpoint.uri,
          line: breakpoint.originalLine,
          column: breakpoint.column,
          enabled: breakpoint.enabled,
          id: uuid.v4(),
        };
        if (
          breakpoint.condition != null &&
          breakpoint.condition.trim() !== ''
        ) {
          bp.condition = breakpoint.condition;
        }
        if (
          breakpoint.logMessage != null &&
          breakpoint.logMessage.trim() !== ''
        ) {
          bp.logMessage = breakpoint.logMessage;
        }
        return bp;
      });
    } catch (e) {}

    return result;
  }

  _loadFunctionBreakpoints(state: ?SerializedState): FunctionBreakpoint[] {
    let result: FunctionBreakpoint[] = [];
    if (state == null || state.functionBreakpoints == null) {
      return result;
    }
    try {
      result = state.functionBreakpoints.map(fb => {
        return new FunctionBreakpoint(fb.name, fb.enabled, fb.hitCondition);
      });
    } catch (e) {}

    return result;
  }

  _loadExceptionBreakpoints(state: ?SerializedState): ExceptionBreakpoint[] {
    let result: ExceptionBreakpoint[] = [];
    if (state == null || state.exceptionBreakpoints == null) {
      return result;
    }
    try {
      result = state.exceptionBreakpoints.map(exBreakpoint => {
        return new ExceptionBreakpoint(
          exBreakpoint.filter,
          exBreakpoint.label,
          exBreakpoint.enabled,
        );
      });
    } catch (e) {}

    return result;
  }

  _loadWatchExpressions(state: ?SerializedState): Expression[] {
    let result: Expression[] = [];
    if (state == null || state.watchExpressions == null) {
      return result;
    }
    try {
      result = state.watchExpressions.map(name => new Expression(name));
    } catch (e) {}

    return result;
  }

  _onDebuggerModeChanged(process: IProcess, mode: DebuggerModeType): void {
    this._emitter.emit(CHANGE_DEBUG_MODE, {
      data: {
        process,
        mode,
      },
    });
  }

  enableOrDisableBreakpoints(
    enable: boolean,
    breakpoint?: IEnableable,
  ): Promise<void> {
    if (breakpoint != null) {
      this._model.setEnablement(breakpoint, enable);
      if (breakpoint instanceof Breakpoint) {
        return this._sendBreakpoints(breakpoint.uri);
      } else if (breakpoint instanceof FunctionBreakpoint) {
        return this._sendFunctionBreakpoints();
      } else {
        track(AnalyticsEvents.DEBUGGER_TOGGLE_EXCEPTION_BREAKPOINT);
        return this._sendExceptionBreakpoints();
      }
    }

    this._model.enableOrDisableAllBreakpoints(enable);
    return this._sendAllBreakpoints();
  }

  async addUIBreakpoints(uiBreakpoints: IUIBreakpoint[]): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_ADD);
    this._model.addUIBreakpoints(uiBreakpoints);

    const uris = new Set();
    for (const bp of uiBreakpoints) {
      uris.add(bp.uri);
    }

    const promises = [];
    for (const uri of uris) {
      promises.push(this._sendBreakpoints(uri));
    }

    await Promise.all(promises);
  }

  addSourceBreakpoint(uri: string, line: number): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_SINGLE_ADD);
    const existing = this._model.getBreakpointAtLine(uri, line);
    if (existing == null) {
      return this.addUIBreakpoints([
        {line, column: 0, enabled: true, id: uuid.v4(), uri},
      ]);
    }
    return Promise.resolve(undefined);
  }

  toggleSourceBreakpoint(uri: string, line: number): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_TOGGLE);
    const existing = this._model.getBreakpointAtLine(uri, line);
    if (existing == null) {
      return this.addUIBreakpoints([
        {line, column: 0, enabled: true, id: uuid.v4(), uri},
      ]);
    } else {
      return this.removeBreakpoints(existing.getId(), true);
    }
  }

  updateBreakpoints(uiBreakpoints: IUIBreakpoint[]) {
    this._model.updateBreakpoints(uiBreakpoints);

    const urisToSend = new Set(uiBreakpoints.map(bp => bp.uri));
    for (const uri of urisToSend) {
      this._breakpointsToSendOnSave.add(uri);
    }
  }

  async removeBreakpoints(
    id?: string,
    skipAnalytics?: boolean = false,
  ): Promise<void> {
    const toRemove = this._model
      .getBreakpoints()
      .filter(bp => id == null || bp.getId() === id);
    const urisToClear = distinct(toRemove, bp => bp.uri).map(bp => bp.uri);

    this._model.removeBreakpoints(toRemove);

    if (id == null) {
      track(AnalyticsEvents.DEBUGGER_BREAKPOINT_DELETE_ALL);
    } else if (!skipAnalytics) {
      track(AnalyticsEvents.DEBUGGER_BREAKPOINT_DELETE);
    }

    await Promise.all(urisToClear.map(uri => this._sendBreakpoints(uri)));
  }

  setBreakpointsActivated(activated: boolean): Promise<void> {
    this._model.setBreakpointsActivated(activated);
    return this._sendAllBreakpoints();
  }

  addFunctionBreakpoint(): void {
    this._model.addFunctionBreakpoint('');
  }

  renameFunctionBreakpoint(id: string, newFunctionName: string): Promise<void> {
    this._model.updateFunctionBreakpoints({[id]: {name: newFunctionName}});
    return this._sendFunctionBreakpoints();
  }

  removeFunctionBreakpoints(id?: string): Promise<void> {
    this._model.removeFunctionBreakpoints(id);
    return this._sendFunctionBreakpoints();
  }

  async terminateThreads(threadIds: Array<number>): Promise<void> {
    const {focusedProcess} = this.viewModel;
    if (focusedProcess == null) {
      return;
    }

    const session = focusedProcess.session;
    track(AnalyticsEvents.DEBUGGER_TERMINATE_THREAD);
    if (Boolean(session.capabilities.supportsTerminateThreadsRequest)) {
      await session.custom('terminateThreads', {
        threadIds,
      });
    }
  }

  async runToLocation(uri: string, line: number): Promise<void> {
    const {focusedThread, focusedProcess} = this.viewModel;
    if (focusedThread == null || focusedProcess == null) {
      return;
    }

    const session = focusedProcess.session;

    track(AnalyticsEvents.DEBUGGER_STEP_RUN_TO_LOCATION);
    if (Boolean(session.capabilities.supportsContinueToLocation)) {
      await session.custom('continueToLocation', {
        source: focusedProcess.getSource({path: uri}).raw,
        line,
        threadId: focusedThread.threadId,
      });
      return;
    }
    const existing = this._model.getBreakpointAtLine(uri, line);
    if (existing == null) {
      await this.addUIBreakpoints([
        {line, column: 0, enabled: true, id: uuid.v4(), uri},
      ]);
      const runToLocationBreakpoint = this._model.getBreakpointAtLine(
        uri,
        line,
      );
      invariant(runToLocationBreakpoint != null);

      const removeBreakpoint = () => {
        this.removeBreakpoints(
          runToLocationBreakpoint.getId(),
          true /* skip analytics */,
        ).catch(error =>
          onUnexpectedError(
            `Failed to clear run-to-location breakpoint! - ${String(error)}`,
          ),
        );
        removeBreakpointDisposable.dispose();
        this._sessionEndDisposables.remove(removeBreakpointDisposable);
        this._sessionEndDisposables.remove(removeBreakpoint);
      };

      // Remove if the debugger stopped at any location.
      const removeBreakpointDisposable = new UniversalDisposable(
        session
          .observeStopEvents()
          .take(1)
          .subscribe(removeBreakpoint),
      );
      // Remove if the session has ended without hitting it.
      this._sessionEndDisposables.add(
        removeBreakpointDisposable,
        removeBreakpoint,
      );
    }
    await focusedThread.continue();
  }

  addWatchExpression(name: string): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_ADD_EXPRESSION);
    return this._model.addWatchExpression(name);
  }

  renameWatchExpression(id: string, newName: string): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_UPDATE_EXPRESSION);
    return this._model.renameWatchExpression(id, newName);
  }

  removeWatchExpressions(id?: string): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_REMOVE_EXPRESSION);
    this._model.removeWatchExpressions(id);
  }

  createExpression(rawExpression: string): IEvaluatableExpression {
    return new Expression(rawExpression);
  }

  async _doCreateProcess(
    rawConfiguration: IProcessConfig,
    sessionId: string,
  ): Promise<?IProcess> {
    let process: ?Process;
    let session: ?VsDebugSession;
    const errorHandler = (error: Error) => {
      if (this._timer != null) {
        this._timer.onError(error);
        this._timer = null;
      }
      track(AnalyticsEvents.DEBUGGER_START_FAIL, {});
      const errorMessage = error instanceof Error ? error.message : error;
      atom.notifications.addError(
        `Failed to start debugger process: ${errorMessage}`,
      );

      if (
        this._model.getProcesses() == null ||
        this._model.getProcesses().length === 0
      ) {
        this._consoleDisposables.dispose();
      }
      if (session != null && !session.isDisconnected()) {
        this._onSessionEnd(session);
        session.disconnect().catch(onUnexpectedError);
      }
      if (process != null) {
        this._model.removeProcess(process.getId());
        this._onDebuggerModeChanged(process, DebuggerMode.STOPPED);
      }
    };

    try {
      const adapterExecutable = await this._resolveAdapterExecutable(
        rawConfiguration,
      );
      const configuration = await resolveDebugConfiguration({
        ...rawConfiguration,
        adapterExecutable,
      });
      const {
        adapterType,
        onDebugStartingCallback,
        onDebugStartedCallback,
        onDebugRunningCallback,
      } = configuration;

      track(AnalyticsEvents.DEBUGGER_START, {
        serviceName: configuration.adapterType,
        clientType: 'VSP',
      });

      const sessionTeardownDisposables = new UniversalDisposable();

      const instanceInterface = newSession => {
        return Object.freeze({
          customRequest: async (
            request: string,
            args: any,
          ): Promise<DebugProtocol.CustomResponse> => {
            return newSession.custom(request, args);
          },
          observeCustomEvents: newSession.observeCustomEvents.bind(newSession),
        });
      };

      const createInitializeSession = async (config: IProcessConfig) => {
        const newSession = await this._createVsDebugSession(
          config,
          config.adapterExecutable || adapterExecutable,
          sessionId,
        );

        // If this is the first process, register the console executor.
        if (this._model.getProcesses().length === 0) {
          this._registerConsoleExecutor();
        }

        process = this._model.addProcess(config, newSession);
        this._viewModel.setFocusedProcess(process, false);
        this._onDebuggerModeChanged(process, DebuggerMode.STARTING);
        this._emitter.emit(START_DEBUG_SESSION, config);
        this._registerSessionListeners(process, newSession);
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'debugger:show',
        );
        await newSession.initialize({
          clientID: 'atom',
          adapterID: adapterType,
          pathFormat: 'path',
          linesStartAt1: true,
          columnsStartAt1: true,
          supportsVariableType: true,
          supportsVariablePaging: false,
          supportsRunInTerminalRequest: getTerminalService() != null,
          locale: 'en-us',
        });

        if (onDebugStartingCallback != null) {
          // Callbacks are passed IVspInstance which exposes only certain
          // methods to them, rather than getting the full session.
          const teardown = onDebugStartingCallback(
            instanceInterface(newSession),
          );
          if (teardown != null) {
            sessionTeardownDisposables.add(teardown);
          }
        }

        this._model.setExceptionBreakpoints(
          process,
          newSession.getCapabilities().exceptionBreakpointFilters || [],
        );
        return newSession;
      };

      session = await createInitializeSession(configuration);

      const setRunningState = () => {
        if (process != null) {
          process.clearProcessStartingFlag();
          this._onDebuggerModeChanged(process, DebuggerMode.RUNNING);
          this._viewModel.setFocusedProcess(process, false);
          if (onDebugRunningCallback != null && session != null) {
            // Callbacks are passed IVspInstance which exposes only certain
            // methods to them, rather than getting the full session.
            const teardown = onDebugRunningCallback(instanceInterface(session));
            if (teardown != null) {
              sessionTeardownDisposables.add(teardown);
            }
          }
        }
      };

      // We're not awaiting launch/attach to finish because some debug adapters
      // need to do custom work for launch/attach to work (e.g. mobilejs)
      this._launchOrAttachTarget(session, configuration)
        .then(() => setRunningState())
        .catch(async error => {
          if (process != null) {
            this.stopProcess(process);
          }

          if (
            configuration.debugMode === 'attach' &&
            configuration.adapterExecutable != null &&
            configuration.adapterExecutable.command !== 'sudo' &&
            // sudo is not supported on Windows, and currently remote projects
            // are not supported on Windows, so a remote URI must be *nix.
            (os.platform() !== 'win32' ||
              nuclideUri.isRemote(configuration.targetUri))
          ) {
            configuration.adapterExecutable.args = [
              configuration.adapterExecutable.command,
              ...configuration.adapterExecutable.args,
            ];
            configuration.adapterExecutable.command = 'sudo';

            const errorMessage = error instanceof Error ? error.message : error;
            atom.notifications.addWarning(
              `The debugger was unable to attach to the target process: ${errorMessage}. ` +
                'Attempting to re-launch the debugger as root...',
            );

            session = await createInitializeSession(configuration);
            this._launchOrAttachTarget(session, configuration)
              .then(() => setRunningState())
              .catch(errorHandler);
          } else {
            errorHandler(error);
          }
        });

      if (onDebugStartedCallback != null && session != null) {
        const teardown = onDebugStartedCallback(instanceInterface(session));
        if (teardown != null) {
          sessionTeardownDisposables.add(teardown);
        }
      }

      this._sessionEndDisposables.add(() => {
        this._model.onDidChangeProcesses(() => {
          if (
            !this.getModel()
              .getProcesses()
              .includes(process)
          ) {
            sessionTeardownDisposables.dispose();
          }
        });
      });
      this._sessionEndDisposables.add(sessionTeardownDisposables);

      return process;
    } catch (error) {
      errorHandler(error);
      return null;
    }
  }

  async _resolveAdapterExecutable(
    configuration: IProcessConfig,
  ): Promise<VSAdapterExecutableInfo> {
    if (configuration.adapterExecutable != null) {
      return configuration.adapterExecutable;
    }
    return getVSCodeDebuggerAdapterServiceByNuclideUri(
      configuration.targetUri,
    ).getAdapterExecutableInfo(configuration.adapterType);
  }

  async _createVsDebugSession(
    configuration: IProcessConfig,
    adapterExecutable: VSAdapterExecutableInfo,
    sessionId: string,
  ): Promise<VsDebugSession> {
    const {targetUri} = configuration;
    const service = getVSCodeDebuggerAdapterServiceByNuclideUri(targetUri);
    const spawner = await service.createVsRawAdapterSpawnerService();

    const clientPreprocessors: Array<MessageProcessor> = [];
    const adapterPreprocessors: Array<MessageProcessor> = [];
    if (configuration.clientPreprocessor != null) {
      clientPreprocessors.push(configuration.clientPreprocessor);
    }
    if (configuration.adapterPreprocessor != null) {
      adapterPreprocessors.push(configuration.adapterPreprocessor);
    }
    const isRemote = nuclideUri.isRemote(targetUri);
    if (isRemote) {
      clientPreprocessors.push(remoteToLocalProcessor());
      adapterPreprocessors.push(localToRemoteProcessor(targetUri));
    }
    return new VsDebugSession(
      sessionId,
      logger,
      adapterExecutable,
      {adapter: configuration.adapterType, host: 'debugService', isRemote},
      spawner,
      clientPreprocessors,
      adapterPreprocessors,
      this._runInTerminal,
      Boolean(configuration.isReadOnly),
    );
  }

  async _launchOrAttachTarget(
    session: VsDebugSession,
    configuration: IProcessConfig,
  ): Promise<void> {
    if (configuration.debugMode === 'attach') {
      await session.attach(configuration.config);
    } else {
      // It's 'launch'
      await session.launch(configuration.config);
    }
  }

  _sourceIsNotAvailable(uri: string): void {
    this._model.sourceIsNotAvailable(uri);
  }

  _runInTerminal = async (
    args: DebugProtocol.RunInTerminalRequestArguments,
  ): Promise<void> => {
    const terminalService = getTerminalService();
    if (terminalService == null) {
      throw new Error(
        'Unable to launch in terminal since the service is not available',
      );
    }
    const process = this._getCurrentProcess();
    if (process == null) {
      throw new Error("There's no debug process to create a terminal for!");
    }
    const {adapterType, targetUri} = process.configuration;
    const key = `targetUri=${targetUri}&command=${args.args[0]}`;

    // Ensure any previous instances of this same target are closed before
    // opening a new terminal tab. We don't want them to pile up if the
    // user keeps running the same app over and over.
    terminalService.close(key);

    const title =
      args.title != null ? args.title : getDebuggerName(adapterType);
    const hostname = nuclideUri.getHostnameOpt(targetUri);
    const cwd =
      hostname == null
        ? args.cwd
        : nuclideUri.createRemoteUri(hostname, args.cwd);

    const info: TerminalInfo = {
      key,
      title,
      cwd,
      command: {
        file: args.args[0],
        args: args.args.slice(1),
      },
      environmentVariables:
        args.env != null ? mapFromObject(args.env) : undefined,
      preservedCommands: [
        'debugger:continue-debugging',
        'debugger:stop-debugging',
        'debugger:restart-debugging',
        'debugger:step-over',
        'debugger:step-into',
        'debugger:step-out',
      ],
      remainOnCleanExit: true,
      icon: 'nuclicon-debugger',
      defaultLocation: 'bottom',
    };
    const terminal: TerminalInstance = await terminalService.open(info);

    terminal.setProcessExitCallback(() => {
      // This callback is invoked if the target process dies first, ensuring
      // we tear down the debugger.
      this.stopProcess(process);
    });

    this._sessionEndDisposables.add(() => {
      // This termination path is invoked if the debugger dies first, ensuring
      // we terminate the target process. This can happen if the user hits stop,
      // or if the debugger crashes.
      terminal.setProcessExitCallback(() => {});
      terminal.terminateProcess();
    });

    const spawn = observableFromSubscribeFunction(cb => terminal.onSpawn(cb));
    return spawn.take(1).toPromise();
  };

  canRestartProcess(): boolean {
    const process = this._getCurrentProcess();
    return process != null && process.configuration.isRestartable === true;
  }

  async restartProcess(process: IProcess): Promise<void> {
    if (process.session.capabilities.supportsRestartRequest) {
      await process.session.custom('restart', null);
    }
    await process.session.disconnect(true);
    await sleep(300);
    await this.startDebugging(process.configuration);
  }

  /**
   * Starts debugging. If the configOrName is not passed uses the selected configuration in the debug dropdown.
   * Also saves all files, manages if compounds are present in the configuration
   * and resolveds configurations via DebugConfigurationProviders.
   */
  async startDebugging(config: IProcessConfig): Promise<void> {
    this._timer = startTracking('debugger-atom:startDebugging');

    // Open the console window if it's not already opened.
    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.workspace.open(CONSOLE_VIEW_URI, {searchAllPanes: true});

    await this._doCreateProcess(config, uuid.v4());

    if (this._model.getProcesses().length > 1) {
      const debuggerTypes = this._model
        .getProcesses()
        .map(
          ({configuration}) =>
            `${configuration.adapterType}: ${configuration.processName || ''}`,
        );
      track(AnalyticsEvents.DEBUGGER_MULTITARGET, {
        processesCount: this._model.getProcesses().length,
        debuggerTypes,
      });
    }
  }

  _onSessionEnd = async (session: VsDebugSession): Promise<void> => {
    track(AnalyticsEvents.DEBUGGER_STOP);
    const removedProcesses = this._model.removeProcess(session.getId());
    if (removedProcesses.length === 0) {
      // If the process is already removed from the model, there's nothing else
      // to do. We can re-enter here if the debug session ends before the
      // debug adapter process terminates.
      return;
    }

    // Mark all removed processes as STOPPING.
    removedProcesses.forEach(process => {
      process.setStopPending();
      this._onDebuggerModeChanged(process, DebuggerMode.STOPPING);
    });

    // Ensure all the adapters are terminated.
    await session.disconnect(false /* restart */, true /* force */);

    if (
      this._model.getProcesses() == null ||
      this._model.getProcesses().length === 0
    ) {
      this._sessionEndDisposables.dispose();
      this._consoleDisposables.dispose();

      // No processes remaining, clear process focus.
      this._viewModel.setFocusedProcess(null, false);
    } else {
      if (
        this._viewModel.focusedProcess != null &&
        this._viewModel.focusedProcess.getId() === session.getId()
      ) {
        // The process that just exited was the focused process, so we need
        // to move focus to another process. If there's a process with a
        // stopped thread, choose that. Otherwise choose the last process.
        const allProcesses = this._model.getProcesses();
        const processToFocus =
          allProcesses.filter(p => p.getAllThreads().some(t => t.stopped))[0] ||
          allProcesses[allProcesses.length - 1];
        this._viewModel.setFocusedProcess(processToFocus, false);
      }
    }

    removedProcesses.forEach(process => {
      this._onDebuggerModeChanged(process, DebuggerMode.STOPPED);
    });

    const createConsole = getConsoleService();
    if (createConsole != null) {
      const name = 'Nuclide Debugger';
      const consoleApi = createConsole({
        id: name,
        name,
      });

      removedProcesses.forEach(p =>
        consoleApi.append({
          text:
            'Process exited' +
            (p.configuration.processName == null
              ? ''
              : ' (' + p.configuration.processName + ')'),
          level: 'log',
        }),
      );
    }

    if (this._timer != null) {
      this._timer.onSuccess();
      this._timer = null;
    }
  };

  getModel(): IModel {
    return this._model;
  }

  async _sendAllBreakpoints(): Promise<void> {
    await Promise.all(
      distinct(this._model.getBreakpoints(), bp => bp.uri).map(bp =>
        this._sendBreakpoints(bp.uri, false),
      ),
    );
    await this._sendFunctionBreakpoints();
    // send exception breakpoints at the end since some debug adapters rely on the order
    await this._sendExceptionBreakpoints();
  }

  async _sendBreakpoints(
    uri: string,
    sourceModified?: boolean = false,
  ): Promise<void> {
    const process = this._getCurrentProcess();
    const session = this._getCurrentSession();
    if (
      process == null ||
      session == null ||
      !session.isReadyForBreakpoints()
    ) {
      return;
    }

    const breakpointsToSend = ((sourceModified
      ? this._model.getUIBreakpoints()
      : this._model.getBreakpoints()
    ).filter(
      bp =>
        this._model.areBreakpointsActivated() && bp.enabled && bp.uri === uri,
    ): any);

    const rawSource = process.getSource({
      path: uri,
      name: nuclideUri.basename(uri),
    }).raw;

    if (
      !sourceModified &&
      breakpointsToSend.length > 0 &&
      !rawSource.adapterData &&
      breakpointsToSend[0].adapterData
    ) {
      rawSource.adapterData = breakpointsToSend[0].adapterData;
    }

    // The UI is 0-based, while VSP is 1-based.
    const response = await session.setBreakpoints({
      source: (rawSource: any),
      lines: breakpointsToSend.map(bp => bp.line),
      breakpoints: breakpointsToSend.map(bp => {
        const bpToSend: Object = {
          line: bp.line,
        };
        // Column and condition are optional in the protocol, but should
        // only be included on the object sent to the debug adapter if
        // they have values that exist.
        if (bp.column != null && bp.column > 0) {
          bpToSend.column = bp.column;
        }
        if (bp.condition != null && bp.condition !== '') {
          bpToSend.condition = bp.condition;
        }
        if (bp.logMessage != null && bp.logMessage !== '') {
          bpToSend.logMessage = bp.logMessage;
        }
        return bpToSend;
      }),
      sourceModified,
    });
    if (response == null || response.body == null) {
      return;
    }

    const data: {[id: string]: DebugProtocol.Breakpoint} = {};
    for (let i = 0; i < breakpointsToSend.length; i++) {
      // If sourceModified === true, we're dealing with new UI breakpoints that
      // represent the new location(s) the breakpoints ended up in due to the
      // file contents changing. These are of type IUIBreakpoint.  Otherwise,
      // we have process breakpoints of type IBreakpoint here. These types both have
      // an ID, but we get it a little differently.
      const bpId = sourceModified
        ? breakpointsToSend[i].id
        : breakpointsToSend[i].getId();

      data[bpId] = response.body.breakpoints[i];
      if (!breakpointsToSend[i].column) {
        // If there was no column sent ignore the breakpoint column response from the adapter
        data[bpId].column = undefined;
      }
    }

    this._model.updateProcessBreakpoints(process, data);
  }

  _getCurrentSession(): ?VsDebugSession {
    return this._viewModel.focusedProcess == null
      ? null
      : (this._viewModel.focusedProcess.session: any);
  }

  _getCurrentProcess(): ?IProcess {
    return this._viewModel.focusedProcess;
  }

  async _sendFunctionBreakpoints(): Promise<void> {
    const session = this._getCurrentSession();
    if (
      session == null ||
      !session.isReadyForBreakpoints() ||
      !session.getCapabilities().supportsFunctionBreakpoints
    ) {
      return;
    }

    const breakpointsToSend: any = this._model
      .getFunctionBreakpoints()
      .filter(fbp => fbp.enabled && this._model.areBreakpointsActivated());
    const response: DebugProtocol.SetFunctionBreakpointsResponse = await session.setFunctionBreakpoints(
      {
        breakpoints: breakpointsToSend,
      },
    );
    if (response == null || response.body == null) {
      return;
    }

    const data = {};
    for (let i = 0; i < breakpointsToSend.length; i++) {
      data[breakpointsToSend[i].getId()] = response.body.breakpoints[i];
    }

    this._model.updateFunctionBreakpoints(data);
  }

  async _sendExceptionBreakpoints(): Promise<void> {
    const session = this._getCurrentSession();
    if (
      session == null ||
      !session.isReadyForBreakpoints() ||
      this._model.getExceptionBreakpoints().length === 0
    ) {
      return;
    }

    const enabledExceptionBps = this._model
      .getExceptionBreakpoints()
      .filter(exb => exb.enabled);
    await session.setExceptionBreakpoints({
      filters: enabledExceptionBps.map(exb => exb.filter),
    });
  }

  _evaluateExpression(expression: IEvaluatableExpression, level: Level) {
    const {focusedProcess, focusedStackFrame} = this._viewModel;
    if (focusedProcess == null) {
      logger.error('Cannot evaluate while there is no active debug session');
      return;
    }
    const subscription =
      // We filter here because the first value in the BehaviorSubject is null no matter what, and
      // we want the console to unsubscribe the stream after the first non-null value.
      evaluateExpressionAsStream(
        expression,
        focusedProcess,
        focusedStackFrame,
        'repl',
      )
        .skip(1) // Skip the first pending value.
        .subscribe(result => {
          // Evaluate all watch expressions and fetch variables again since repl evaluation might have changed some.
          this._viewModel.setFocusedStackFrame(
            this._viewModel.focusedStackFrame,
            false,
          );

          if (result.isError || result.isPending || !expression.available) {
            const message: ConsoleMessage = {
              text: expression.getValue(),
              level: 'error',
            };
            this._consoleOutput.next(message);
          } else if (expression.hasChildren()) {
            this._consoleOutput.next({
              text: 'object',
              expressions: [expression],
              level,
            });
          } else {
            this._consoleOutput.next({
              text: expression.getValue(),
              level,
            });
          }
          this._consoleDisposables.remove(subscription);
        });
    this._consoleDisposables.add(subscription);
  }

  _registerConsoleExecutor() {
    this._consoleDisposables = new UniversalDisposable();
    const registerExecutor = getConsoleRegisterExecutor();
    if (registerExecutor == null) {
      return;
    }

    const emitter = new Emitter();
    const SCOPE_CHANGED = 'SCOPE_CHANGED';
    const viewModel = this._viewModel;
    const evaluateExpression = this._evaluateExpression.bind(this);
    const executor = {
      id: 'debugger',
      name: 'Debugger',
      scopeName: () => {
        if (
          viewModel.focusedProcess != null &&
          viewModel.focusedProcess.configuration.grammarName != null
        ) {
          return viewModel.focusedProcess.configuration.grammarName;
        }
        return 'text.plain';
      },
      onDidChangeScopeName(callback: () => mixed): IDisposable {
        return emitter.on(SCOPE_CHANGED, callback);
      },
      send(expression: string) {
        evaluateExpression(new Expression(expression), 'log');
      },
      output: this._consoleOutput,
    };

    this._consoleDisposables.add(
      emitter,
      this._viewModel.onDidChangeDebuggerFocus(() => {
        emitter.emit(SCOPE_CHANGED);
      }),
    );
    this._consoleDisposables.add(registerExecutor(executor));
  }

  dispose(): void {
    this._disposables.dispose();
    this._consoleDisposables.dispose();
    this._sessionEndDisposables.dispose();
  }
}

class DebugSourceTextBufffer extends TextBuffer {
  _uri: string;

  constructor(contents: string, uri: string) {
    super(contents);
    this._uri = uri;
  }

  getUri() {
    return this._uri;
  }

  getPath() {
    return this._uri;
  }

  isModified() {
    return false;
  }
}
