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
import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {
  FileVersion,
  FileOpenEvent,
  FileCloseEvent,
  FileEditEvent,
  FileSaveEvent,
} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  FindReferencesReturn,
  RenameReturn,
  Outline,
  OutlineTree,
  CodeAction,
  SignatureHelp,
} from 'atom-ide-ui';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FileDiagnosticMap,
  FileDiagnosticMessage,
  FormatOptions,
  SymbolResult,
  Completion,
  CodeLensData,
  StatusData,
} from '../../nuclide-language-service/lib/LanguageService';
import type {
  HostServices,
  Progress,
} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';
import type {
  InitializeParams,
  ClientCapabilities,
  ServerCapabilities,
  PublishDiagnosticsParams,
  LogMessageParams,
  ShowMessageParams,
  ShowMessageRequestParams,
  ShowStatusParams,
  MessageActionItem,
  ProgressParams,
  ActionRequiredParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  DidCloseTextDocumentParams,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent,
  SymbolInformation,
  UncoveredRange,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
  Command,
  RegistrationParams,
  UnregistrationParams,
  DidChangeWatchedFilesRegistrationOptions,
  Registration,
  FileSystemWatcher,
  CompletionItem,
  DocumentFormattingParams,
} from './protocol';

import {WatchmanClient} from 'nuclide-watchman-helpers';
import {runCommand, getOriginalEnvironment} from 'nuclide-commons/process';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import {sleep, timeoutAfterDeadline} from 'nuclide-commons/promise';
import {stringifyError} from 'nuclide-commons/string';
import through from 'through';
import {fork, spawn} from 'nuclide-commons/process';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {arrayCompact, collect} from 'nuclide-commons/collection';
import {compact} from 'nuclide-commons/observable';
import SafeStreamMessageReader from 'nuclide-commons/SafeStreamMessageReader';
import {track} from 'nuclide-analytics';
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
import {MemoryLogger, SnapshotLogger} from '../../commons-node/memoryLogger';
import {
  ensureInvalidations,
  forkHostServices,
} from '../../nuclide-language-service-rpc';
import {mapAtomLanguageIdToVsCode} from './languageIdMap';
import {
  getLanguageSpecificCommand,
  middleware_handleDiagnostics,
} from './languageExtensions';
import {LspConnection} from './LspConnection';
import {
  ErrorCodes,
  TextDocumentSyncKind,
  MessageType as LspMessageType,
  WatchKind,
  FileChangeType,
  InsertTextFormat,
  TextDocumentSaveReason,
} from './protocol';

const WORD_REGEX = /\w+/gi;

type State =
  | 'Initial'
  | 'Starting'
  | 'StartFailed'
  | 'Running'
  | 'Stopping'
  | 'Stopped';

