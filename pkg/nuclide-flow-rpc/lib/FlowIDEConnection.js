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
import type {FlowStatusOutput, FlowAutocompleteOutput} from './flowOutputTypes';
import type {FileCache} from '../../nuclide-open-files-rpc';
import type {LocalFileEvent} from '../../nuclide-open-files-rpc/lib/rpc-types';

import {Disposable} from 'event-kit';
import {Observable} from 'rxjs';
import * as rpc from 'vscode-jsonrpc';
import through from 'through';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from '../../nuclide-analytics';
import {getLogger} from 'log4js';

import {FileEventKind} from '../../nuclide-open-files-rpc';

// TODO put these in flow-typed when they are fleshed out better

type MessageHandler = (...args: any) => mixed;

type RpcConnection = {
  onNotification(methodName: string, handler: MessageHandler): void,
  sendNotification(methodName: string, ...args: any): void,
  sendRequest(methodName: string, ...args: any): Promise<any>,
  // TODO requests
  listen(): void,
  dispose(): void,
};

export type PushDiagnosticsMessage =
  | RecheckBookend
  | {
      kind: 'errors',
      errors: FlowStatusOutput,
    };

export type RecheckBookend =
  | {
      kind: 'start-recheck',
    }
  | {
      kind: 'end-recheck',
    };

const SUBSCRIBE_METHOD_NAME = 'subscribeToDiagnostics';

const NOTIFICATION_METHOD_NAME = 'diagnosticsNotification';

const OPEN_EVENT_METHOD_NAME = 'didOpen';
const CLOSE_EVENT_METHOD_NAME = 'didClose';

const SUBSCRIBE_RETRY_INTERVAL = 5000;
const SUBSCRIBE_RETRIES = 10;

// Manages the connection to a single `flow ide` process. The lifecycle of an instance of this class
// is tied to the lifecycle of the `flow ide` process.
export class FlowIDEConnection {
  _connection: RpcConnection;
  _ideProcess: child_process$ChildProcess;
  _disposables: UniversalDisposable;

  // Because vscode-jsonrpc offers no mechanism to unsubscribe from notifications, we have to make
  // sure that we put a bound on the number of times we add subscriptions, otherwise we could have a
  // memory leak. The most sensible bound is to just allow a single subscription per message type.
  // Therefore, we must have singleton observables rather than returning new instances from method
  // calls.
  _diagnostics: Observable<FlowStatusOutput>;
  _recheckBookends: Observable<RecheckBookend>;

  _fileCache: FileCache;

  constructor(process: child_process$ChildProcess, fileCache: FileCache) {
    this._disposables = new UniversalDisposable();
    this._fileCache = fileCache;
    this._ideProcess = process;
    this._ideProcess.stderr.pipe(
      through(msg => {
        getLogger('nuclide-flow-rpc').info(
          'Flow IDE process stderr: ',
          msg.toString(),
        );
      }),
    );
    this._connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(this._ideProcess.stdout),
      new rpc.StreamMessageWriter(this._ideProcess.stdin),
    );
    this._connection.listen();

    this._ideProcess.on('exit', () => this.dispose());
    this._ideProcess.on('close', () => this.dispose());

    const diagnostics = Observable.fromEventPattern(
      handler => {
        this._connection.onNotification(
          NOTIFICATION_METHOD_NAME,
          (errors: FlowStatusOutput) => {
            handler(errors);
          },
        );
      },
      // no-op: vscode-jsonrpc offers no way to unsubscribe
      () => {},
    );

    this._diagnostics = Observable.using(() => {
      const fileEventsObservable: Observable<
        Array<LocalFileEvent>,
      > = this._fileCache
        .observeFileEvents()
        .bufferTime(100 /* ms */)
        .filter(fileEvents => fileEvents.length !== 0);

      const fileEventsHandler = fileEvents => {
        const openPaths: Array<string> = [];
        const closePaths: Array<string> = [];
        for (const fileEvent of fileEvents) {
          const filePath = fileEvent.fileVersion.filePath;
          switch (fileEvent.kind) {
            case FileEventKind.OPEN:
              openPaths.push(filePath);
              break;
            case FileEventKind.CLOSE:
              closePaths.push(filePath);
              break;
            case FileEventKind.EDIT:
              // TODO: errors-as-you-type
              break;
            case FileEventKind.SAVE:
              // TODO: handle saves correctly
              break;
            default:
              (fileEvent.kind: empty);
          }
        }
        if (openPaths.length !== 0) {
          this._connection.sendNotification(OPEN_EVENT_METHOD_NAME, openPaths);
        }
        if (closePaths.length !== 0) {
          this._connection.sendNotification(
            CLOSE_EVENT_METHOD_NAME,
            closePaths,
          );
        }
      };

      return fileEventsObservable.subscribe(fileEventsHandler);
    }, () => diagnostics).publishReplay(1);
    this._disposables.add(this._diagnostics.connect());

    this._recheckBookends = Observable.fromEventPattern(
      handler => {
        this._connection.onNotification('startRecheck', () => {
          handler({kind: 'start-recheck'});
        });
        this._connection.onNotification('endRecheck', () => {
          handler({kind: 'end-recheck'});
        });
      },
      // no-op
      () => {},
    ).publish();
    this._disposables.add(this._recheckBookends.connect());

    this._disposables.add(() => {
      this._ideProcess.stdin.end();
      this._ideProcess.kill();

      this._connection.dispose();
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }

  onWillDispose(callback: () => mixed): IDisposable {
    this._disposables.add(callback);
    return new Disposable(() => {
      this._disposables.remove(callback);
    });
  }

  observeDiagnostics(): Observable<PushDiagnosticsMessage> {
    const subscribe = () => {
      this._connection.sendNotification(SUBSCRIBE_METHOD_NAME);
    };

    const retrySubscription = Observable.interval(SUBSCRIBE_RETRY_INTERVAL)
      .take(SUBSCRIBE_RETRIES)
      .takeUntil(this._diagnostics)
      .subscribe(() => {
        getLogger('nuclide-flow-rpc').error(
          'Did not receive diagnostics after subscribe request -- retrying...',
        );
        track('nuclide-flow.missing-push-diagnostics');
        subscribe();
      });

    subscribe();
    return Observable.using(
      () => retrySubscription,
      () => {
        return Observable.merge(
          this._diagnostics.map(errors => ({kind: 'errors', errors})),
          this._recheckBookends,
        );
      },
    );
  }

  // Flow will not send these messages unless we have subscribed to diagnostics. So, this observable
  // will never emit any items unless observeDiagnostics() is called.
  observeRecheckBookends(): Observable<RecheckBookend> {
    return this._recheckBookends;
  }

  getAutocompleteSuggestions(
    filePath: NuclideUri,
    line: number,
    column: number,
    contents: string,
  ): Promise<FlowAutocompleteOutput> {
    return this._connection.sendRequest(
      'autocomplete',
      filePath,
      line,
      column,
      contents,
    );
  }
}
