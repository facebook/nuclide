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
  FileVersion,
  FileOpenEvent,
  FileCloseEvent,
  FileEditEvent,
} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  DiagnosticProviderUpdate,
  FileDiagnosticMessages,
  FindReferencesReturn,
  Outline,
  OutlineTree,
  CodeAction,
  FileDiagnosticMessage,
} from 'atom-ide-ui';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FormatOptions,
  SymbolResult,
} from '../../nuclide-language-service/lib/LanguageService';
import type {
  HostServices,
  Progress,
} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {ConnectableObservable} from 'rxjs';
import type {
  InitializeParams,
  ClientCapabilities,
  ServerCapabilities,
  PublishDiagnosticsParams,
  LogMessageParams,
  ShowMessageParams,
  ShowMessageRequestParams,
  ProgressParams,
  ActionRequiredParams,
  DidOpenTextDocumentParams,
  DidCloseTextDocumentParams,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent,
  SymbolInformation,
  UncoveredRange,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
} from './protocol';
import type {
  JsonRpcConnection,
  CancellationToken,
  CancellationTokenSource,
} from './jsonrpc';

import invariant from 'assert';
import through from 'through';
import {spawn} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {collect} from 'nuclide-commons/collection';
import {compact} from 'nuclide-commons/observable';
import {track} from '../../nuclide-analytics';
import passesGK from '../../commons-node/passesGK';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';
import {
  FileCache,
  FileVersionNotifier,
  FileEventKind,
} from '../../nuclide-open-files-rpc';
import * as rpc from 'vscode-jsonrpc';
import * as convert from './convert';
import {Observable, Subject, BehaviorSubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Point, Range as atom$Range} from 'simple-text-buffer';
import {
  ensureInvalidations,
  forkHostServices,
} from '../../nuclide-language-service-rpc';
import {JsonRpcTrace} from './jsonrpc';
import {LspConnection} from './LspConnection';
import {
  ErrorCodes,
  TextDocumentSyncKind,
  MessageType as LspMessageType,
} from './protocol';
import {arrayCompact} from 'nuclide-commons/collection';

type State =
  | 'Initial'
  | 'Starting'
  | 'StartFailed'
  | 'Running'
  | 'Stopping'
  | 'Stopped';

// Marshals messages from Nuclide's LanguageService
// to VS Code's Language Server Protocol
export class LspLanguageService {
  // These fields are provided upon construction
  _projectRoot: string;
  _fileCache: FileCache; // tracks which fileversions we've received from Nuclide client
  _masterHost: HostServices; // this is the one we're given
  _host: HostServices; // this is created per-connection
  _lspFileVersionNotifier: FileVersionNotifier; // tracks which fileversions we've sent to LSP
  _fileEventSubscription: rxjs$ISubscription;
  _languageId: string;
  _command: string;
  _args: Array<string>;
  _spawnOptions: Object; // supplies the options for spawning a process
  _fileExtensions: Array<string>;
  _logger: log4js$Logger;
  _host: HostServices;
  _fileCache: FileCache; // tracks which fileversions we've received from Nuclide client
  _initializationOptions: Object;

  // These fields reflect our own state.
  // (Most should be nullable types, but it's not worth the bother.)
  _state: State = 'Initial';
  _stateIndicator: UniversalDisposable = new UniversalDisposable();
  _progressIndicators: Map<string | number, Promise<Progress>> = new Map();
  _actionRequiredIndicators: Map<
    string | number,
    UniversalDisposable,
  > = new Map();
  _recentRestarts: Array<number> = [];
  _diagnosticUpdates: Subject<
    Observable<PublishDiagnosticsParams>,
  > = new Subject();
  _supportsSymbolSearch: BehaviorSubject<?boolean> = new BehaviorSubject(null);
  // Fields which become live inside start(), when we spawn the LSP process.
  // Disposing of the _lspConnection will dispose of all of them.
  _childOut: {stdout: ?string, stderr: string} = {stdout: '', stderr: ''};
  _lspConnection: LspConnection; // is really "?LspConnection"
  // Fields which become live after we receive an initializeResponse:
  _serverCapabilities: ServerCapabilities;
  _derivedServerCapabilities: DerivedServerCapabilities;
  _lspFileVersionNotifier: FileVersionNotifier; // tracks which fileversions we've sent to LSP

  // Whenever we trigger a new request, we cancel the outstanding request, so
  // only one request of these types would be active at a time. Note that the
  // language server is free to ignore any cancellation request, so we could
  // still potentially have multiple outstanding requests of the same type.
  _hoverCancellation: CancellationTokenSource = new rpc.CancellationTokenSource();
  _highlightCancellation: CancellationTokenSource = new rpc.CancellationTokenSource();

  constructor(
    logger: log4js$Logger,
    fileCache: FileCache,
    host: HostServices,
    languageId: string,
    command: string,
    args: Array<string>,
    spawnOptions: Object = {},
    projectRoot: string,
    fileExtensions: Array<string>,
    initializationOptions: Object,
  ) {
    this._logger = logger;
    this._fileCache = fileCache;
    this._masterHost = host;
    this._host = host;
    this._projectRoot = projectRoot;
    this._languageId = languageId;
    this._command = command;
    this._args = args;
    this._spawnOptions = spawnOptions;
    this._fileExtensions = fileExtensions;
    this._initializationOptions = initializationOptions;
  }

  dispose(): void {
    this._stop().catch(_ => {}).then(_ => this._masterHost.dispose());
  }

  _setState(
    state: State,
    actionRequiredDialogMessage?: string,
    existingDialogToDismiss?: rxjs$ISubscription,
  ): void {
    this._state = state;
    this._stateIndicator.dispose();
    const nextDisposable = new UniversalDisposable();
    this._stateIndicator = nextDisposable;

    if (state === 'Initial' || state === 'Running') {
      // No user indication needed for either state.
      // In the case of 'Initial', that's because the only times we get
      // in this state is when we're about to call start().
    } else if (state === 'Starting' || state === 'Stopping') {
      // Show a progress spinner
      const tooltip =
        state === 'Starting'
          ? `Starting ${this._languageId} language service...`
          : `Stopping ${this._languageId} language service...`;
      this._masterHost.showProgress(tooltip).then(progress => {
        if (nextDisposable.disposed) {
          progress.dispose();
        } else {
          nextDisposable.add(progress);
        }
      });
    } else if (state === 'StartFailed' || state === 'Stopped') {
      // StartFailed is when we failed to spawn the language server
      // Stopped is when the JsonRPC transport has been erroring,
      // or when the connection has been closed too many times and we give up.

      const tooltip =
        state === 'StartFailed'
          ? `Failed to start ${this._languageId} - click to retry.`
          : `Crash in ${this._languageId} - click to restart.`;
      const defaultMessage =
        state === 'StartFailed'
          ? `Failed to start ${this._languageId} language service.`
          : `Language service ${this._languageId} has crashed.`;
      const button = state === 'StartFailed' ? 'Retry' : 'Restart';
      // flowlint-next-line sketchy-null-string:off
      const message = actionRequiredDialogMessage || defaultMessage;

      const subscription = this._masterHost
        .showActionRequired(tooltip, {clickable: true})
        .refCount()
        .switchMap(_ => {
          if (existingDialogToDismiss != null) {
            existingDialogToDismiss.unsubscribe();
          }
          return this._masterHost
            .dialogRequest('error', message, [button], 'Close')
            .refCount();
        })
        .subscribe(dialogResponse => {
          if (dialogResponse !== button) {
            return;
          }
          // Note that if a new state had come along, that would have
          // unsubscribed nextDisposable, which would (1) dismiss the action-
          // required indicator, (2) dismiss the dialogRequest. The fact that
          // we're here now means that this has not happened, i.e. a new state
          // has not come along.
          this._masterHost.consoleNotification(
            this._languageId,
            'info',
            `Restarting ${this._languageId}`,
          );
          this._setState('Initial');
          this.start();
        });
      nextDisposable.add(subscription);
    } else {
      (state: empty);
      invariant(false, 'unreachable state');
    }
  }

