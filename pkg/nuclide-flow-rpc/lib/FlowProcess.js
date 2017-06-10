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

import type {ServerStatusType} from '..';

import type {FlowExecInfoContainer} from './FlowExecInfoContainer';

import os from 'os';
import invariant from 'assert';
import {BehaviorSubject, Observable} from 'rxjs';

import {getLogger} from 'log4js';
const logger = getLogger('nuclide-flow-rpc');

import {track} from '../../nuclide-analytics';

import {runCommandDetailed, spawn} from 'nuclide-commons/process';
import {sleep} from 'nuclide-commons/promise';
import {niceSafeSpawn} from 'nuclide-commons/nice';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {getStopFlowOnExit} from './FlowHelpers';
import {getConfig} from './config';
import {ServerStatus} from './FlowConstants';
import {FlowIDEConnection} from './FlowIDEConnection';
import {FlowIDEConnectionWatcher} from './FlowIDEConnectionWatcher';

type FlowExecResult = {
  stdout: string,
  stderr: string,
  exitCode: ?number,
};

// Names modeled after https://github.com/facebook/flow/blob/master/src/common/flowExitStatus.ml
export const FLOW_RETURN_CODES = {
  ok: 0,
  serverInitializing: 1,
  typeError: 2,
  noServerRunning: 6,
  // This means that the server exists, but it is not responding, typically because it is busy doing
  // other work.
  outOfRetries: 7,
  buildIdMismatch: 9,
  unexpectedArgument: 64,
};

const SERVER_READY_TIMEOUT_MS = 60 * 1000;

const EXEC_FLOW_RETRIES = 5;

const NO_RETRY_ARGS = [
  '--retry-if-init',
  'false',
  '--retries',
  '0',
  '--no-auto-start',
];

const TEMP_SERVER_STATES: Array<ServerStatusType> = [
  ServerStatus.NOT_RUNNING,
  ServerStatus.BUSY,
  ServerStatus.INIT,
];

export class FlowProcess {
  // If we had to start a Flow server, store the process here so we can kill it when we shut down.
  _startedServer: ?child_process$ChildProcess;
  // The current state of the Flow server in this directory
  _serverStatus: BehaviorSubject<ServerStatusType>;
  // The path to the directory where the .flowconfig is -- i.e. the root of the Flow project.
  _root: string;
  _execInfoContainer: FlowExecInfoContainer;

  _ideConnections: Observable<?FlowIDEConnection>;

  // If someone subscribes to _ideConnections, we will also publish them here. But subscribing to
  // this does not actually cause a connection to be created or maintained.
  _optionalIDEConnections: BehaviorSubject<?FlowIDEConnection>;

  _isDisposed: BehaviorSubject<boolean>;
  _subscriptions: UniversalDisposable;

  constructor(root: string, execInfoContainer: FlowExecInfoContainer) {
    this._subscriptions = new UniversalDisposable();
    this._execInfoContainer = execInfoContainer;
    this._serverStatus = new BehaviorSubject(ServerStatus.UNKNOWN);
    this._root = root;
    this._isDisposed = new BehaviorSubject(false);

    this._optionalIDEConnections = new BehaviorSubject(null);
    this._ideConnections = this._createIDEConnectionStream();

    this._serverStatus.subscribe(status => {
      logger.info(`[${status}]: Flow server in ${this._root}`);
    });

    this._serverStatus
      .filter(x => x === ServerStatus.NOT_RUNNING)
      .subscribe(() => {
        this._startFlowServer();
      });

    this._serverStatus
      .scan(
        ({previousState}, nextState) => {
          // We should start pinging if we move into a temp state
          const shouldStartPinging =
            !TEMP_SERVER_STATES.includes(previousState) &&
            TEMP_SERVER_STATES.includes(nextState);
          return {
            shouldStartPinging,
            previousState: nextState,
          };
        },
        {shouldStartPinging: false, previousState: ServerStatus.UNKNOWN},
      )
      .filter(({shouldStartPinging}) => shouldStartPinging)
      .subscribe(() => {
        this._pingServer();
      });

    this._serverStatus
      .filter(status => status === ServerStatus.FAILED)
      .subscribe(() => {
        track('flow-server-failed');
      });
  }

  dispose(): void {
    this._serverStatus.complete();
    this._isDisposed.next(true);
    if (this._startedServer && getStopFlowOnExit()) {
      // The default, SIGTERM, does not reliably kill the flow servers.
      this._startedServer.kill('SIGKILL');
    }
    this._subscriptions.dispose();
  }