export type LspPreferences = {
  // Most LSP servers don't provide an API specifically for outlines, so we have to
  // fall back to textDocument/documentSymbols which provides a list of elements and
  // their range+containerName. If the LSP server happens to provide the range of the
  // entire symbol construct then we'll use that to reconstruct the tree, also
  // lighting up Nuclide's "hightlight-outline" and "breadcrumbs" features. But
  // if it only provides the range of the element identifier, then we'll have to
  // fall back to containerName to reconstruct the tree, losing out on those two features.
  // Default is 'range'
  reconstructOutlineStrategy?: 'range' | 'containerName',

  // See https://microsoft.github.io/language-server-protocol/specification#textDocument_formatting
  additionalFormattingOptions?: Map<string, any>,

  // Normally Nuclide will claim to the LSP server that it supports snippets,
  // even though its support is incomplete (in cases of TextEdits, and multiple
  // cursors). You can set this field to false to make Nuclide no longer make
  // that claim. (default true).
  snippetSupport?: boolean,
};

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
  _languageServerName: string;
  _command: string;
  _args: Array<string>;
  _spawnOptions: Object; // supplies the options for spawning a process
  _spawnWithFork: boolean;
  _fileExtensions: Array<string>;
  _logger: MemoryLogger;
  _snapshotter: SnapshotLogger;
  _underlyingLogger: log4js$Logger;
  _host: HostServices;
  _fileCache: FileCache; // tracks which fileversions we've received from Nuclide client
  _initializationOptions: Object;
  _additionalLogFilesRetentionPeriod: number;
  _useOriginalEnvironment: boolean;
  _lspPreferences: LspPreferences;

  // These fields reflect our own state.
  // (Most should be nullable types, but it's not worth the bother.)
  _state: BehaviorSubject<State> = new BehaviorSubject('Initial');
  _stateIndicator: UniversalDisposable = new UniversalDisposable();
  _progressIndicators: Map<string | number, Promise<Progress>> = new Map();
  _actionRequiredIndicators: Map<
    string | number,
    UniversalDisposable,
  > = new Map();

  _recentRestarts: Array<number> = [];
  _diagnosticUpdates: BehaviorSubject<
    Observable<PublishDiagnosticsParams>,
  > = new BehaviorSubject(Observable.empty());

  _statusClickPromise: Promise<?string> = Promise.resolve(null);
  _statusClickPromiseResolver: (?string) => void = _ => {};
  _statusCounter: number = 0;
  _statusUpdates: BehaviorSubject<StatusData> = new BehaviorSubject({
    kind: 'null',
  });

  _supportsSymbolSearch: BehaviorSubject<?boolean> = new BehaviorSubject(null);
  // Fields which become live inside start(), when we spawn the LSP process.
  // Disposing of the _lspConnection will dispose of all of them.
  _childOut: {stdout: ?string, stderr: string} = {stdout: '', stderr: ''};
  _lspConnection: LspConnection; // is really "?LspConnection"
  _childPid: ?number; // child process id
  // Fields which become live after we receive an initializeResponse:
  _serverCapabilities: ServerCapabilities;
  _derivedServerCapabilities: DerivedServerCapabilities;
  _lspFileVersionNotifier: FileVersionNotifier; // tracks which fileversions we've sent to LSP
  // Map from registered capability id's to disposable for unregistering
  _registeredCapabilities: Map<string, Promise<IDisposable>> = new Map();

  // Whenever we trigger a new request, we cancel the outstanding request, so
  // only one request of these types would be active at a time. Note that the
  // language server is free to ignore any cancellation request, so we could
  // still potentially have multiple outstanding requests of the same type.
  _hoverCancellation: rpc.CancellationTokenSource = new rpc.CancellationTokenSource();
  _highlightCancellation: rpc.CancellationTokenSource = new rpc.CancellationTokenSource();
  _definitionCancellation: rpc.CancellationTokenSource = new rpc.CancellationTokenSource();
  _autocompleteCancellation: rpc.CancellationTokenSource = new rpc.CancellationTokenSource();
  _outlineCancellation: rpc.CancellationTokenSource = new rpc.CancellationTokenSource();

  _disposables: UniversalDisposable = new UniversalDisposable();

  constructor(
    logger: log4js$Logger,
    fileCache: FileCache,
    host: HostServices,
    languageServerName: string,
    command: string,
    args: Array<string>,
    spawnOptions: Object = {},
    spawnWithFork: boolean = false,
    projectRoot: string,
    fileExtensions: Array<string>,
    initializationOptions: Object,
    additionalLogFilesRetentionPeriod: number,
    useOriginalEnvironment?: boolean = false,
    lspPreferences?: LspPreferences = {},
  ) {
    this._snapshotter = new SnapshotLogger(additionalLogFilesRetentionPeriod);
    this._logger = new MemoryLogger(logger, additionalLogFilesRetentionPeriod);
    this._underlyingLogger = logger;
    this._fileCache = fileCache;
    this._masterHost = host;
    this._host = host;
    this._projectRoot = projectRoot;
    this._languageServerName = languageServerName;
    this._command = command;
    this._args = args;
    this._spawnOptions = spawnOptions;
    this._spawnWithFork = spawnWithFork;
    this._fileExtensions = fileExtensions;
    this._initializationOptions = initializationOptions;
    this._additionalLogFilesRetentionPeriod = additionalLogFilesRetentionPeriod;
    this._useOriginalEnvironment = useOriginalEnvironment;
    this._lspPreferences = lspPreferences;
  }

  dispose(): void {
    this._stop()
      .catch(_ => {})
      .then(_ => {
        this._statusUpdates.complete();
        this._masterHost.dispose();
        this._snapshotter.dispose();
        this._logger.dispose();
        this._disposables.dispose();
      });
  }

  _getState(): State {
    return this._state.getValue();
  }

  _setState(
    state: State,
    actionRequiredDialogMessage?: string,
    existingDialogToDismiss?: rxjs$ISubscription,
  ): void {
    this._logger.trace(`State ${this._getState()} -> ${state}`);
    this._state.next(state);
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
          ? `Starting ${this._languageServerName} language service...`
          : `Stopping ${this._languageServerName} language service...`;
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
          ? `Failed to start ${this._languageServerName} - click to retry.`
          : `Crash in ${this._languageServerName} - click to restart.`;
      const defaultMessage =
        state === 'StartFailed'
          ? `Failed to start ${this._languageServerName} language service.`
          : `Language service ${this._languageServerName} has crashed.`;
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
            this._languageServerName,
            'info',
            `Restarting ${this._languageServerName}`,
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

  _showStatus(status: StatusData): Promise<?string> {
    // If someone had previously called 'await button = _showStatus(.)' to find
    // out which button the user clicked, but we end up switching state before
    // the user clicked a button, then we'll cause that prior button promise
    // to be resolved as 'null'
    this._statusClickPromiseResolver(null);
    this._statusClickPromise = new Promise((resolve, reject) => {
      this._statusClickPromiseResolver = resolve;
    });

    // red and yellow status updates are accompanied by an id to correlate statusClicks
    this._statusCounter++;
    const status2 =
      status.kind !== 'red' && status.kind !== 'yellow'
        ? status
        : {...status, id: String(this._statusCounter)};
    this._logger.trace(`_setStatus status: ${JSON.stringify(status2)}`);
    // $FlowIgnore: flow has trouble disambiguating the 'kind: red' and 'kind: yellow' variants
    this._statusUpdates.next(status2);

    return this._statusClickPromise;
  }

  async clickStatus(
    fileVersion: FileVersion,
    id: string,
    button: string,
  ): Promise<void> {
    if (id === String(this._statusCounter)) {
      this._statusClickPromiseResolver(button);
    } else {
      // The user might have clicked a button after we switched to a new status,
      // and the messages crossed in flight. In this case ignore the button
    }
  }

  observeStatus(fileVersion: FileVersion): ConnectableObservable<StatusData> {
    return this._statusUpdates.asObservable().publish();
  }

  async start(): Promise<void> {
    invariant(this._getState() === 'Initial');
    this._setState('Starting');
    const startTimeMs = Date.now();

    let command;
    try {
      if (this._command == null) {
        throw new Error('No command provided for launching language server');
        // if we try to spawn an empty command, node itself throws a "bad
        // type" error, which is jolly confusing. So we catch it ourselves.
      } else if (this._command.startsWith('{')) {
        command = await getLanguageSpecificCommand(
          this._projectRoot,
          JSON.parse(this._command),
        );
      } else {
        command = this._command;
      }
    } catch (e) {
      this._logLspException(e);
      track('lsp-start', {
        name: this._languageServerName,
        status: 'getCommand failed',
        command: this._command,
        message: e.message,
        stack: e.stack,
        timeTakenMs: Date.now() - startTimeMs,
      });

      const message =
        `Couldn't start ${this._languageServerName} server` +
        ` - ${this._errorString(e)}`;
      const dialog = this._masterHost
        .dialogNotification('error', message)
        .refCount()
        .subscribe();
      this._setState('StartFailed', message, dialog);
      return;
    }

    const spawnCommandForLogs = `${command} ${this._args.join(' ')}`;

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
      this._host = await forkHostServices(
        this._masterHost,
        this._underlyingLogger,
      );
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

        const lspSpawnOptions = {
          cwd: this._projectRoot,
          // Forked processes don't pipe stdio by default.
          stdio: this._spawnWithFork
            ? ['pipe', 'pipe', 'pipe', 'ipc']
            : undefined,
          ...this._spawnOptions,
          killTreeWhenDone: true,
        };

        if (this._useOriginalEnvironment) {
          // NodeJS is the one thing where we need to make sure to use Nuclide's
          // version.
          const originalEnvironment = await getOriginalEnvironment();
          const nodePath = nuclideUri.dirname(
            await runCommand('which', ['node']).toPromise(),
          );
          if (originalEnvironment.PATH) {
            originalEnvironment.PATH = `${nodePath}:${
              originalEnvironment.PATH
            }`;
          } else {
            this._logger.error('No path found in original environment.');
            originalEnvironment.PATH = nodePath;
          }

          // If they specify both useOriginalEnvironment and an env key in their
          // spawn options, merge them with the explicitly provided keys taking
          // precedence.
          lspSpawnOptions.env = {
            ...originalEnvironment,
            ...lspSpawnOptions.env,
          };
        } else if (lspSpawnOptions.env) {
          lspSpawnOptions.env = {
            ...process.env,
            ...lspSpawnOptions.env,
          };
        }

        const childProcessStream = this._spawnWithFork
          ? fork(command, this._args, lspSpawnOptions).publish()
          : spawn(command, this._args, lspSpawnOptions).publish();
        // disposing of the stream will kill the process, if it still exists
        const processPromise = childProcessStream.take(1).toPromise();
        perConnectionDisposables.add(childProcessStream.connect());
        // if spawn failed to launch it, this await will throw.
        childProcess = await processPromise;
        this._childPid = childProcess.pid;
      } catch (e) {
        this._logLspException(e);
        track('lsp-start', {
          name: this._languageServerName,
          status: 'spawn failed',
          spawn: spawnCommandForLogs,
          message: e.message,
          stack: e.stack,
          timeTakenMs: Date.now() - startTimeMs,
        });

        const message =
          `Couldn't start ${this._languageServerName} server` +
          ` - ${this._errorString(e, command)}`;
        const dialog = this._masterHost
          .dialogNotification('error', message)
          .refCount()
          .subscribe();
        this._setState('StartFailed', message, dialog);
        return;
      }

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
      if (childProcess.stderr != null) {
        childProcess.stderr.pipe(through(data => accumulate('stderr', data)));
      }

      const jsonRpcConnection: rpc.MessageConnection = rpc.createMessageConnection(
        new SafeStreamMessageReader(childProcess.stdout),
        new rpc.StreamMessageWriter(childProcess.stdin),
        new JsonRpcLogger(this._logger),
      );
      jsonRpcConnection.trace(
        rpc.Trace.Verbose,
        new JsonRpcTraceLogger(this._logger),
      );

      // We assign _lspConnection and wire up the handlers before calling
      // initialize, because any of these events might fire before initialize
      // has even returned.
      this._lspConnection = new LspConnection(
        jsonRpcConnection,
        this._languageServerName,
      );

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
      this._lspConnection.onShowStatusRequest(async (params, cancel) => {
        this._childOut.stdout = null;
        return this._handleStatusRequest(params, cancel);
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
        middleware_handleDiagnostics(
          params,
          this._languageServerName,
          this._host,
          this._showStatus.bind(this),
        );
        perConnectionUpdates.next(params);
      });
      this._lspConnection.onRegisterCapabilityRequest(params => {
        this._childOut.stdout = null;
        this._handleRegisterCapability(params);
      });
      this._lspConnection.onUnregisterCapabilityRequest(params => {
        this._childOut.stdout = null;
        this._handleUnregisterCapability(params);
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
            dynamicRegistration: true,
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
            willSaveWaitUntil: true,
            didSave: true,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              // True if LspPreferences.snippetSupport is not defined or
              // it's set to true.
              snippetSupport:
                this._lspPreferences.snippetSupport == null ||
                this._lspPreferences.snippetSupport,
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
          status: {
            dynamicRegistration: false,
          },
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
        trace: this._underlyingLogger.isLevelEnabled('TRACE')
          ? 'verbose'
          : 'off',
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
          this._logger.trace('Lsp.Initialize');
          userRetryCount++;
          const initializeStartTimeMs = Date.now();
          // eslint-disable-next-line no-await-in-loop
          initializeResponse = await this._lspConnection.initialize(params);
          initializeTimeTakenMs = Date.now() - initializeStartTimeMs;
          this._logger.trace('Lsp.Initialize.success');
          // We might receive an onError or onClose event at this time too.
          // Those are handled by _handleError and _handleClose methods.
          // If those happen, then the response to initialize will never arrive,
          // so the above await will block until we finally dispose of the
          // connection.
        } catch (e) {
          this._logger.trace('Lsp.Initialize.error');
          this._logLspException(e);
          track('lsp-start', {
            name: this._languageServerName,
            status: 'initialize failed',
            spawn: spawnCommandForLogs,
            message: e.message,
            stack: e.stack,
            timeTakenMs: Date.now() - startTimeMs,
            userRetryCount,
          });

          // CARE! Inside any exception handler of an rpc request,
          // the lspConnection might already have been torn down.

          this._childOut = {stdout: '', stderr: ''};
          const message = `Couldn't initialize ${
            this._languageServerName
          } server`;
          const longMessage = `${message} - ${this._errorString(e)}`;

          // LSP has the notion that only some failures-to-start should
          // offer a retry button; if the user clicks it then we send a second
          // initialize request over the existing connection.
          // Failing that, we have the fallback that for all crashes/failures
          // we always offer a retry button; clicking on it causes a complete
          // re-initialize from the start.
          const offerRetry = e.data != null && Boolean(e.data.retry);
          if (!offerRetry) {
            const dialog = this._masterHost
              .dialogNotification('error', longMessage)
              .refCount()
              .subscribe();
            this._setState('StartFailed', message, dialog);
            if (this._lspConnection != null) {
              this._lspConnection.dispose();
            }
            return;
          }

          // eslint-disable-next-line no-await-in-loop
          const button = await this._host
            .dialogRequest('error', message, ['Retry'], 'Close')
            .refCount()
            .toPromise();
          if (button === 'Retry') {
            this._logger.trace('Lsp.Initialize.retry');
            this._host.consoleNotification(
              this._languageServerName,
              'info',
              'Retrying initialize',
            );
            if (this._lspConnection != null) {
              this._logger.trace('Lsp.Initialize.retrying');
              continue;
              // Retry will re-use the same this._lspConnection,
              // assuming it hasn't been torn down for whatever reason.
            }
          }
          this._setState('StartFailed');
          if (this._lspConnection != null) {
            this._lspConnection.dispose();
          }

          return;
        }

        // If the process wrote to stderr but succeeded to initialize, we'd
        // also like to log that. It was probably informational not error.
        if (this._childOut.stderr !== '') {
          this._host.consoleNotification(
            this._languageServerName,
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
          name: this._languageServerName,
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
        name: this._languageServerName,
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
    // synthesizes a sequential consistent stream of Open/Edit/Close/Save events.
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
        .filter(fileEvent => {
          const fileExtension = nuclideUri.extname(
            fileEvent.fileVersion.filePath,
          );
          return (
            this._fileExtensions.indexOf(fileExtension) !== -1 &&
            this._isFileInProject(fileEvent.fileVersion.filePath)
          );
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
            case FileEventKind.SAVE:
              this._fileSave(fileEvent);
              break;
            default:
              (fileEvent.kind: empty);
              this._logger.error(
                'Unrecognized fileEvent ' + JSON.stringify(fileEvent),
              );
          }
          this._lspFileVersionNotifier.onEvent(fileEvent);
        })
    );
  }

  async _stop(): Promise<void> {
    this._logger.trace('Lsp._stop');
    if (this._getState() === 'Stopping' || this._getState() === 'Stopped') {
      return;
    }
    if (this._lspConnection == null) {
      this._setState('Stopped');
      return;
    }
    const mustShutdown = this._getState() === 'Running';

    this._setState('Stopping');
    try {
      if (mustShutdown) {
        // Request the server to close down. If it does reply, we can tell it
        // to 'exit' (i.e. terminate cleanly). If it fails to reply, well,
        // we won't get hung up on it.
        await Promise.race([this._lspConnection.shutdown(), sleep(30000)]);
        this._lspConnection.exit();
      }
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
      msg = `${command} [spawn] - ${msg}`;
    }

    // If the error was a well-formed JsonRPC error, then there's no reason to
    // include stdout: all the contents of stdout are presumably already in
    // the ResponseError object. Otherwise we should include stdout.
    if (
      !(error instanceof rpc.ResponseError) &&
      this._childOut.stdout != null &&
      this._childOut.stdout !== ''
    ) {
      msg = `${msg} - ${this._childOut.stdout} [stdout]`;
    }

    // But we'll always want to show stderr stuff if there was any.
    if (this._childOut.stderr !== '') {
      msg = `${msg} - ${this._childOut.stderr} [stderr]`;
    }

    return msg;
  }

  _logLspException(e: Error): void {
    // In case 'try {await p} catch (e) {logLspException(e);}', then e.stack is
    // shows who rejected that promise. We also want a stack for who awaited...
    const exceptionStack = e.stack;
    const callStack = new Error().stack;
    const remoteStack =
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      e.data != null && e.data.stack != null ? e.data.stack : null;

    track('lsp-exception', {
      name: this._languageServerName,
      message: e.message,
      exceptionStack,
      callStack,
      remoteStack,
      state: this._getState(),
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      code: typeof e.code === 'number' ? e.code : null,
    });

    // eslint-disable-next-line nuclide-internal/api-spelling
    if (this._isErrorRequestCancelled(e)) {
      // RequestCancelled is normal and shouldn't be logged.
      return;
    }
    let msg = `${this._errorString(e)}\nSTATE=${this._getState()}`;
    if (remoteStack != null) {
      msg += `\n  REMOTE STACK:\n${String(remoteStack)}`;
    }
    msg += `\n  EXCEPTION STACK:\n${exceptionStack}`;
    msg += `\n  CALL STACK:\n${callStack}`;
    this._logger.error(msg);
  }

  _handleError(data: [Error, Object, number]): void {
    this._logger.trace('Lsp._handleError');
    if (this._getState() === 'Stopping' || this._getState() === 'Stopped') {
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
        `Connection to the ${
          this._languageServerName
        } language server is erroring; shutting it down - ${this._errorString(
          error,
        )}`,
      )
      .refCount()
      .subscribe(); // fire and forget
    this._stop(); // method is awaitable, but we kick it off fire-and-forget.
  }

  // eslint-disable-next-line nuclide-internal/api-spelling
  _isErrorRequestCancelled(e: Error): void {
    return (
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      e.code != null &&
      // eslint-disable-next-line nuclide-internal/api-spelling
      Number(e.code) === ErrorCodes.RequestCancelled &&
      this._getState() === 'Running'
    );
  }

  _handleClose(): void {
    this._logger.trace('Lsp._handleClose');
    // CARE! This method may be called before initialization has finished.

    if (this._getState() === 'Stopping' || this._getState() === 'Stopped') {
      this._logger.info('Lsp.Close');
      return;
    }

    const prevState = this._getState();
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
    track('lsp-handle-close', {
      name: this._languageServerName,
      recentRestarts: this._recentRestarts.length,
    });
    if (this._recentRestarts.length >= 5) {
      this._logger.error('Lsp.Close - will not auto-restart.');
      const message =
        `Language server '${this._languageServerName}' ` +
        'has crashed 5 times in the last 3 minutes.';
      const dialog = this._host
        .dialogRequest('error', message, ['Restart'], 'Close')
        .refCount()
        .subscribe(response => {
          if (response === 'Restart') {
            this._host.consoleNotification(
              this._languageServerName,
              'warning',
              `Restarting ${this._languageServerName}`,
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
        this._languageServerName,
        'warning',
        `Automatically restarting ${this._languageServerName} after a crash`,
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
      this._languageServerName,
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
    token: rpc.CancellationToken,
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

  async _handleStatusRequest(
    params: ShowStatusParams,
    token: rpc.CancellationToken,
  ): Promise<?MessageActionItem> {
    // CARE! This method may be called before initialization has finished.
    const actions = params.actions || [];
    const status = convert.lspStatus_atomStatus(params);
    if (status == null) {
      return null;
    }

    const response = await this._showStatus(status);
    if (response == null) {
      return null;
    } else {
      const chosenAction = actions.find(action => action.title === response);
      invariant(chosenAction != null);
      return chosenAction;
    }
  }

  async _handleShowMessageRequest(
    params: ShowMessageRequestParams,
    token: rpc.CancellationToken,
  ): Promise<?MessageActionItem> {
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
        this._host
          .showActionRequired(params.label)
          .refCount()
          .subscribe(),
      );
      this._actionRequiredIndicators.set(params.id, newIndicator);
    }
  }

  _handleRegisterCapability(params: RegistrationParams): void {
    params.registrations.forEach(this._registerCapability);
  }

  _registerCapability = (registration: Registration): void => {
    if (this._registeredCapabilities.has(registration.id)) {
      this._logger.warn(
        'LSP.registerCapability - attempting to register already registered capability ' +
          registration.method +
          ' with id ' +
          registration.id,
      );
      return;
    }

    let disposable;

    switch (registration.method) {
      case 'workspace/didChangeWatchedFiles':
        disposable = this._registerDidChangeWatchedFiles(
          nullthrows(registration.registerOptions),
        );
        break;
      default:
        this._logger.warn(
          'LSP.registerCapability - attempting to register unsupported capability ' +
            registration.method,
        );
        return;
    }

    this._registeredCapabilities.set(registration.id, disposable);
  };

  async _registerDidChangeWatchedFiles(
    options: DidChangeWatchedFilesRegistrationOptions,
  ): Promise<IDisposable> {
    const watchmanClient = new WatchmanClient();
    const subscriptions = await Promise.all(
      options.watchers.map(watcher => {
        return this._subscribeWatcher(watcher, watchmanClient);
      }),
    );

    return new UniversalDisposable(watchmanClient, ...subscriptions);
  }

  async _subscribeWatcher(
    watcher: FileSystemWatcher,
    watchmanClient: WatchmanClient,
  ): Promise<IDisposable> {
    // Kind defaults to 7 according to LSP spec.
    const watcherKind = watcher.kind != null ? watcher.kind : 7;
    // Unique subscription name per watcher
    const subscriptionName =
      this._projectRoot + watcher.globPattern + watcherKind.toString();
    const subscriptionOptions = {
      expression: [
        'match',
        watcher.globPattern,
        'wholename',
        {includedotfiles: true},
      ],
    };
    // Get the set of file change types to care about, based on the bits set in
    // the watcher.kind bit field.
    const subscriptionTypes = new Set(
      [
        [WatchKind.Create, FileChangeType.Created],
        [WatchKind.Change, FileChangeType.Changed],
        [WatchKind.Delete, FileChangeType.Deleted],
      ]
        // eslint-disable-next-line no-bitwise
        .filter(([kind]) => (watcherKind & kind) !== 0)
        .map(([_, changeType]) => changeType),
    );

    const subscription = await watchmanClient.watchDirectoryRecursive(
      this._projectRoot,
      subscriptionName,
      subscriptionOptions,
    );

    return new UniversalDisposable(
      subscription,
      Observable.fromEvent(subscription, 'change').subscribe(fileChanges => {
        const fileEvents = fileChanges
          .map(fileChange =>
            convert.watchmanFileChange_lspFileEvent(
              fileChange,
              subscription.path,
            ),
          )
          .filter(fileEvent => subscriptionTypes.has(fileEvent.type));
        this._lspConnection.didChangeWatchedFiles({
          changes: fileEvents,
        });
      }),
    );
  }

  _handleUnregisterCapability(params: UnregistrationParams): void {
    params.unregisterations.forEach(unregistration => {
      if (!this._registeredCapabilities.has(unregistration.id)) {
        this._logger.warn(
          'LSP.unregisterCapability - attempting to unregister non-registered capability ' +
            unregistration.method +
            ' with id ' +
            unregistration.id,
        );
        return;
      }

      const disposable: Promise<IDisposable> = nullthrows(
        this._registeredCapabilities.get(unregistration.id),
      );
      this._registeredCapabilities.delete(unregistration.id);

      disposable.then(d => d.dispose());
    });
  }

  getRoot(): string {
    return this._projectRoot;
  }

  async tryGetBufferWhenWeAndLspAtSameVersion(
    fileVersion: FileVersion,
  ): Promise<?simpleTextBuffer$TextBuffer> {
    if (this._getState() !== 'Running') {
      return null;
    }

    // Await until we have received this exact version from the client.
    // (Might be null in the case the user had already typed further
    // before we got a chance to be called.)
    const buffer = await this._fileCache.getBufferAtVersion(fileVersion);
    invariant(buffer == null || buffer.changeCount === fileVersion.version);

    // Await until this exact version has been pushed to LSP too.
    if (
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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

  async _fileOpen(fileEvent: FileOpenEvent): Promise<void> {
    invariant(this._lspConnection != null);
    invariant(
      this._getState() === 'Running' || this._getState() === 'Stopping',
    );
    if (this._getState() !== 'Running') {
      return;
    }
    if (!this._derivedServerCapabilities.serverWantsOpenClose) {
      return;
    }

    let languageId = mapAtomLanguageIdToVsCode(fileEvent.languageId);
    if (languageId == null) {
      languageId = this._languageServerName;
      this._logger.warn(
        `Could not find a mapping for ${
          fileEvent.languageId
        }, falling back to ${languageId}.`,
      );
      track('language-server-no-mapping', {
        languageId: fileEvent.languageId,
      });
    } else {
      this._logger.info(`Mapped ${fileEvent.languageId} to ${languageId}.`);
    }

    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
        languageId,
        version: fileEvent.fileVersion.version,
        text: fileEvent.contents,
      },
    };
    this._lspConnection.didOpenTextDocument(params);
  }

  _fileClose(fileEvent: FileCloseEvent): void {
    invariant(this._lspConnection != null);
    invariant(
      this._getState() === 'Running' || this._getState() === 'Stopping',
    );
    if (this._getState() !== 'Running') {
      return;
    }
    if (!this._derivedServerCapabilities.serverWantsOpenClose) {
      return;
    }
    const params: DidCloseTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
      },
    };
    this._lspConnection.didCloseTextDocument(params);
    this._snapshotter.close(fileEvent.fileVersion.filePath);
  }

  _fileEdit(fileEvent: FileEditEvent): void {
    invariant(this._lspConnection != null);
    invariant(
      this._getState() === 'Running' || this._getState() === 'Stopping',
    );
    if (this._getState() !== 'Running') {
      return;
    }
    const buffer = this._fileCache.getBufferForFileEvent(fileEvent);
    this._snapshotter.snapshot(
      fileEvent.fileVersion.filePath,
      fileEvent.fileVersion.version,
      buffer,
    );
    let contentChange: TextDocumentContentChangeEvent;
    switch (this._derivedServerCapabilities.serverWantsChange) {
      case 'incremental':
        contentChange = {
          range: convert.atomRange_lspRange(fileEvent.oldRange),
          rangeLength: fileEvent.oldText.length,
          text: fileEvent.newText,
        };
        break;
      case 'full':
        contentChange = {text: buffer.getText()};
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

  _fileSave(fileEvent: FileSaveEvent): void {
    invariant(this._lspConnection != null);
    invariant(
      this._getState() === 'Running' || this._getState() === 'Stopping',
    );
    if (this._getState() !== 'Running') {
      return;
    }
    let text;
    switch (this._derivedServerCapabilities.serverWantsSave) {
      case 'none':
        return;
      case 'excludeText':
        text = null;
        break;
      case 'includeText':
        const buffer = this._fileCache.getBufferForFileEvent(fileEvent);
        text = buffer.getText();
        break;
      default:
        (this._derivedServerCapabilities.serverWantsSave: empty);
    }
    const params: DidSaveTextDocumentParams = {
      textDocument: {
        uri: convert.localPath_lspUri(fileEvent.fileVersion.filePath),
      },
      text,
    };
    this._lspConnection.didSaveTextDocument(params);
  }

  getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap> {
    this._logger.error('Lsp: should observeDiagnostics, not getDiagnostics');
    return Promise.resolve(null);
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap> {
    // Note: this function can (and should!) be called even before
    // we reach state 'Running'.

    return this._diagnosticUpdates
      .switchMap(perConnectionUpdates =>
        ensureInvalidations(
          this._underlyingLogger,
          perConnectionUpdates.map(diagnostics =>
            convert.lspDiagnostics_atomDiagnostics(
              diagnostics,
              this._languageServerName,
            ),
          ),
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
      this._getState() !== 'Running' ||
      this._serverCapabilities.completionProvider == null ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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
      this._autocompleteCancellation.cancel();
      this._autocompleteCancellation = new rpc.CancellationTokenSource();
      response = await this._lspConnection.completion(
        params,
        this._autocompleteCancellation.token,
      );
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
      items: responseArray.map(x =>
        convert.lspCompletionItem_atomCompletion(
          x,
          this._supportsAutocompleteResolve(),
        ),
      ),
    };
  }

  async resolveAutocompleteSuggestion(
    suggestion: Completion,
  ): Promise<?Completion> {
    if (
      this._getState() !== 'Running' ||
      !this._supportsAutocompleteResolve()
    ) {
      return null;
    }

    invariant(typeof suggestion.extraData === 'string');

    try {
      const result = await this._lspConnection.completionItemResolve(
        JSON.parse(suggestion.extraData),
      );

      const modifiedResult = this._createAutocompleteSnippet(result);

      return {
        ...suggestion,
        ...convert.lspCompletionItem_atomCompletion(modifiedResult, true),
      };
    } catch (e) {
      this._logLspException(e);
      return null;
    }
  }

  // modify a given CompletionItem result to work as a snippet if possible
  _createAutocompleteSnippet(result: CompletionItem): CompletionItem {
    const {textEdit, additionalTextEdits, ...rest} = result;
    const modifiedResult = ((rest: any): CompletionItem);
    if (
      result.insertTextFormat === InsertTextFormat.Snippet &&
      result.textEdit != null
    ) {
      if (result.additionalTextEdits != null) {
        this._handleLogMessageNotification({
          type: LspMessageType.Warning,
          message:
            'Additional text edits not supported for resolve autocomplete suggestions',
        });
        return result;
      }
      modifiedResult.insertText = result.textEdit.newText;
      return modifiedResult;
    }
    return result;
  }

  _supportsAutocompleteResolve(): boolean {
    return (
      this._serverCapabilities.completionProvider != null &&
      this._serverCapabilities.completionProvider.resolveProvider === true
    );
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.definitionProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
    ) {
      return null;
    }
    const params = convert.atom_lspPositionParams(
      fileVersion.filePath,
      position,
    );

    let response;
    try {
      this._definitionCancellation.cancel();
      this._definitionCancellation = new rpc.CancellationTokenSource();
      response = await this._lspConnection.gotoDefinition(
        params,
        this._definitionCancellation.token,
      );
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
      queryRange: null, // editor uses wordAtPos to determine current identifier
      definitions: responseArray.map(d =>
        convert.lspLocationWithTitle_atomDefinition(d, this._projectRoot),
      ),
    };
  }

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): ConnectableObservable<?FindReferencesReturn> {
    return Observable.fromPromise(
      this._findReferences(fileVersion, position),
    ).publish();
  }

  async _findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.referencesProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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

  rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): ConnectableObservable<?RenameReturn> {
    return Observable.fromPromise(
      this._rename(fileVersion, position, newName),
    ).publish();
  }

  async _rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): Promise<?RenameReturn> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.renameProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
    ) {
      return null;
    }

    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      position: convert.atomPoint_lspPosition(position),
      newName,
    };

    let response;
    try {
      response = await this._lspConnection.rename(params);
      invariant(response != null, 'null textDocument/rename');
    } catch (e) {
      this._logLspException(e);
      // eslint-disable-next-line nuclide-internal/api-spelling
      if (this._isErrorRequestCancelled(e)) {
        // RequestCancelled is normal and shouldn't be surfaced to the user
        return null;
      }
      return {
        type: 'error',
        message: e.message,
      };
    }

    return {
      type: 'data',
      data: convert.lspWorkspaceEdit_atomWorkspaceEdit(response),
    };
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    if (
      this._getState() !== 'Running' ||
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
      message:
        uncovered.message != null ? uncovered.message : response.defaultMessage,
    });
    return {
      percentage: response.coveredPercent,
      uncoveredRegions: response.uncoveredRanges.map(convertUncovered),
    };
  }

  async onToggleCoverage(set: boolean): Promise<void> {
    invariant(this._lspConnection != null);

    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.typeCoverageProvider
    ) {
      return;
    }
    const params = {
      toggle: set,
    };
    this._lspConnection.toggleTypeCoverage(params);
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    // If the LSP process is starting up, let the startup finish before
    // resolving.
    if (this._getState() === 'Starting') {
      await this._state
        .filter(state => state !== 'Starting')
        .take(1)
        .toPromise();
    }
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.documentSymbolProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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
      this._outlineCancellation.cancel();
      this._outlineCancellation = new rpc.CancellationTokenSource();
      const token = this._outlineCancellation.token;
      response = await this._lspConnection.documentSymbol(params, token);
      invariant(response != null, 'null textDocument/documentSymbol');
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    // The response is a flat list of SymbolInformation, which has location+name+containerName.
    // We're going to reconstruct a tree out of them. This can't be done with 100% accuracy in
    // all cases, but it can be done accurately in *almost* all cases.

    // For each symbolInfo in the list, we have exactly one corresponding tree node.
    const list: Array<[SymbolInformation, OutlineTree]> = response.map(
      symbol => [
        symbol,
        {
          icon: convert.lspSymbolKind_atomIcon(symbol.kind),
          representativeName: symbol.name,
          tokenizedText: convert.lspSymbolInformation_atomTokenizedText(symbol),
          startPosition: convert.lspPosition_atomPoint(
            symbol.location.range.start,
          ),
          endPosition: convert.lspPosition_atomPoint(symbol.location.range.end),
          children: [],
        },
      ],
    );
    return {
      outlineTrees: createOutlineTreeHierarchy(
        list,
        this._lspPreferences.reconstructOutlineStrategy,
        this._logger,
      ).children,
    };
  }

  /** Returns code lens information for the given file. */
  async getCodeLens(fileVersion: FileVersion): Promise<?Array<CodeLensData>> {
    if (
      this._getState() !== 'Running' ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
    ) {
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
    };

    try {
      const response = await this._lspConnection.codeLens(params);
      invariant(response != null, 'null textDocument/codeLens');
      return response.map(convert.lspCodeLens_codeLensData);
    } catch (e) {
      this._logLspException(e);
      return null;
    }
  }

  /** Resolves an individual code lens. */
  async resolveCodeLens(
    filePath: NuclideUri,
    data: CodeLensData,
  ): Promise<?CodeLensData> {
    if (this._getState() !== 'Running') {
      return null;
    }

    if (
      !this._serverCapabilities.codeLensProvider ||
      !this._serverCapabilities.codeLensProvider.resolveProvider
    ) {
      return data;
    }

    try {
      const response = await this._lspConnection.codeLensResolve(
        convert.codeLensData_lspCodeLens(data),
      );
      invariant(response != null, 'null textDocument/codeLensResolve');
      return convert.lspCodeLens_codeLensData(response);
    } catch (e) {
      this._logLspException(e);
      return null;
    }
  }

  // Private API to send executeCommand requests to the server. Returns a
  // boolean indicating whether executing the command was successful.
  // This function will throw an error if the server isn't in a state to handle
  // the request, the server can't handle this type of request, or if the LSP
  // server throws its own exception (ex: an internal server error exception)
  async _executeCommand(command: string, args?: Array<any>): Promise<void> {
    if (this._getState() !== 'Running') {
      throw new Error(
        `${
          this._languageServerName
        } is not currently in a state to handle the request`,
      );
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    } else if (!this._serverCapabilities.executeCommandProvider) {
      throw new Error(`${this._languageServerName} cannot handle the request`);
    }
    try {
      const isHostCommand = await this._host.dispatchCommand(command, {
        projectRoot: this._projectRoot,
        args,
      });
      if (!isHostCommand) {
        await this._lspConnection.executeCommand({
          command,
          arguments: args,
        });
      }
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
      this._getState() !== 'Running' ||
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
    return this._convertCommands_CodeActions(response);
  }

  _convertCommands_CodeActions(commands: Array<Command>): Array<CodeAction> {
    return commands.map(command => {
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

  async getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>> {
    const results: Array<AdditionalLogFile> = [];

    // The LSP server sends back either titled data (each one of which gets
    // written as an AdditionalLogFile) or untitled data (which we accumulate
    // and send in a single AdditionalLogFile with our own logs).
    const lspAnonymousTitle = `${this._projectRoot}:LSP#${
      this._languageServerName
    }`;
    let lspAnonymousRage = '';

    if (
      this._getState() === 'Running' &&
      Boolean(this._serverCapabilities.rageProvider)
    ) {
      let response = null;
      try {
        response = await timeoutAfterDeadline(
          deadline,
          this._lspConnection.rage(),
        );
        invariant(response != null, 'null telemetry/rage');
      } catch (e) {
        this._logLspException(e);
        response = [{title: null, data: stringifyError(e)}];
      }
      for (const rageItem of response) {
        if (rageItem.title == null) {
          lspAnonymousRage += rageItem.data + '\n';
        } else {
          results.push({
            title: rageItem.title,
            data: rageItem.data,
          });
        }
      }
    }

    if (this._additionalLogFilesRetentionPeriod > 0) {
      // verbose trace of LSP messages over past few minutes
      results.push({
        title: lspAnonymousTitle,
        mimeType: 'text/plain',
        data: lspAnonymousRage + '\n\n' + this._logger.dump(),
      });
      lspAnonymousRage = '';
      // snapshots of files over past few minutes
      for (const {title, text} of this._snapshotter.dump()) {
        results.push({title, mimeType: 'text/plain', data: text});
      }
    }

    if (lspAnonymousRage !== '') {
      results.push({
        title: lspAnonymousTitle,
        mimeType: 'text/plain',
        data: lspAnonymousRage,
      });
      lspAnonymousRage = '';
    }

    return results;
  }

  async typeHint(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?TypeHint> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.hoverProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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
    } catch (e) {
      this._logLspException(e);
      return null;
    }

    if (response == null || response.contents == null) {
      return null;
    }

    const responseHint = Array.isArray(response.contents)
      ? response.contents
      : [response.contents];

    const hint = responseHint.map(h => {
      if (typeof h === 'string') {
        if (responseHint.length > 1) {
          return {type: 'markdown', value: h};
        } else {
          // If we only get one response, assume it's a snippet.
          return {type: 'snippet', value: h};
        }
      } else if (h.language === 'markdown') {
        // Give single-response MarkedString objects a chance to render as a
        // markdown hint.
        return {type: 'markdown', value: h.value};
      } else {
        // TODO: would be nice if there was some way to pass the language
        // through too.
        return {type: 'snippet', value: h.value};
      }
    });

    let range = new atom$Range(position, position);
    if (response.range) {
      range = convert.lspRange_atomRange(response.range);
    } else {
      const buffer = await this.tryGetBufferWhenWeAndLspAtSameVersion(
        fileVersion,
      );
      if (buffer != null) {
        const match = wordAtPositionFromBuffer(buffer, position, WORD_REGEX);
        if (match != null && match.wordMatch.length > 0) {
          range = match.range;
        }
      }
    }

    return {hint, range};
  }

  async highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.documentHighlightProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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

  _constructDocumentFormattingParams(
    fileVersion: FileVersion,
    options: FormatOptions,
  ): DocumentFormattingParams {
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      options,
    };
    const additionalFormattingOptions =
      this._lspPreferences.additionalFormattingOptions || new Map();
    for (const [key, value] of additionalFormattingOptions) {
      params.options[key] = value;
    }
    return params;
  }

  async formatSource(
    fileVersion: FileVersion,
    atomRange: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    if (this._getState() !== 'Running') {
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
    const params = this._constructDocumentFormattingParams(
      fileVersion,
      options,
    );
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

  async formatEntireFile(
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
      this._getState() !== 'Running' ||
      !triggerCharacters.has(triggerCharacter) ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
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

  async signatureHelp(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    if (
      this._getState() !== 'Running' ||
      !this._serverCapabilities.signatureHelpProvider ||
      !(await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion))
    ) {
      return null;
    }
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      position: convert.atomPoint_lspPosition(position),
    };

    try {
      const result = await this._lspConnection.signatureHelp(params);
      if (result == null) {
        return null;
      }
      return convert.lspSignatureHelp_atomSignatureHelp(result);
    } catch (e) {
      this._logLspException(e);
      return null;
    }
  }

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    return compact(this._supportsSymbolSearch)
      .take(1)
      .toPromise();
  }

  async symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    if (
      this._getState() !== 'Running' ||
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

  onWillSave(fileVersion: FileVersion): ConnectableObservable<TextEdit> {
    const cancellationSource = new rpc.CancellationTokenSource();
    const cancelRequest = () => {
      cancellationSource.cancel();
    };
    const params = {
      textDocument: convert.localPath_lspTextDocumentIdentifier(
        fileVersion.filePath,
      ),
      reason: TextDocumentSaveReason.Manual,
    };
    return Observable.create(observer => {
      // Comment above notes _lspConnection is really nullable... and it's been
      // observed to be null in this callback!
      const connection: ?LspConnection = this._lspConnection;
      if (connection == null) {
        observer.complete();
        return;
      }
      connection
        .willSaveWaitUntilTextDocument(params, cancellationSource.token)
        .then(
          edits => {
            for (const edit of convert.lspTextEdits_atomTextEdits(edits)) {
              observer.next(edit);
            }
            observer.complete();
          },
          error => {
            // Log the error here, but just return an observable that completes
            // without any edits emitted.
            this._logLspException(error);
            observer.complete();
          },
        );
      return cancelRequest;
    }).publish();
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    this._logger.error('NYI: getProjectRoot');
    return Promise.resolve(null);
  }

  _isFileInProject(file: string): boolean {
    return nuclideUri.contains(this._projectRoot, file);
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    return Promise.resolve(this._isFileInProject(fileUri));
  }

  getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    this._logger.error('NYI: getExpandedSelectionRange');
    return Promise.resolve(null);
  }

  getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    this._logger.error('NYI: getCollapsedSelectionRange');
    return Promise.resolve(null);
  }

  async sendLspRequest(
    filePath: NuclideUri,
    method: string,
    params: mixed,
  ): Promise<mixed> {
    return this._lspConnection._jsonRpcConnection.sendRequest(method, params);
  }

  async sendLspNotification(
    notificationMethod: string,
    params: mixed,
  ): Promise<void> {
    // Wait until state is running before sending notification.
    const waitUntilRunning = this._state
      .takeWhile(s => s !== 'Running')
      .ignoreElements();
    await waitUntilRunning.toPromise();
    this._lspConnection._jsonRpcConnection.sendNotification(
      notificationMethod,
      params,
    );
  }

  observeLspNotifications(
    notificationMethod: string,
  ): ConnectableObservable<mixed> {
    // Observable that emits no items but completes once the LSP state is 'running'.
    const waitUntilRunning = this._state
      .takeWhile(s => s !== 'Running')
      .ignoreElements();
    const observable = Observable.create(observer => {
      this._lspConnection._jsonRpcConnection.onNotification(
        {method: notificationMethod},
        (params: mixed) => {
          observer.next(params);
        },
      );
      this._disposables.add(() => observer.complete());
    });
    return waitUntilRunning.concat(observable).publish();
  }
}

