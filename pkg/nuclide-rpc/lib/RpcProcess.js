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

import type {Subscription, Observable} from 'rxjs';
import type {ServiceRegistry, MessageLogger} from '..';
import type {ProcessMessage, ProcessExitMessage} from 'nuclide-commons/process';

import {StreamTransport} from './StreamTransport';
import {RpcConnection} from './RpcConnection';
import {exitEventToMessage, getOutputStream} from 'nuclide-commons/process';
import {getLogger} from 'log4js';
import invariant from 'assert';
import {Subject} from 'rxjs';

const logger = getLogger('nuclide-rpc');

/**
 * A generic process wrapper around a stdio-based child process, providing a simple
 * promise-based call API. Commonly used to wrap a python (or any other language)
 * process, making it invokable through JS code.
 *
 * This class can be generalized further (to not require stdin/stdout as the communication method)
 * by having the Transport class injected, which is currently defaulted to StreamTransport.
 *
 * Child Process Implementation Notes:
 * - See Rpc.js for the JSON protocol that the child process implementation must follow.
 * - Note that stdin, stdout, and stderr must be piped, done by node by default.
 *   Don't override the stdio to close off any of these streams in the constructor opts.
 */
export class RpcProcess {
  _processStream: Observable<child_process$ChildProcess>;
  _messageLogger: MessageLogger;
  _name: string;
  _disposed: boolean;
  _process: ?child_process$ChildProcess;
  _subscription: ?Subscription;
  _serviceRegistry: ServiceRegistry;
  _rpcConnection: ?Promise<RpcConnection<StreamTransport>>;
  _disposals: Subject<void>;
  _exitMessage: Subject<?ProcessExitMessage>;

  /**
   * @param name           a name for this server, used to tag log entries
   * @param processStream  a (cold) Observable that creates processes upon subscription,
   *                       both during initialization and on restart (see spawn)
   */
  constructor(
    name: string,
    serviceRegistry: ServiceRegistry,
    processStream: Observable<child_process$ChildProcess>,
    messageLogger: MessageLogger = (direction, message) => {
      return;
    },
  ) {
    this._processStream = processStream;
    this._messageLogger = messageLogger;
    this._name = name;
    this._disposed = false;
    this._process = null;
    this._subscription = null;
    this._serviceRegistry = serviceRegistry;
    this._rpcConnection = null;
    this._disposals = new Subject();
    this._exitMessage = new Subject();
  }

  getName(): string {
    return this._name;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  async getService(serviceName: string): Promise<Object> {
    const connection = this._ensureConnection();
    return (await connection).getService(serviceName);
  }

  /**
   * Emits the exit message of the currently running process, or null on error.
   * Completes when the process finishes.
   */
  observeExitMessage(): Observable<?ProcessExitMessage> {
    return this._exitMessage.takeUntil(this._disposals);
  }

  /**
   * Ensures that the child process is available. Asynchronously creates the child process,
   * only if it is currently null.
   */
  _ensureConnection(): Promise<RpcConnection<StreamTransport>> {
    this._disposed = false;
    if (this._rpcConnection == null) {
      const processStream = this._processStream
        .do({
          error: e => {
            logger.error(`${this._name} - error spawning child process: `, e);
            this._exitMessage.next(null);
            this.dispose();
          },
        })
        .takeUntil(this._disposals)
        .publish();

      processStream
        .switchMap(proc =>
          getOutputStream(proc, {
            /* TODO(T17353599) */ isExitError: () => false,
          }),
        )
        // switchMap won't stop until the mapped observable stops.
        // Manual disposals shouldn't trigger the exit message.
        .takeUntil(this._disposals)
        .subscribe(this._onProcessMessage.bind(this));

      const connection = (this._rpcConnection = processStream
        .take(1)
        .toPromise()
        .then(proc => {
          if (proc == null) {
            throw new Error('RpcProcess disposed during getService');
          }
          this._process = proc;
          logger.info(
            `${this._name} - created child process with PID: `,
            proc.pid,
          );

          proc.stdin.on('error', error => {
            logger.error(`${this._name} - error writing data: `, error);
          });
          return new RpcConnection(
            'client',
            this._serviceRegistry,
            new StreamTransport(proc.stdin, proc.stdout, this._messageLogger),
          );
        }));

      this._subscription = processStream.connect();
      return connection;
    }
    return this._rpcConnection;
  }

  /**
   * Handles lifecycle messages from stderr, exit, and error streams,
   * responding by logging and staging for process restart.
   */
  _onProcessMessage(message: ProcessMessage): void {
    switch (message.kind) {
      case 'stdout':
        break;
      case 'stderr':
        logger.warn(
          `${this._name} - error from stderr received: `,
          message.data.toString(),
        );
        break;
      case 'exit':
        logger.error(
          `${this._name} - exited with ${exitEventToMessage(message)}`,
        );
        this._exitMessage.next(message);
        this.dispose();
        break;
      default:
        // This case should never be reached.
        invariant(
          false,
          `${this._name} - unknown message received: ${message}`,
        );
    }
  }

  /**
   * Cleans up in case of disposal or failure, clearing all pending calls,
   * and killing the child process if necessary.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    logger.info(`${this._name} - disposing connection.`);
    this._disposed = true;
    this._disposals.next();

    if (this._rpcConnection != null) {
      // If this wasn't already resolved, then it's rejected via `this._disposals`.
      this._rpcConnection
        .then(connection => connection.dispose())
        .catch(() => {});
      this._rpcConnection = null;
    }

    if (this._subscription != null) {
      // Note that this will kill the process if it is still live.
      this._subscription.unsubscribe();
      this._subscription = null;
      this._process = null;
    }
  }
}