  /**
   * If the Flow server fails we will not try to restart it again automatically. Calling this
   * method lets us exit that state and retry.
   */
  allowServerRestart(): void {
    if (this._serverStatus.getValue() === ServerStatus.FAILED) {
      // We intentionally do not use _setServerStatus because leaving the FAILED state is a
      // special-case that _setServerStatus does not allow.
      this._serverStatus.next(ServerStatus.UNKNOWN);
    }
  }

  getServerStatusUpdates(): Observable<ServerStatusType> {
    return this._serverStatus.asObservable();
  }

  // It is possible for an IDE connection to die. If there are subscribers to this Observable, it
  // will be automatically restarted and the new one will be sent.
  //
  // If the connection dies, `null` will be sent while the next one is being established.
  getIDEConnections(): Observable<?FlowIDEConnection> {
    return this._ideConnections;
  }

  // This will not cause an IDE connection to be established or maintained, and the return value is
  // not safe to store. If there happens to be an IDE connection it will be returned.
  getCurrentIDEConnection(): ?FlowIDEConnection {
    return this._optionalIDEConnections.getValue();
  }

  _createIDEConnectionStream(): Observable<?FlowIDEConnection> {
    this._subscriptions.add(
      this._optionalIDEConnections
        .filter(conn => conn != null)
        .switchMap(conn => {
          invariant(conn != null);
          return conn.observeRecheckBookends();
        })
        .subscribe(bookend => {
          if (bookend.kind === 'start-recheck') {
            this._setServerStatus(ServerStatus.BUSY);
          } else {
            this._setServerStatus(ServerStatus.READY);
          }
        }),
    );

    const isFailed: Observable<boolean> = this._serverStatus
      .map(x => x === ServerStatus.FAILED)
      .distinctUntilChanged();
    // When we move from failed to non-failed that means we have been explicitly asked to retry
    // after a Flow server crash. Odds are good that the IDE connection has timed out or is
    // otherwise unhealthy. So, when we transition from failed to non-failed we should also start
    // all IDE connection logic anew.
    const shouldStart: Observable<void> = isFailed
      .filter(failed => !failed)
      .mapTo(undefined);
    return (
      shouldStart
        .switchMap(() => this._createSingleIDEConnectionStream())
        .takeUntil(this._isDisposed.filter(x => x))
        .concat(Observable.of(null))
        // This is so we can passively observe IDE connections if somebody happens to be using one. We
        // want to use it to more quickly update the Flow server status, but it's not crucial to
        // correctness so we only want to do this if somebody is using the IDE connections anyway.
        // Don't pass the Subject as an Observer since then it will complete if a client unsubscribes.
        .do(
          conn => this._optionalIDEConnections.next(conn),
          () => {
            // If we get an error, set the current ide connection to null
            this._optionalIDEConnections.next(null);
          },
          () => {
            // If we get a completion (happens when the downstream client unsubscribes), set the current ide connection to null.
            this._optionalIDEConnections.next(null);
          },
        )
        // multicast and store the current connection and immediately deliver it to new subscribers
        .publishReplay(1)
        .refCount()
    );
  }

  _createSingleIDEConnectionStream(): Observable<?FlowIDEConnection> {
    logger.info('Creating Flow IDE connection stream');
    let connectionWatcher: ?FlowIDEConnectionWatcher = null;
    return Observable.fromEventPattern(
      // Called when the observable is subscribed to
      handler => {
        logger.info('Got a subscriber for the Flow IDE connection stream');
        invariant(connectionWatcher == null);
        connectionWatcher = new FlowIDEConnectionWatcher(
          this._tryCreateIDEProcess(),
          handler,
        );
        connectionWatcher.start();
      },
      // Called when the observable is unsubscribed from
      () => {
        logger.info(
          'No more IDE connection stream subscribers -- shutting down connection watcher',
        );
        invariant(connectionWatcher != null);
        connectionWatcher.dispose();
        connectionWatcher = null;
      },
    );
  }

  _tryCreateIDEProcess(): Observable<?child_process$ChildProcess> {
    return Observable.defer(() => this._serverIsReady())
      .switchMap(serverIsReady => {
        if (!serverIsReady) {
          return Observable.of(null);
        }
        return getAllExecInfo(
          ['ide', '--protocol', 'very-unstable', ...NO_RETRY_ARGS],
          this._root,
          this._execInfoContainer,
        );
      })
      .switchMap(allExecInfo => {
        if (allExecInfo == null) {
          return Observable.of(null);
        }

        return spawn(
          allExecInfo.pathToFlow,
          allExecInfo.args,
          allExecInfo.options,
        ).do(proc => {
          proc.once('exit', (code: ?number, signal: ?string) => {
            // If it crashes we will get `null` or `undefined`, but that doesn't actually mean
            // that Flow is not installed.
            if (code != null) {
              this._updateServerStatus(code);
            }
          });
        });
      });
  }

