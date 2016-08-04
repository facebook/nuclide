'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AsyncExecuteReturn} from '../../commons-node/process';

import type {ServerStatusType} from '..';

import type {FlowExecInfoContainer} from './FlowExecInfoContainer';

import os from 'os';

import {BehaviorSubject, Observable} from 'rxjs';

import {getLogger} from '../../nuclide-logging';
const logger = getLogger();

import {track} from '../../nuclide-analytics';

import {
  asyncExecute,
  safeSpawn,
} from '../../commons-node/process';

import {
  getStopFlowOnExit,
} from './FlowHelpers';

import {ServerStatus} from './FlowConstants';

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

const SERVER_READY_TIMEOUT_MS = 10 * 1000;

const EXEC_FLOW_RETRIES = 5;

export class FlowProcess {
  // If we had to start a Flow server, store the process here so we can kill it when we shut down.
  _startedServer: ?child_process$ChildProcess;
  // The current state of the Flow server in this directory
  _serverStatus: BehaviorSubject<ServerStatusType>;
  // The path to the directory where the .flowconfig is -- i.e. the root of the Flow project.
  _root: string;
  _execInfoContainer: FlowExecInfoContainer;

  constructor(root: string, execInfoContainer: FlowExecInfoContainer) {
    this._execInfoContainer = execInfoContainer;
    this._serverStatus = new BehaviorSubject(ServerStatus.UNKNOWN);
    this._root = root;

    this._serverStatus.subscribe(status => {
      logger.info(`[${status}]: Flow server in ${this._root}`);
    });

    this._serverStatus.filter(x => x === ServerStatus.NOT_RUNNING).subscribe(() => {
      this._startFlowServer();
      this._pingServer();
    });
    function isBusyOrInit(status: ServerStatusType): boolean {
      return status === ServerStatus.BUSY || status === ServerStatus.INIT;
    }
    this._serverStatus.filter(isBusyOrInit).subscribe(() => {
      this._pingServer();
    });

    this._serverStatus.filter(status => status === ServerStatus.FAILED).subscribe(() => {
      track('flow-server-failed');
    });
  }