class DerivedServerCapabilities {
  serverWantsOpenClose: boolean;
  serverWantsChange: 'full' | 'incremental' | 'none';
  serverWantsSave: 'excludeText' | 'includeText' | 'none';
  onTypeFormattingTriggerCharacters: Set<string>;
  completionTriggerCharacters: Set<string>;

  constructor(capabilities: ServerCapabilities, logger: MemoryLogger) {
    let syncKind;
    // capabilities.textDocumentSync is either a number (protocol v2)
    // or an object (protocol v3) or absent (indicating no capabilities).
    const sync = capabilities.textDocumentSync;
    if (typeof sync === 'number') {
      this.serverWantsOpenClose = true;
      this.serverWantsSave = 'excludeText';
      syncKind = sync;
    } else if (typeof sync === 'object') {
      this.serverWantsOpenClose = Boolean(sync.openClose);
      this.serverWantsSave =
        sync.save == null
          ? 'none'
          : sync.save.includeText
            ? 'includeText'
            : 'excludeText';
      syncKind = Number(sync.change);
    } else {
      this.serverWantsOpenClose = false;
      this.serverWantsSave = 'none';
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
      const intrinsicChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_'.split(
        '',
      );
      this.completionTriggerCharacters = new Set(
        lspChars.concat(intrinsicChars),
      );
    }
  }
}