  /**
   * Returns null if Flow cannot be found.
   */
  async execFlow(
    args: Array<any>,
    options: Object,
    waitForServer?: boolean = false,
    suppressErrors?: boolean = false,
  ): Promise<?FlowExecResult> {
    const maxRetries = waitForServer ? EXEC_FLOW_RETRIES : 0;
    if (this._serverStatus.getValue() === ServerStatus.FAILED) {
      return null;
    }
    for (let i = 0; ; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await this._rawExecFlow(args, options);
        return result;
      } catch (e) {
        const couldRetry =
          [
            ServerStatus.NOT_RUNNING,
            ServerStatus.INIT,
            ServerStatus.BUSY,
          ].indexOf(this._serverStatus.getValue()) !== -1;
        if (i < maxRetries && couldRetry) {
          // eslint-disable-next-line no-await-in-loop
          await this._serverIsReady();
          // Then try again.
        } else {
          // If it couldn't retry, it means there was a legitimate error. If it could retry, we
          // don't want to log because it just means the server is busy and we don't want to wait.
          if (!couldRetry && !suppressErrors) {
            // not sure what happened, but we'll let the caller deal with it
            logger.error(
              `Flow failed: flow ${args.join(' ')}. Error: ${JSON.stringify(e)}`,
            );
          }
          throw e;
        }
        // try again
      }
    }
  }

  /** Starts a Flow server in the current root */
  async _startFlowServer(): Promise<void> {
    // If the server is restarting because of a change in the version specified in the .flowconfig,
    // then it's important not to use a stale path to start it, since we could have cached the path
    // to a different version. In that case, starting the server will fail.
    const flowExecInfo = await this._execInfoContainer.reallyGetFlowExecInfo(
      this._root,
    );
    if (flowExecInfo == null) {
      // This should not happen in normal use. If Flow is not installed we should have caught it by
      // now.
      logger.error(`Could not find Flow to start server in ${this._root}`);
      this._setServerStatus(ServerStatus.NOT_INSTALLED);
      return;
    }
    const lazy = [];
    if (getConfig('lazyServer')) {
      lazy.push('--lazy');
    }
    // `flow server` will start a server in the foreground. runCommand/runCommandDetailed
    // will not resolve the promise until the process exits, which in this
    // case is never. We need to use spawn directly to get access to the
    // ChildProcess object.
    // eslint-disable-next-line no-await-in-loop
    const serverProcess = await niceSafeSpawn(
      flowExecInfo.pathToFlow,
      [
        'server',
        ...lazy,
        '--from',
        'nuclide',
        '--max-workers',
        this._getMaxWorkers().toString(),
        this._root,
      ],
      flowExecInfo.execOptions,
    );
    const logIt = data => {
      const pid = serverProcess.pid;
      logger.debug(`flow server (${pid}): ${data}`);
    };
    serverProcess.stdout.on('data', logIt);
    serverProcess.stderr.on('data', logIt);
    serverProcess.on('exit', (code, signal) => {
      // We only want to blacklist this root if the Flow processes
      // actually failed, rather than being killed manually. It seems that
      // if they are killed, the code is null and the signal is 'SIGTERM'.
      // In the Flow crashes I have observed, the code is 2 and the signal
      // is null. So, let's blacklist conservatively for now and we can
      // add cases later if we observe Flow crashes that do not fit this
      // pattern.
      if (code === 2 && signal === null) {
        logger.error('Flow server unexpectedly exited', this._root);
        this._setServerStatus(ServerStatus.FAILED);
      }
    });
    this._startedServer = serverProcess;
  }

  /** Execute Flow with the given arguments */
  async _rawExecFlow(
    args_: Array<any>,
    options?: Object = {},
  ): Promise<?FlowExecResult> {
    let args = args_;
    args = [...args, ...NO_RETRY_ARGS];
    try {
      const result = await FlowProcess.execFlowClient(
        args,
        this._root,
        this._execInfoContainer,
        options,
      );
      this._updateServerStatus(result != null ? result.exitCode : null);
      return result;
    } catch (e) {
      this._updateServerStatus(e != null ? e.exitCode : null);
      if (e.exitCode === FLOW_RETURN_CODES.typeError) {
        return e;
      } else {
        throw e;
      }
    }
  }

  _updateServerStatus(exitCode: ?number): void {
    let status;
    if (exitCode == null) {
      status = ServerStatus.NOT_INSTALLED;
    } else {
      switch (exitCode) {
        case FLOW_RETURN_CODES.ok:
        // falls through
        case FLOW_RETURN_CODES.typeError:
          status = ServerStatus.READY;
          break;
        case FLOW_RETURN_CODES.serverInitializing:
          status = ServerStatus.INIT;
          break;
        case FLOW_RETURN_CODES.noServerRunning:
          status = ServerStatus.NOT_RUNNING;
          break;
        case FLOW_RETURN_CODES.outOfRetries:
          status = ServerStatus.BUSY;
          break;
        case FLOW_RETURN_CODES.buildIdMismatch:
          // If the version doesn't match, the server is automatically killed and the client
          // returns 9.
          logger.info(
            'Killed flow server with incorrect version in',
            this._root,
          );
          status = ServerStatus.NOT_RUNNING;
          break;
        case FLOW_RETURN_CODES.unexpectedArgument:
          // If we issued an unexpected argument we have learned nothing about the state of the Flow
          // server. So, don't update.
          return;
        default:
          logger.error(`Unknown return code from Flow: ${String(exitCode)}`);
          status = ServerStatus.UNKNOWN;
      }
    }
    this._setServerStatus(status);
  }

  _setServerStatus(status: ServerStatusType): void {
    const currentStatus = this._serverStatus.getValue();
    if (
      // Avoid duplicate updates
      status !== currentStatus &&
      // Avoid moving the status away from FAILED, to let any existing  work die out when the
      // server fails.
      currentStatus !== ServerStatus.FAILED
    ) {
      this._serverStatus.next(status);
    }
    if (this._isDisposed.getValue()) {
      logger.error('Attempted to update server status after disposal');
    }
  }

  /** Ping the server until it reaches a steady state */
  async _pingServer(): Promise<void> {
    let hasReachedSteadyState = false;
    this._serverStatus
      .filter(state => !TEMP_SERVER_STATES.includes(state))
      .take(1)
      .subscribe(() => {
        hasReachedSteadyState = true;
      });
    while (!hasReachedSteadyState && !this._isDisposed.getValue()) {
      // eslint-disable-next-line no-await-in-loop
      await this._pingServerOnce();
      // Wait 1 second
      // eslint-disable-next-line no-await-in-loop
      await sleep(1000);
    }
  }

  _pingServerOnce(): Promise<void> {
    return this._rawExecFlow(['status']).catch(() => {}).then(() => {});
  }

  /**
   * Resolves when the server is ready or the request times out, as indicated by the result of the
   * returned Promise.
   */
  _serverIsReady(): Promise<boolean> {
    // If the server state is unknown, nobody has tried to do anything flow-related yet. However,
    // the call to _serverIsReady() implies that somebody wants to. So, kick off a Flow server ping
    // which will learn the state of the Flow server and start it up if needed.
    if (this._serverStatus.getValue() === ServerStatus.UNKNOWN) {
      this._pingServerOnce();
    }
    return (
      this._serverStatus
        .filter(x => x === ServerStatus.READY)
        .map(() => true)
        .race(Observable.of(false).delay(SERVER_READY_TIMEOUT_MS))
        // If the stream is completed timeout will not return its default value and we will see an
        // EmptyError. So, provide a defaultValue here so the promise resolves.
        .first(null, null, false)
        .toPromise()
    );
  }

  _getMaxWorkers(): number {
    return Math.max(os.cpus().length - 2, 1);
  }

  /**
   * This should be used to execute Flow commands that do not rely on a Flow server. So, they do not
   * need to be associated with a FlowProcess instance and they may be executed from any working
   * directory.
   *
   * Note that using this method means that you get no guarantee that the Flow version specified in
   * any given .flowconfig is the one that will be executed here, because it has no association with
   * any given root. If you need this property, create an instance with the appropriate root and use
   * execFlow.
   */
  static async execFlowClient(
    args: Array<any>,
    root: string | null,
    execInfoContainer: FlowExecInfoContainer,
    options: Object = {},
  ): Promise<?FlowExecResult> {
    const allExecInfo = await getAllExecInfo(
      args,
      root,
      execInfoContainer,
      options,
    );
    if (allExecInfo == null) {
      return null;
    }

    // TODO: bubble up the exit code via return value instead of the error
    return runCommandDetailed(
      allExecInfo.pathToFlow,
      allExecInfo.args,
      allExecInfo.options,
    ).toPromise();
  }
}

type AllExecInfo = {
  args: Array<any>,
  options: Object,
  pathToFlow: string,
};

async function getAllExecInfo(
  args: Array<any>,
  root: string | null,
  execInfoContainer: FlowExecInfoContainer,
  options: Object = {},
): Promise<?AllExecInfo> {
  const execInfo = await execInfoContainer.getFlowExecInfo(root);
  if (execInfo == null) {
    return null;
  }
  return {
    args: [...args, '--from', 'nuclide'],
    options: {
      ...execInfo.execOptions,
      ...options,
    },
    pathToFlow: execInfo.pathToFlow,
  };
}