  dispose(): void {
    this._serverStatus.complete();
    if (this._startedServer && getStopFlowOnExit()) {
      // The default, SIGTERM, does not reliably kill the flow servers.
      this._startedServer.kill('SIGKILL');
    }
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

  /**
   * Returns null if Flow cannot be found.
   */
  async execFlow(
    args: Array<any>,
    options: Object,
    waitForServer?: boolean = false,
    suppressErrors?: boolean = false,
  ): Promise<?AsyncExecuteReturn> {
    const maxRetries = waitForServer ? EXEC_FLOW_RETRIES : 0;
    if (this._serverStatus.getValue() === ServerStatus.FAILED) {
      return null;
    }
    for (let i = 0; ; i++) {
      try {
        // eslint-disable-next-line babel/no-await-in-loop
        const result = await this._rawExecFlow(
          args,
          options,
        );
        return result;
      } catch (e) {
        const couldRetry = [ServerStatus.NOT_RUNNING, ServerStatus.INIT, ServerStatus.BUSY]
          .indexOf(this._serverStatus.getValue()) !== -1;
        if (i < maxRetries && couldRetry) {
          // eslint-disable-next-line babel/no-await-in-loop
          await this._serverIsReady();
          // Then try again.
        } else {
          // If it couldn't retry, it means there was a legitimate error. If it could retry, we
          // don't want to log because it just means the server is busy and we don't want to wait.
          if (!couldRetry && !suppressErrors) {
            // not sure what happened, but we'll let the caller deal with it
            logger.error(`Flow failed: flow ${args.join(' ')}. Error: ${JSON.stringify(e)}`);
          }
          throw e;
        }
        // try again
      }
    }
  }

  /** Starts a Flow server in the current root */
  async _startFlowServer(): Promise<void> {
    const flowExecInfo = await this._execInfoContainer.getFlowExecInfo(this._root);
    if (flowExecInfo == null) {
      // This should not happen in normal use. If Flow is not installed we should have caught it by
      // now.
      logger.error(`Could not find Flow to start server in ${this._root}`);
      this._setServerStatus(ServerStatus.NOT_INSTALLED);
      return;
    }
    // `flow server` will start a server in the foreground. asyncExecute
    // will not resolve the promise until the process exits, which in this
    // case is never. We need to use spawn directly to get access to the
    // ChildProcess object.
    // eslint-disable-next-line babel/no-await-in-loop
    const serverProcess = await safeSpawn(
      flowExecInfo.pathToFlow,
      [
        'server',
        '--from', 'nuclide',
        '--max-workers', this._getMaxWorkers().toString(),
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
  async _rawExecFlow(args_: Array<any>, options?: Object = {}): Promise<?AsyncExecuteReturn> {
    let args = args_;
    args = [
      ...args,
      '--retry-if-init', 'false',
      '--retries', '0',
      '--no-auto-start',
    ];
    try {
      const result = await FlowProcess.execFlowClient(
        args,
        this._root,
        this._execInfoContainer,
        options,
      );
      this._updateServerStatus(result);
      return result;
    } catch (e) {
      this._updateServerStatus(e);
      if (e.exitCode === FLOW_RETURN_CODES.typeError) {
        return e;
      } else {
        throw e;
      }
    }
  }

  _updateServerStatus(result: ?AsyncExecuteReturn): void {
    let status;
    if (result == null) {
      status = ServerStatus.NOT_INSTALLED;
    } else {
      switch (result.exitCode) {
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
          logger.info('Killed flow server with incorrect version in', this._root);
          status = ServerStatus.NOT_RUNNING;
          break;
        case FLOW_RETURN_CODES.unexpectedArgument:
          // If we issued an unexpected argument we have learned nothing about the state of the Flow
          // server. So, don't update.
          return;
        default:
          logger.error(`Unknown return code from Flow: ${String(result.exitCode)}`);
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
  }

  /** Ping the server until it leaves the current state */
  async _pingServer(tries?: number = 5): Promise<void> {
    const fromState = this._serverStatus.getValue();
    let stateChanged = false;
    this._serverStatus.filter(newState => newState !== fromState).first().subscribe(() => {
      stateChanged = true;
    });
    for (let i = 0; !stateChanged && i < tries; i++) {
      // eslint-disable-next-line babel/no-await-in-loop
      await this._rawExecFlow(['status']).catch(() => null);
      // Wait 1 second
      // eslint-disable-next-line babel/no-await-in-loop
      await Observable.of(null).delay(1000).toPromise();
    }
  }

  /**
   * Resolves when the server is ready or the request times out, as indicated by the result of the
   * returned Promise.
   */
  _serverIsReady(): Promise<boolean> {
    return this._serverStatus
      .filter(x => x === ServerStatus.READY)
      .map(() => true)
      .race(Observable.of(false).delay(SERVER_READY_TIMEOUT_MS))
      // If the stream is completed timeout will not return its default value and we will see an
      // EmptyError. So, provide a defaultValue here so the promise resolves.
      .first(null, null, false)
      .toPromise();
  }

  _getMaxWorkers(): number {
    return Math.ceil(os.cpus().length / 4);
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
    args_: Array<any>,
    root: string | null,
    execInfoContainer: FlowExecInfoContainer,
    options_?: Object = {},
  ): Promise<?AsyncExecuteReturn> {
    let args = args_;
    let options = options_;
    args = [
      ...args,
      '--from', 'nuclide',
    ];
    const execInfo = await execInfoContainer.getFlowExecInfo(root);
    if (execInfo == null) {
      return null;
    }
    options = {
      ...execInfo.execOptions,
      ...options,
    };
    const ret = await asyncExecute(execInfo.pathToFlow, args, options);
    if (ret.exitCode !== 0) {
      // TODO: bubble up the exit code via return value instead
      throw ret;
    }
    return ret;
  }
}