  async start(): Promise<void> {
    invariant(this._state === 'Initial');
    this._setState('Starting');

    const startTimeMs = Date.now();
    const spawnCommandForLogs = `${this._command} ${this._args.join(' ')}`;

    try {
      const perConnectionDisposables = new UniversalDisposable();
      // The various resources+subscriptions associated with a LspConnection
      // are stored in here. When you call _lspConnection.dispose(), it
      // disposes of all of them (via the above perConnectionDisposables),
      // and also sets _lspConnection and other per-connection fields to null
      // so that any attempt to use them will throw an exception.

      // Each connection gets its own 'host' object, as an easy way to
      // get rid of all outstanding busy-signals and notifications and
      // dialogs from that connection.
      this._host = await forkHostServices(this._masterHost, this._logger);
      perConnectionDisposables.add(() => {
        this._host.dispose();
        this._host = this._masterHost;
      });

      // Error reporting? We'll be catching+reporting errors at each layer:
      // 1. operating system support for launch the process itself
      // 2. stdout/stderr sitting on top of that
      // 3. jsonrpc on top of that
      // 4. lsp on top of that

      let childProcess;
      try {
        this._logger.info(`Spawn: ${spawnCommandForLogs}`);
        if (this._command === '') {
          throw new Error('No command provided for launching language server');
          // if we try to spawn an empty command, node itself throws a "bad
          // type" error, which is jolly confusing. So we catch it ourselves.
        }
        const childProcessStream = spawn(this._command, this._args, {
          cwd: this._projectRoot,
          ...this._spawnOptions,
          killTreeWhenDone: true,
        }).publish();
        // disposing of the stream will kill the process, if it still exists
        const processPromise = childProcessStream.take(1).toPromise();
        perConnectionDisposables.add(childProcessStream.connect());
        childProcess = await processPromise;
        // if spawn failed to launch it, this await will throw.
      } catch (e) {
        this._logLspException(e);
        track('lsp-start', {
          status: 'spawn failed',
          spawn: spawnCommandForLogs,
          message: e.message,
          stack: e.stack,
          timeTakenMs: Date.now() - startTimeMs,
        });

        const message =
          `Couldn't start ${this._languageId} server` +
          ` - ${this._errorString(e, this._command)}`;
        const dialog = this._host
          .dialogNotification('error', message)
          .refCount()
          .subscribe();
        this._setState('StartFailed', message, dialog);
        return;
      }

      const isVerbose = await passesGK('nuclide_lsp_verbose');

      // The JsonRPC layer doesn't report what happened on stderr/stdout in
      // case of an error, so we'll pick it up directly. CARE! Node has
      // three means of consuming a stream, and it will crash if you mix them.
      // Our JsonRPC library uses the .pipe() means, so we have to too.
      // Semantics: a null value for stdout means "don't collect further output
      // because we've established that the connection is JsonRPC".
      this._childOut = {stdout: '', stderr: ''};
      const accumulate = (streamName: 'stdout' | 'stderr', data: string) => {
        if (
          this._childOut[streamName] != null &&
          this._childOut[streamName].length < 600
        ) {
          const s = (this._childOut[streamName] + data).substr(0, 600);
          this._childOut[streamName] = s;
        }
      };
      childProcess.stdout.pipe(through(data => accumulate('stdout', data)));
      childProcess.stderr.pipe(through(data => accumulate('stderr', data)));

      const jsonRpcConnection: JsonRpcConnection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(childProcess.stdout),
        new rpc.StreamMessageWriter(childProcess.stdin),
        new JsonRpcLogger(this._logger),
      );
      if (isVerbose) {
        jsonRpcConnection.trace(
          JsonRpcTrace.Verbose,
          new JsonRpcTraceLogger(this._logger),
        );
      }

      // We assign _lspConnection and wire up the handlers before calling
      // initialize, because any of these events might fire before initialize
      // has even returned.
      this._lspConnection = new LspConnection(jsonRpcConnection);
      this._lspConnection.onDispose(
        perConnectionDisposables.dispose.bind(perConnectionDisposables),
      );
      perConnectionDisposables.add(() => {
        this._lspConnection = ((null: any): LspConnection);
        // cheating here: we're saying "no thank you" to compile-time warnings
        // that _lspConnection might be invalid (since they're too burdensome)
        // but "yes please" to runtime exceptions.
      });

      const perConnectionUpdates = new Subject();
      perConnectionDisposables.add(
        perConnectionUpdates.complete.bind(perConnectionUpdates),
      );
      jsonRpcConnection.onError(this._handleError.bind(this));
      jsonRpcConnection.onClose(this._handleClose.bind(this));
      // Following handlers all set _childOut.stdout to null, to indicate
      // that we've established that the output is JsonRPC, and so any raw
      // text content in stdout should NOT be used directly in error messages.
      this._lspConnection.onTelemetryNotification(params => {
        this._childOut.stdout = null;
        this._handleTelemetryNotification(params);
      });
      this._lspConnection.onLogMessageNotification(params => {
        this._childOut.stdout = null;
        this._handleLogMessageNotification(params);
      });
      this._lspConnection.onShowMessageNotification(params => {
        this._childOut.stdout = null;
        this._handleShowMessageNotification(params);
      });
      this._lspConnection.onShowMessageRequest(async (params, cancel) => {
        this._childOut.stdout = null;
        return this._handleShowMessageRequest(params, cancel);
      });
      this._lspConnection.onProgressNotification(params => {
        this._childOut.stdout = null;
        return this._handleProgressNotification(params);
      });
      this._lspConnection.onActionRequiredNotification(params => {
        this._childOut.stdout = null;
        return this._handleActionRequiredNotification(params);
      });
      this._lspConnection.onApplyEditRequest(async (params, cancel) => {
        this._childOut.stdout = null;
        return this._handleApplyEditRequest(params, cancel);
      });
      this._lspConnection.onDiagnosticsNotification(params => {
        this._childOut.stdout = null;
        perConnectionUpdates.next(params);
      });

      await new Promise(process.nextTick);
      this._diagnosticUpdates.next(perConnectionUpdates);
      // CARE! to avoid a race, we guarantee that we've yielded back
      // to our caller before firing this next() and before sending any
      // diagnostic updates down it. That lets our caller subscribe in time.
      // Why this delicate? Because we don't want to buffer diagnostics, and we
      // don't want to lose any of them.
      // CARE! to avoid a different race, we await for the next tick only after
      // signing up all our handlers.

      this._logger.info('Establishing JsonRPC connection...');
      jsonRpcConnection.listen();

      const capabilities: ClientCapabilities = {
        workspace: {
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true,
          },
          didChangeConfiguration: {
            dynamicRegistration: false,
          },
          didChangeWatchedFiles: {
            dynamicRegistration: false,
          },
          symbol: {
            dynamicRegistration: false,
          },
          executeCommand: {
            dynamicRegistration: false,
          },
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: false,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
            },
          },
          hover: {
            dynamicRegistration: false,
          },
          signatureHelp: {
            dynamicRegistration: false,
          },
          references: {
            dynamicRegistration: false,
          },
          documentHighlight: {
            dynamicRegistration: false,
          },
          documentSymbol: {
            dynamicRegistration: false,
          },
          formatting: {
            dynamicRegistration: false,
          },
          rangeFormatting: {
            dynamicRegistration: false,
          },
          onTypeFormatting: {
            dynamicRegistration: false,
          },
          definition: {
            dynamicRegistration: false,
          },
          codeAction: {
            dynamicRegistration: false,
          },
          codeLens: {
            dynamicRegistration: false,
          },
          documentLink: {
            dynamicRegistration: false,
          },
          rename: {
            dynamicRegistration: false,
          },
        },
        window: {
          progress: {
            dynamicRegistration: false,
          },
          actionRequired: {
            dynamicRegistration: false,
          },
        },
      };

      const params: InitializeParams = {
        processId: process.pid,
        rootPath: this._projectRoot,
        rootUri: convert.localPath_lspUri(this._projectRoot),
        capabilities,
        initializationOptions: this._initializationOptions,
        trace: isVerbose ? 'verbose' : 'off',
      };

      // We'll keep sending initialize requests until it either succeeds
      // or the user says to stop retrying. This while loop will be potentially
      // long-running since in the case of failure it awaits for the user to
      // click a dialog button.
      let userRetryCount = 0;
      let initializeTimeTakenMs = 0;
      while (true) {
        let initializeResponse;
        try {
          this._logger.info('Lsp.Initialize');
          userRetryCount++;
          const initializeStartTimeMs = Date.now();
          // eslint-disable-next-line no-await-in-loop
          initializeResponse = await this._lspConnection.initialize(params);
          initializeTimeTakenMs = Date.now() - initializeStartTimeMs;
          // We might receive an onError or onClose event at this time too.
          // Those are handled by _handleError and _handleClose methods.
          // If those happen, then the response to initialize will never arrive,
          // so the above await will block until we finally dispose of the
          // connection.
        } catch (e) {
          this._logLspException(e);
          track('lsp-start', {
            status: 'initialize failed',
            spawn: spawnCommandForLogs,
            message: e.message,
            stack: e.stack,
            timeTakenMs: Date.now() - startTimeMs,
            userRetryCount,
          });

          // CARE! Inside any exception handler of an rpc request,
          // the lspConnection might already have been torn down.

          const offerRetry = e.data != null && Boolean(e.data.retry);
          const msg = `Couldn't initialize ${this
            ._languageId} server - ${this._errorString(e)}`;
          this._childOut = {stdout: '', stderr: ''};
          if (!offerRetry) {
            this._host.dialogNotification('error', msg).refCount().subscribe();
          } else {
            // eslint-disable-next-line no-await-in-loop
            const button = await this._host
              .dialogRequest('error', msg, ['Retry'], 'Close')
              .refCount()
              .toPromise();
            if (button === 'Retry') {
              this._host.consoleNotification(
                this._languageId,
                'info',
                `Retrying ${this._command}`,
              );
              if (this._lspConnection != null) {
                continue;
                // Retry will re-use the same this._lspConnection,
                // assuming it hasn't been torn down for whatever reason.
              }
            }
          }
          if (this._lspConnection != null) {
            this._lspConnection.dispose();
          }
          return;
        }

        // If the process wrote to stderr but succeeded to initialize, we'd
        // also like to log that. It was probably informational not error.
        if (this._childOut.stderr !== '') {
          this._host.consoleNotification(
            this._languageId,
            'info',
            this._childOut.stderr,
          );
        }

        // We'll reset _childOut now: stdout will become null because we've
        // established that the process speaks JsonRPC, and so will deliver
        // everything in JsonRPC messages, and so we never want to report
        // errors with the raw text of stdout; stderr will become empty because
        // we've already reported everything so far.
        this._childOut = {stdout: null, stderr: ''};

        this._serverCapabilities = initializeResponse.capabilities;
        this._derivedServerCapabilities = new DerivedServerCapabilities(
          this._serverCapabilities,
          this._logger,
        );
        perConnectionDisposables.add(() => {
          this._serverCapabilities = ((null: any): ServerCapabilities);
          this._derivedServerCapabilities = ((null: any): DerivedServerCapabilities);
        });

        this._logger.info('Lsp state=Running!');
        this._setState('Running');
        // At this point we're good to call into LSP.

        // CARE! Don't try to hook up file-events until after we're already
        // good to send them to LSP.
        this._lspFileVersionNotifier = new FileVersionNotifier();
        perConnectionDisposables.add(this._subscribeToFileEvents(), () => {
          this._lspFileVersionNotifier = ((null: any): FileVersionNotifier);
        });

        track('lsp-start', {
          status: 'ok',
          spawn: spawnCommandForLogs,
          timeTakenMs: Date.now() - startTimeMs,
          initializeTimeTakenMs,
        });

        return;
      }
    } catch (e) {
      // By this stage we've already handled+recovered from exceptions
      // gracefully around every external operation - spawning, speaking lsp
      // over jsonrpc, sending the initialize message. If an exception fell
      // through then it's an internal logic error.
      // Don't know how to recover.
      this._logger.error(`Lsp.start - unexpected error ${e}`);
      track('lsp-start', {
        status: 'start failed',
        spawn: spawnCommandForLogs,
        message: e.message,
        stack: e.stack,
        timeTakenMs: Date.now() - startTimeMs,
      });
      throw e;
    } finally {
      this._supportsSymbolSearch.next(
        this._serverCapabilities != null &&
          Boolean(this._serverCapabilities.workspaceSymbolProvider),
      );
    }
  }

  _subscribeToFileEvents(): rxjs$Subscription {
    // This code's goal is to keep the LSP process aware of the current status of opened
    // files. Challenge: LSP has no insight into fileversion: it relies wholly upon us
    // to give a correct sequence of versions in didChange events and can't even verify them.
    //
    // The _lspFileVersionNotifier tracks which fileversion we've sent downstream to LSP so far.
    //
    // The _fileCache tracks our upstream connection to the Nuclide editor, and from that
    // synthesizes a sequential consistent stream of Open/Edit/Close events.
    // If the (potentially flakey) connection temporarily goes down, the _fileCache
    // recovers, resyncs, and synthesizes for us an appropriate whole-document Edit event.
    // Therefore, it's okay for us to simply send _fileCache's sequential stream of edits
    // directly on to the LSP server.
    //
    // Note: if the LSP encounters an internal error responding to one of these notifications,
    // then it will be out of sync. JsonRPC doesn't allow for notifications to have
    // responses. So all we can do is trust the LSP server to terminate itself it
    // it encounters a problem.
    return (
      this._fileCache
        .observeFileEvents()
        // The "observeFileEvents" will first send an 'open' event for every
        // already-open file, and after that it will give live updates.
        // TODO: Filter on projectRoot
        .filter(fileEvent => {
          const fileExtension = nuclideUri.extname(
            fileEvent.fileVersion.filePath,
          );
          return this._fileExtensions.indexOf(fileExtension) !== -1;
        })
        .subscribe(fileEvent => {
          invariant(fileEvent.fileVersion.notifier === this._fileCache);
          // This invariant just self-documents that _fileCache is asked on observe file
          // events about fileVersions that themselves point directly back to the _fileCache.
          // (It's a convenience so that folks can pass around just a fileVersion on its own.)

          // TODO: if LSP responds with error to any of the file events, then we'll become
          // out of sync, and we must stop. (potentially restart).
          switch (fileEvent.kind) {
            case FileEventKind.OPEN:
              this._fileOpen(fileEvent);
              break;
            case FileEventKind.CLOSE:
              this._fileClose(fileEvent);
              break;
            case FileEventKind.EDIT:
              this._fileEdit(fileEvent);
              break;
            default:
              this._logger.error(
                'Unrecognized fileEvent ' + JSON.stringify(fileEvent),
              );
          }
          this._lspFileVersionNotifier.onEvent(fileEvent);
        })
    );
  }

  async _stop(): Promise<void> {
    if (this._state === 'Stopping' || this._state === 'Stopped') {
      return;
    }
    if (this._lspConnection == null) {
      this._setState('Stopped');
      return;
    }

    this._setState('Stopping');
    try {
      // Request the server to close down. It will respond when it's done,
      // but it won't actually terminate its stdin/stdout/process (since if
      // it did then we might not get the respone!)
      await this._lspConnection.shutdown();
      // Now we can let the server terminate:
      this._lspConnection.exit();
    } catch (e) {
      this._logLspException(e);
    }
    this._lspConnection.dispose();
    // Thanks to this dispose(), any outstanding requests will now fail.
    // (If we didn't dispose, then they'd be stuck indefinitely).
    // The dispose handler also resets _lspConnection to null.

    this._setState('Stopped');
  }

  _errorString(error: any, command?: ?string): string {
    let msg;

    if (error.message != null) {
      msg = error.message;
      // works for Javascript Error objects, and for LSP ResponseError objects
    } else {
      msg = String(error);
    }

    // In some places (like errors reported while attempting to spawn the
    // process) it's useful to report the command we tried to spawn. The caller
    // will indicate we should report it by passing 'command' argument.
    // In some cases like ENOENT coming out of childProcess 'error' event,
    // the path is included in the error message, so we refrain from adding it.
    // In others like EACCESs, the path isn't, so we add it ourselves:
    if (command != null && command !== '' && !msg.includes(command)) {
      msg = `${command} - ${msg}`;
    }

    // If the error was a well-formed JsonRPC error, then there's no reason to
    // include stdout: all the contents of stdout are presumably already in
    // the ResponseError object. Otherwise we should include stdout.
    if (
      !(error instanceof rpc.ResponseError) &&
      this._childOut.stdout != null &&
      this._childOut.stdout !== ''
    ) {
      msg = `${msg} - ${this._childOut.stdout}`;
    }

    // But we'll always want to show stderr stuff if there was any.
    if (this._childOut.stderr !== '') {
      msg = `${msg} - ${this._childOut.stderr}`;
    }

    return msg;
  }

  _logLspException(e: Error): void {
    track('lsp-exception', {
      message: e.message,
      stack: e.stack,
      remoteStack: e.data != null && e.data.stack != null ? e.data.stack : null,
      state: this._state,
      code: typeof e.code === 'number' ? e.code : null,
    });

    if (
      e.code != null &&
      Number(e.code) === ErrorCodes.RequestCancelled &&
      this._state === 'Running'
    ) {
      // RequestCancelled is normal and shouldn't be logged.
      return;
    }
    let msg = `${this._errorString(e)}\nSTATE=${this._state}`;
    if (e.data != null && e.data.stack != null) {
      msg += `\n  LSP STACK:\n${String(e.data.stack)}`;
    }
    msg += `\n  NUCLIDE STACK:\n${e.stack}`;
    this._logger.error(msg);
  }

  _handleError(data: [Error, ?Object, ?number]): void {
    if (this._state === 'Stopping' || this._state === 'Stopped') {
      return;
    }

    // CARE! This method may be called before initialization has finished.
    const [error, message, count] = data;
    // 'message' and 'count' are only provided on writes that failed.
    // Count is how many writes total have failed over this jsonRpcConnection.
    // Message is the JsonRPC object we were trying to write.
    if (message != null && count != null) {
      this._logger.error(
        `Lsp.JsonRpc.${String(
          error,
        )} - ${count} errors so far - ${JSON.stringify(message)}`,
      );
    } else {
      this._logger.error(`Lsp.JsonRpc.${String(error)}`);
    }
    if (count != null && count <= 3) {
      return;
    }
    this._host
      .dialogNotification(
        'error',
        `Connection to the ${this
          ._languageId} language server is erroring; shutting it down - ${this._errorString(
          error,
        )}`,
      )
      .refCount()
      .subscribe(); // fire and forget
    this._stop(); // method is awaitable, but we kick it off fire-and-forget.
  }

  _handleClose(): void {
    // CARE! This method may be called before initialization has finished.

    if (this._state === 'Stopping' || this._state === 'Stopped') {
      this._logger.info('Lsp.Close');
      return;
    }

    const prevState = this._state;
    this._setState('Stopped');
    if (this._lspConnection != null) {
      this._lspConnection.dispose();
    }

    // Should we restart or not? depends...
    if (prevState !== 'Running') {
      this._logger.error("Lsp.Close - wasn't running, so won't restart.");
      return;
    }
    const now = Date.now();
    this._recentRestarts.push(now);
    while (this._recentRestarts[0] < now - 3 * 60 * 1000) {
      this._recentRestarts.shift();
    }
    track('lsp-handle-close', {recentRestarts: this._recentRestarts.length});
    if (this._recentRestarts.length >= 5) {
      this._logger.error('Lsp.Close - will not auto-restart.');
      const message =
        `Language server '${this._languageId}' ` +
        'has crashed 5 times in the last 3 minutes.';
      const dialog = this._host
        .dialogRequest('error', message, ['Restart'], 'Close')
        .refCount()
        .subscribe(response => {
          if (response === 'Restart') {
            this._host.consoleNotification(
              this._languageId,
              'warning',
              `Restarting ${this._languageId}`,
            );
            this._setState('Initial');
            this.start();
          }
        });
      // We'll call _setState again, in the same 'Stopped' state, but this time
      // providing a message+dialog to tailor the action-required indicator,
      // including dismissing the above dialog if the user clicks the indicator
      // to pop up another restart dialog.
      this._setState('Stopped', message, dialog);
    } else {
      this._logger.error('Lsp.Close - will auto-restart');
      this._host.consoleNotification(
        this._languageId,
        'warning',
        `Automatically restarting ${this._languageId} after a crash`,
      );
      this._setState('Initial');
      this.start();
    }
  }

  _handleTelemetryNotification(params: any): void {
    // CARE! This method may be called before initialization has finished.

    // LSP doesn't specify the format of params. What we'll do is this:
    // if the params look like LogMessageParams then we'll log the message it
    // contains, otherwise we'll just log the entire params structure.
    if (
      typeof params.type === 'number' &&
      params.type >= 1 &&
      params.type <= 4 &&
      typeof params.message === 'string'
    ) {
      switch (params.type) {
        case LspMessageType.Log:
        case LspMessageType.Info:
          this._logger.info(`Lsp.telemetry: ${params.message}`);
          break;
        case LspMessageType.Warning:
          this._logger.warn(`Lsp.telemetry: ${params.message}`);
          break;
        case LspMessageType.Error:
        default:
          this._logger.error(`Lsp.telemetry: ${params.message}`);
      }
    } else {
      this._logger.info(`Lsp.telemetry: ${JSON.stringify(params)}`);
    }
  }

  _handleLogMessageNotification(params: LogMessageParams): void {
    // CARE! This method may be called before initialization has finished.
    this._host.consoleNotification(
      this._languageId,
      convert.lspMessageType_atomShowNotificationLevel(params.type),
      params.message,
    );
  }

  _handleShowMessageNotification(params: ShowMessageParams): void {
    // CARE! This method may be called before initialization has finished.
    this._host
      .dialogNotification(
        convert.lspMessageType_atomShowNotificationLevel(params.type),
        params.message,
      )
      .refCount()
      .subscribe(); // fire and forget
  }

  async _handleApplyEditRequest(
    params: ApplyWorkspaceEditParams,
    token: CancellationToken,
  ): Promise<ApplyWorkspaceEditResponse> {
    const applyEdits = async editsMap => {
      const applied = await this._host.applyTextEditsForMultipleFiles(editsMap);
      return {applied};
    };

    const {changes, documentChanges} = params.edit;
    if (documentChanges != null) {
      const fileVersions = await Promise.all(
        documentChanges.map(documentChange =>
          this._lspFileVersionNotifier.getVersion(
            convert.lspUri_localPath(documentChange.textDocument.uri),
          ),
        ),
      );
      const filesMatch = documentChanges.reduce(
        (filesMatchSoFar, documentChange, i) => {
          const {textDocument} = documentChange;
          return filesMatchSoFar && textDocument.version === fileVersions[i];
        },
        true,
      );
      if (filesMatch) {
        const editsMap = new Map(
          documentChanges.map(documentChange => [
            convert.lspUri_localPath(documentChange.textDocument.uri),
            convert.lspTextEdits_atomTextEdits(documentChange.edits || []),
          ]),
        );
        return applyEdits(editsMap);
      }
    } else if (changes != null) {
      const editsMap: Map<NuclideUri, Array<TextEdit>> = new Map();
      Object.keys(changes).forEach(fileForChange => {
        editsMap.set(
          convert.lspUri_localPath(fileForChange),
          convert.lspTextEdits_atomTextEdits(changes[fileForChange]),
        );
      });
      return applyEdits(editsMap);
    }
    return {applied: false};
  }

  async _handleShowMessageRequest(
    params: ShowMessageRequestParams,
    token: CancellationToken,
  ): Promise<any> {
    // CARE! This method may be called before initialization has finished.

    const cancelIsRequested = Observable.bindCallback(
      token.onCancellationRequested.bind(token),
    )();
    const actions = params.actions || [];

    // LSP gives us just a list of titles e.g. ['Open', 'Retry']
    // Nuclide will display an 'X' close icon in addition to those whichever
    // will deliver the result 'null'. (similar to how VSCode works).
    const response = await this._host
      .dialogRequest(
        convert.lspMessageType_atomShowNotificationLevel(params.type),
        params.message,
        actions.map(action => action.title),
        '@@X@@', // a sentinel response forwhen user clicks "X"
      )
      .refCount()
      .takeUntil(cancelIsRequested)
      .toPromise();

    if (response === undefined) {
      // cancellation was requested (that's how takeUntil/toPromise works)
      return null;
    } else if (response === '@@X@@') {
      // user clicked the X icon
      return null;
    } else {
      // return whichever MessageActionItem corresponded to the click,
      const chosenAction = actions.find(action => action.title === response);
      invariant(chosenAction != null);
      return chosenAction;
    }
  }

  _handleProgressNotification(params: ProgressParams): void {
    // CARE! This method may be called before initialization has finished.

    // How do we deal with race conditions? For instance, if a volley of
    // progress updates come, how do we ensure that they're handled in
    // order? -- We store *promises* inside this._progressIndicators.
    // Every time we receive a request to update an indicator, we replace
    // the promise with a new chained promise that will only be completed
    // when the original is done and when the update is done.
    const indicatorPromise = this._progressIndicators.get(params.id);
    const label = params.label;
    if (label == null) {
      if (indicatorPromise != null) {
        indicatorPromise.then(indicator => indicator.dispose());
        this._progressIndicators.delete(params.id);
      }
    } else {
      const indicatorPromise2 =
        indicatorPromise == null
          ? this._host.showProgress(label)
          : indicatorPromise.then(indicator => {
              indicator.setTitle(label);
              return indicator;
            });
      this._progressIndicators.set(params.id, indicatorPromise2);
    }
  }

  _handleActionRequiredNotification(params: ActionRequiredParams): void {
    const oldIndicator = this._actionRequiredIndicators.get(params.id);
    if (oldIndicator != null) {
      oldIndicator.dispose();
      this._actionRequiredIndicators.delete(params.id);
    }
    if (params.label != null) {
      const newIndicator = new UniversalDisposable(
        this._host.showActionRequired(params.label).refCount().subscribe(),
      );
      this._actionRequiredIndicators.set(params.id, newIndicator);
    }
  }

  getRoot(): string {
    return this._projectRoot;
  }

  async tryGetBufferWhenWeAndLspAtSameVersion(
    fileVersion: FileVersion,
  ): Promise<?simpleTextBuffer$TextBuffer> {
    if (this._state !== 'Running') {
      return null;
    }

    // Await until we have received this exact version from the client.
    // (Might be null in the case the user had already typed further
    // before we got a chance to be called.)
    const buffer = await this._fileCache.getBufferAtVersion(fileVersion);
    invariant(buffer == null || buffer.changeCount === fileVersion.version);

    // Await until this exact version has been pushed to LSP too.
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      if (buffer != null) {
        // Invariant: LSP is never ahead of our fileCache.
        // Therefore it will eventually catch up.
        this._logger.error(
          'LSP.version - could not catch up to version=' + fileVersion.version,
        );
      }
      return null;
    }

    // During that second await, if the server received further edits from the client,
    // then the buffer object might have been mutated in place, so its file-verion will
    // no longer match. In this case we return null.
    return buffer != null && buffer.changeCount === fileVersion.version
      ? buffer
      : null;
  }

  _fileOpen(fileEvent: FileOpenEvent): void {
    invariant(this._state === 'Running');
    invariant(this._lspConnection != null);
    if (!this._derivedServerCapabilities.serverWantsOpenClose) {
      return;
    }
    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
        languageId: this._languageId,
        version: fileEvent.fileVersion.version,
        text: fileEvent.contents,
      },
    };
    this._lspConnection.didOpenTextDocument(params);
  }

  _fileClose(fileEvent: FileCloseEvent): void {
    invariant(this._state === 'Running');
    invariant(this._lspConnection != null);
    if (!this._derivedServerCapabilities.serverWantsOpenClose) {
      return;
    }
    const params: DidCloseTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
      },
    };
    this._lspConnection.didCloseTextDocument(params);
  }

  _fileEdit(fileEvent: FileEditEvent): void {
    invariant(this._state === 'Running');
    invariant(this._lspConnection != null);
    let contentChange: TextDocumentContentChangeEvent;
    switch (this._derivedServerCapabilities.serverWantsChange) {
      case 'incremental':
        contentChange = {
          range: convert.atomRange_lspRange(fileEvent.oldRange),
          text: fileEvent.newText,
        };
        break;
      case 'full':
        const buffer = this._fileCache.getBufferForFileEdit(fileEvent);
        contentChange = {
          text: buffer.getText(),
        };
        break;
      case 'none':
        return;
      default:
        invariant(false); // unreachable
    }

    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
        version: fileEvent.fileVersion.version,
      },
      contentChanges: [contentChange],
    };
    this._lspConnection.didChangeTextDocument(params);
  }

  getDiagnostics(fileVersion: FileVersion): Promise<?DiagnosticProviderUpdate> {
    this._logger.error('Lsp: should observeDiagnostics, not getDiagnostics');
    return Promise.resolve(null);
  }

  observeDiagnostics(): ConnectableObservable<Array<FileDiagnosticMessages>> {
    // Note: this function can (and should!) be called even before
    // we reach state 'Running'.

    return this._diagnosticUpdates
      .mergeMap(perConnectionUpdates =>
        ensureInvalidations(
          this._logger,
          perConnectionUpdates.map(convert.lspDiagnostics_atomDiagnostics),
        ),
      )
      .publish();
  }

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    if (
      this._state !== 'Running' ||
      this._serverCapabilities.completionProvider == null ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }

    const activatedAutomaticallyOkay =
      request.triggerCharacter != null &&
      this._derivedServerCapabilities.completionTriggerCharacters.has(
        request.triggerCharacter,
      );
    if (!request.activatedManually && !activatedAutomaticallyOkay) {
      return null;
    }

    const params = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );

    let response;
    try {
      response = await this._lspConnection.completion(params);
      invariant(response != null, 'null textDocument/completion');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    const isIncomplete = Array.isArray(response)
      ? false
      : response.isIncomplete;
    const responseArray = Array.isArray(response) ? response : response.items;

    return {
      isIncomplete,
      items: responseArray.map(convert.lspCompletionItem_atomCompletion),
    };
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.definitionProvider ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const params = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );

    let response;
    try {
      response = await this._lspConnection.gotoDefinition(params);
      invariant(response != null, 'null textDocument/definition');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    // Since Nuclide hyperclick provider has an invariant that if getDefinition
    // returned an array then it's non-empty, LspLanguageService will detect and
    // return null an empty array response.
    if (Array.isArray(response) && response.length === 0) {
      return null;
    }

    const responseArray = Array.isArray(response) ? response : [response];

    return {
      // TODO: use wordAtPos to determine queryrange
      queryRange: [new atom$Range(position, position)],
      definitions: responseArray.map(d =>
        convert.lspLocation_atomDefinition(d, this._projectRoot),
      ),
    };
  }

  async findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.referencesProvider ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const buffer = await this._fileCache.getBufferAtVersion(fileVersion);
    // buffer may still be null despite the above check. We do handle that!

    const positionParams = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );
    const params = {...positionParams, context: {includeDeclaration: true}};
    // ReferenceParams is like TextDocumentPositionParams but with one extra field.

    let response;
    try {
      response = await this._lspConnection.findReferences(params);
      invariant(response != null, 'null textDocument/references');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    const references = response.map(convert.lspLocation_atomFoundReference);
    // This returns an array of Reference objects. Confusingly, each one has
    // property named 'uri', but it's really a local filePath.

    // We want to know the name of the symbol. The best we can do is reconstruct
    // this from the range of one (any) of the references we got back. We're only
    // willing to do this for references in files already in the filecache, but
    // thanks to includeDeclaration:true then the file where the user clicked will
    // assuredly be in the cache!
    let referencedSymbolName = null;
    // The very best we can do is if we and LSP were in sync at the moment the
    // request was dispatched, and buffer still hasn't been modified since then,
    // so we can guarantee that the ranges returned by LSP are identical
    // to what we have in hand.
    if (buffer != null) {
      const refInBuffer = references.find(
        ref => ref.uri === fileVersion.filePath,
      );
      if (refInBuffer != null) {
        referencedSymbolName = buffer.getTextInRange(refInBuffer.range);
      }
    }
    // Failing that, if any of the buffers are open we'll use them (even if we
    // have no guarantees about which version our buffers are at compared to
    // the ranges that LSP sent us back, so it might be a little off.)
    if (referencedSymbolName == null) {
      for (const ref of references) {
        const refBuffer = this._fileCache.getBuffer(ref.uri);
        if (refBuffer != null) {
          referencedSymbolName = refBuffer.getTextInRange(ref.range);
          break;
        }
      }
    }
    // Failing that we'll try using a regexp on the buffer. (belt and braces!)
    if (referencedSymbolName == null && buffer != null) {
      const WORD_REGEX = /\w+/gi;
      const match = wordAtPositionFromBuffer(buffer, position, WORD_REGEX);
      if (match != null && match.wordMatch.length > 0) {
        referencedSymbolName = match.wordMatch[0];
      }
    }
    // Failing that ...
    if (referencedSymbolName == null) {
      referencedSymbolName = 'symbol';
    }

    return {
      type: 'data',
      baseUri: this._projectRoot,
      referencedSymbolName,
      references,
    };
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.typeCoverageProvider
    ) {
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(filePath),
    };

    let response;
    try {
      response = await this._lspConnection.typeCoverage(params);
      invariant(response != null, 'null textDocument/coverage');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    const convertUncovered = (uncovered: UncoveredRange) => ({
      range: convert.lspRange_atomRange(uncovered.range),
      message: uncovered.message,
    });
    return {
      percentage: response.coveredPercent,
      uncoveredRegions: response.uncoveredRanges.map(convertUncovered),
    };
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.documentSymbolProvider ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
    };

    let response;
    try {
      response = await this._lspConnection.documentSymbol(params);
      invariant(response != null, 'null textDocument/documentSymbol');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    // The response is a flat list of SymbolInformation, which has location+name+containerName.
    // We're going to reconstruct a tree out of them. This can't be done with 100% accuracy in
    // all cases, but it can be done accurately in *almost* all cases.

    // For each symbolInfo in the list, we have exactly one corresponding tree node.
    // We'll also sort the nodes in lexical order of occurrence in the source
    // document. This is useful because containers always come lexically before their
    // children. (This isn't a LSP guarantee; just a heuristic.)
    const list: Array<
      [SymbolInformation, OutlineTree],
    > = response.map(symbol => [
      symbol,
      {
        icon: convert.lspSymbolKind_atomIcon(symbol.kind),
        tokenizedText: convert.lspSymbolInformation_atomTokenizedText(symbol),
        startPosition: convert.lspPosition_atomPoint(
          symbol.location.range.start,
        ),
        children: [],
      },
    ]);
    list.sort(([, aNode], [, bNode]) =>
      aNode.startPosition.compare(bNode.startPosition),
    );

    // We'll need to look up for parents by name, so construct a map from names to nodes
    // of that name. Note: an undefined SymbolInformation.containerName means root,
    // but it's easier for us to represent with ''.
    const mapElements = list.map(([symbol, node]) => [symbol.name, node]);
    const map: Map<string, Array<OutlineTree>> = collect(mapElements);
    if (map.has('')) {
      this._logger.error(
        'Outline textDocument/documentSymbol returned an empty symbol name',
      );
    }

    // The algorithm for reconstructing the tree out of list items rests on identifying
    // an item's parent based on the item's containerName. It's easy if there's only one
    // parent of that name. But if there are multiple parent candidates, we'll try to pick
    // the one that comes immediately lexically before the item. (If there are no parent
    // candidates, we've been given a malformed item, so we'll just ignore it.)
    const root: OutlineTree = {
      plainText: '',
      startPosition: new Point(0, 0),
      children: [],
    };
    map.set('', [root]);
    for (const [symbol, node] of list) {
      const parentName = symbol.containerName || '';
      const parentCandidates = map.get(parentName);
      if (parentCandidates == null) {
        this._logger.error(
          `Outline textDocument/documentSymbol ${symbol.name} is missing container ${parentName}`,
        );
      } else {
        invariant(parentCandidates.length > 0);
        // Find the first candidate that's lexically *after* our symbol.
        const symbolPos = convert.lspPosition_atomPoint(
          symbol.location.range.start,
        );
        const iAfter = parentCandidates.findIndex(
          p => p.startPosition.compare(symbolPos) > 0,
        );
        if (iAfter === -1) {
          // No candidates after item? Then item's parent is the last candidate.
          parentCandidates[parentCandidates.length - 1].children.push(node);
        } else if (iAfter === 0) {
          // All candidates after item? That's an error! We'll arbitrarily pick first one.
          parentCandidates[0].children.push(node);
          this._logger.error(
            `Outline textDocument/documentSymbol ${symbol.name} comes after its container`,
          );
        } else {
          // Some candidates before+after? Then item's parent is the last candidate before.
          parentCandidates[iAfter - 1].children.push(node);
        }
      }
    }

    return {outlineTrees: root.children};
  }

  // Private API to send executeCommand requests to the server. Returns a
  // boolean indicating whether executing the command was successful.
  // This function will throw an error if the server isn't in a state to handle
  // the request, the server can't handle this type of request, or if the LSP
  // server throws its own exception (ex: an internal server error exception)
  async _executeCommand(command: string, args?: Array<any>): Promise<void> {
    if (this._state !== 'Running') {
      throw new Error(
        `${this._languageId} is not currently in a state to handle the request`,
      );
      // flowlint-next-line sketchy-null-mixed:off
    } else if (!this._serverCapabilities.executeCommandProvider) {
      throw new Error(`${this._languageId} cannot handle the request`);
    }
    try {
      await this._lspConnection.executeCommand({
        command,
        arguments: args,
      });
    } catch (e) {
      this._logLspException(e);
      // Rethrow the exception so the upsteam caller has access to the error message.
      throw e;
    }
  }

  async getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.codeActionProvider
    ) {
      return [];
    }

    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      range: convert.atomRange_lspRange(range),
      context: {
        diagnostics: arrayCompact(
          diagnostics.map(convert.atomDiagnostic_lspDiagnostic),
        ),
      },
    };

    let response;
    try {
      response = await this._lspConnection.codeAction(params);
    } catch (e) {
      this._logLspException(e);
      return [];
    }
    return response.map(command => {
      // This function, which will be called when the CodeAction is applied
      // by the user, returns Promise<void>. If the Promise is fulfilled, then
      // the CodeAction was successful. If unsuccessful, the Promise will be rejected
      // and the upstream caller (ex: a CodeAction UI package) should catch the
      // error and display it to the user in whatever way they think best.
      const applyFunc = async () => {
        await this._executeCommand(command.command, command.arguments);
      };
      return convert.lspCommand_atomCodeAction(command, applyFunc);
    });
  }

  async typeHint(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?TypeHint> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.hoverProvider ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const params = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );

    let response;
    try {
      this._hoverCancellation.cancel();
      this._hoverCancellation = new rpc.CancellationTokenSource();
      response = await this._lspConnection.hover(
        params,
        this._hoverCancellation.token,
      );
      invariant(response != null, 'null textDocument/hover');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    let hint = response.contents;
    if (Array.isArray(hint)) {
      hint = hint.length > 0 ? hint[0] : '';
      // TODO: render multiple hints at once with a thin divider between them
    }
    if (typeof hint === 'string') {
      // TODO: convert markdown to text
    } else {
      hint = hint.value;
      // TODO: colorize code if possible. (is hard without knowing its context)
    }

    let range = new atom$Range(position, position);
    if (response.range) {
      range = convert.lspRange_atomRange(response.range);
    }

    return hint ? {hint, range} : null;
  }

  async highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.documentHighlightProvider ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const params = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );

    let response;
    try {
      this._highlightCancellation.cancel();
      this._highlightCancellation = new rpc.CancellationTokenSource();
      response = await this._lspConnection.documentHighlight(
        params,
        this._highlightCancellation.token,
      );
      invariant(response != null, 'null textDocument/documentHighlight');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    const convertHighlight = highlight =>
      convert.lspRange_atomRange(highlight.range);
    return response.map(convertHighlight);
  }

  async formatSource(
    fileVersion: FileVersion,
    atomRange: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    if (this._state !== 'Running') {
      return null;
    }

    // In general, what should happen if we request a reformat but the user does typing
    // while we're waiting for the reformat results to be (asynchronously) delivered?
    // This is entirely handled by our upstream caller in CodeFormatManager.js which
    // verifies that the buffer's contents haven't changed between asking for reformat and
    // applying it; if they have, then it displays an error message to the user.
    // So: this function doesn't need to do any such verification itself.

    // But we do need the buffer, to know whether atomRange covers the whole document.
    // And if we can't get it for reasons of syncing, then we'll have to bail by reporting
    // the same error as that upstream caller.
    const buffer = await this.tryGetBufferWhenWeAndLspAtSameVersion(
      fileVersion,
    );
    if (buffer == null) {
      this._logger.error(
        'LSP.formatSource - buffer changed before we could format',
      );
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      options,
    };
    let response;

    // The user might have requested to format either some or all of the buffer.
    // And the LSP server might have the capability to format some or all.
    // We'll match up the request+capability as best we can...
    const canAll = Boolean(this._serverCapabilities.documentFormattingProvider);
    const canRange = Boolean(
      this._serverCapabilities.documentRangeFormattingProvider,
    );
    const wantAll = buffer.getRange().compare(atomRange) === 0;
    if (canAll && (wantAll || !canRange)) {
      try {
        response = await this._lspConnection.documentFormatting(params);
        invariant(response != null, 'null textDocument/documentFormatting');
      } catch (e) {
        this._logLspException(e);
        return null;
      }
    } else if (canRange) {
      // Range is exclusive, and Nuclide snaps it to entire rows. So range.start
      // is character 0 of the start line, and range.end is character 0 of the
      // first line AFTER the selection.
      const range = convert.atomRange_lspRange(atomRange);
      const params2 = {...params, range};
      try {
        response = await this._lspConnection.documentRangeFormatting(params2);
        invariant(
          response != null,
          'null textDocument/documentRangeFormatting',
        );
      } catch (e) {
        this._logLspException(e);
        return null;
      }
    } else {
      this._logger.error('LSP.formatSource - not supported by server');
      return null;
    }

    // As mentioned, the user might have done further typing during that 'await', but if so then
    // our upstream caller will catch it and report an error: no need to re-verify here.

    return convert.lspTextEdits_atomTextEdits(response);
  }

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    // A language service implements either formatSource or formatEntireFile,
    // and we should pick formatSource in our AtomLanguageServiceConfig.
    this._logger.error(
      'LSP CodeFormat providers should use formatEntireFile: false',
    );
    return Promise.resolve(null);
  }

  async formatAtPosition(
    fileVersion: FileVersion,
    point: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    const triggerCharacters = this._derivedServerCapabilities
      .onTypeFormattingTriggerCharacters;
    if (
      this._state !== 'Running' ||
      !triggerCharacters.has(triggerCharacter) ||
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      position: convert.atomPoint_lspPosition(point),
      ch: triggerCharacter,
      options,
    };

    let response;
    try {
      response = await this._lspConnection.documentOnTypeFormatting(params);
      invariant(response != null, 'null textDocument/documentOnTypeFormatting');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    return convert.lspTextEdits_atomTextEdits(response);
  }

  getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    this._logger.error('NYI: getEvaluationExpression');
    return Promise.resolve(null);
  }

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    return compact(this._supportsSymbolSearch).take(1).toPromise();
  }

  async symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    if (
      this._state !== 'Running' ||
      !this._serverCapabilities.workspaceSymbolProvider
    ) {
      return null;
    }
    const params = {query};

    let response;
    try {
      response = await this._lspConnection.workspaceSymbol(params);
      invariant(response != null, 'null workspace/symbol');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    return response.map(convert.lspSymbolInformation_atomSymbolResult);
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    this._logger.error('NYI: getProjectRoot');
    return Promise.resolve(null);
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    this._logger.error('NYI: isFileInProject');
    return Promise.resolve(false);
  }
}