class JsonRpcLogger {
  _logger: MemoryLogger;

  constructor(logger: MemoryLogger) {
    this._logger = logger;
  }

  error(message: string): void {
    this._logger.error(message);
  }

  warn(message: string): void {
    this._logger.info(message);
  }

  info(message: string): void {
    this._logger.info(message);
  }

  log(message: string): void {
    this._logger.trace(message);
  }
}

class JsonRpcTraceLogger {
  _logger: MemoryLogger;

  constructor(logger: MemoryLogger) {
    this._logger = logger;
  }

  log(message: string, data: ?string): void {
    this._logger.trace(`LSP.trace: ${message} ${data || ''}`);
  }
}

function createOutlineTreeHierarchy(
  list: Array<[SymbolInformation, OutlineTree]>,
  reconstructOutlineStrategy: ?string,
  logger: MemoryLogger,
): OutlineTree {
  // Sorting the list of symbols is the first thing we do! First, sort by start
  // location (smallest first) and within that by end location (largest first).
  // This results in our list being a pre-order flattening of the tree.
  list.sort(([, aNode], [, bNode]) => {
    const r = aNode.startPosition.compare(bNode.startPosition);
    if (r !== 0) {
      return r;
    }
    // LSP always provides an endPosition
    invariant(aNode.endPosition != null && bNode.endPosition != null);
    return bNode.endPosition.compare(aNode.endPosition);
  });

  const root: OutlineTree = {
    plainText: '',
    startPosition: new Point(0, 0),
    children: [],
  };

  // Q. how to reconstruct a hierarchy out of a flat list of symbols?
  // There are two answers...

  if (reconstructOutlineStrategy === 'containerName') {
    // A1. We'll do it based on containerName.

    // We'll need to look up for parents by name, so construct a map from names to nodes
    // of that name. Note: an undefined SymbolInformation.containerName means root,
    // but it's easier for us to represent with ''.
    const mapElements = list.map(([symbol, node]) => [symbol.name, node]);
    const map: Map<string, Array<OutlineTree>> = collect(mapElements);
    if (map.has('')) {
      logger.error(
        'Outline textDocument/documentSymbol returned an empty symbol name',
      );
    }

    // The algorithm for reconstructing the tree out of list items rests on identifying
    // an item's parent based on the item's containerName. It's easy if there's only one
    // parent of that name. But if there are multiple parent candidates, we'll try to pick
    // the one that comes immediately lexically before the item. (If there are no parent
    // candidates, we've been given a malformed item, so we'll just ignore it.)
    map.set('', [root]);
    for (const [symbol, node] of list) {
      const parentName = symbol.containerName || '';
      const parentCandidates = map.get(parentName);
      if (parentCandidates == null) {
        logger.error(
          `Outline textDocument/documentSymbol ${
            symbol.name
          } is missing container ${parentName}, setting container to root`,
        );
        root.children.push(node);
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
          logger.error(
            `Outline textDocument/documentSymbol ${
              symbol.name
            } comes after its container`,
          );
        } else {
          // Some candidates before+after? Then item's parent is the last candidate before.
          parentCandidates[iAfter - 1].children.push(node);
        }
      }
    }
  } else {
    // A2. We'll use their ranges. Any node whose range is entirely contained
    // within another is a child of that other.
    // Implementation: We'll trust that there aren't overlapping spans.
    // First, sort by start location (smallest first) and within that by end
    // location (largest first). After that sort, our list will be a pre-order
    // flattening of the tree.
    // Next, iterate through the list in order, maintaining a "spine" to the
    // most recent node we've done. For each subsequent element of the list,
    // it will be a child of the lowest element in the spine to contain it.
    const spine = [root];
    for (const [, node] of list) {
      while (spine.length > 1) {
        const candidate = spine[spine.length - 1]; // parent candidate
        invariant(node.endPosition != null);
        const nodeRange = new atom$Range(node.startPosition, node.endPosition);
        invariant(candidate.endPosition != null);
        const candidateRange = new atom$Range(
          candidate.startPosition,
          candidate.endPosition,
        );
        if (candidateRange.containsRange(nodeRange)) {
          break; // found the lowest element in the spine that contains node
        }
        spine.pop();
      }
      const parent = spine[spine.length - 1];
      parent.children.push(node);
      spine.push(node);
    }
  }

  return root;
}