class DerivedServerCapabilities {
  serverWantsOpenClose: boolean;
  serverWantsChange: 'full' | 'incremental' | 'none';

  onTypeFormattingTriggerCharacters: Set<string>;
  completionTriggerCharacters: Set<string>;

  constructor(capabilities: ServerCapabilities, logger: log4js$Logger) {
    let syncKind;

    // capabilities.textDocumentSync is either a number (protocol v2)
    // or an object (protocol v3) or absent (indicating no capabilities).
    const sync = capabilities.textDocumentSync;
    if (typeof sync === 'number') {
      this.serverWantsOpenClose = true;
      syncKind = sync;
    } else if (typeof sync === 'object') {
      this.serverWantsOpenClose = Boolean(sync.openClose);
      syncKind = Number(sync.change);
    } else {
      this.serverWantsOpenClose = false;
      syncKind = TextDocumentSyncKind.None;
      if (sync != null) {
        logger.error(
          'LSP - invalid capabilities.textDocumentSync from server: ' +
            JSON.stringify(sync),
        );
      }
    }

    // The syncKind is a number, supposed to fall in the TextDocumentSyncKind
    // enumeration, so we verify that here:
    if (syncKind === TextDocumentSyncKind.Full) {
      this.serverWantsChange = 'full';
    } else if (syncKind === TextDocumentSyncKind.Incremental) {
      this.serverWantsChange = 'incremental';
    } else if (syncKind === TextDocumentSyncKind.None) {
      this.serverWantsChange = 'none';
    } else {
      logger.error('LSP initialize: invalid TextDocumentSyncKind');
      this.serverWantsChange = 'none';
    }

    const onTypeFormattingSettings =
      capabilities.documentOnTypeFormattingProvider;
    if (onTypeFormattingSettings == null) {
      this.onTypeFormattingTriggerCharacters = new Set();
    } else {
      const {
        firstTriggerCharacter,
        moreTriggerCharacter,
      } = onTypeFormattingSettings;
      const triggerCharacters = [firstTriggerCharacter].concat(
        moreTriggerCharacter || [],
      );
      this.onTypeFormattingTriggerCharacters = new Set(triggerCharacters);
    }

    if (capabilities.completionProvider == null) {
      this.completionTriggerCharacters = new Set();
    } else {
      const lspChars = capabilities.completionProvider.triggerCharacters || [];
      const intrinsicChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(
        '',
      );
      this.completionTriggerCharacters = new Set(
        lspChars.concat(intrinsicChars),
      );
    }
  }
}

class JsonRpcLogger {
  _logger: log4js$Logger;

  constructor(logger: log4js$Logger) {
    this._logger = logger;
  }

  error(message: string): void {
    this._logger.error('Lsp.JsonRpc ' + message);
  }

  warn(message: string): void {
    this._logger.info('Lsp.JsonRpc ' + message);
  }

  info(message: string): void {
    this._logger.info('Lsp.JsonRpc ' + message);
  }

  log(message: string): void {
    this._logger.trace('Jsp.JsonRpc ' + message);
  }
}

class JsonRpcTraceLogger {
  _logger: log4js$Logger;

  constructor(logger: log4js$Logger) {
    this._logger = logger;
  }

  log(message: string, data: ?string): void {
    this._logger.info(
      `LSP.trace: ${message} ${(data || '').substring(0, 800)}`,
    );
  }
}
