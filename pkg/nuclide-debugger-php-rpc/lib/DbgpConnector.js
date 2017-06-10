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

import net from 'net';
import logger from './utils';
import {Emitter} from 'event-kit';
import {DbgpMessageHandler} from './DbgpMessageHandler';
import {failConnection} from './ConnectionUtils';

import type {Socket, Server} from 'net';
/**
 * xdebugAttachPort is the port to listen for dbgp connections on.
 *
 * If present scriptRegex must be a valid RegExp. Only dbgp connections whose script
 * path matches scriptRegex will be accepted. Dbgp connections which do not match
 * the scriptRegex will be ignored.
 *
 * Similarly, the idekeyRegex filters incoming dbgp connections by idekey,
 * and pid filters connections by process id (appid in the dbgp terminology).
 * Note that 0 pid also does not filter on process id.
 */

const DBGP_ATTACH_EVENT = 'dbgp-attach-event';
const DBGP_CLOSE_EVENT = 'dbgp-close-event';
const DBGP_ERROR_EVENT = 'dbgp-error-event';

/**
 * Connect to requested dbgp debuggee on given port.
 *
 * Starts listening for socket connections on the given port.
 * Waits for dbgp init connection message for each connection.
 * If the connection matches the given pid/ideky/path then
 * resolve with the connection and stop listening for new
 * connections.
 * If the connection does not match the given pid/idekey/path
 * then close the connection and continue waiting for a match.
 */
export class DbgpConnector {
  _server: ?Server;
  _emitter: Emitter;
  _messageHandler: DbgpMessageHandler;
  _port: number;

  constructor(port: number) {
    this._server = null;
    this._emitter = new Emitter();
    this._messageHandler = new DbgpMessageHandler();
    this._port = port;
  }

  onAttach(
    callback: (params: {socket: Socket, message: Object}) => mixed,
  ): IDisposable {
    return this._emitter.on(DBGP_ATTACH_EVENT, callback);
  }

  onClose(callback: () => void): IDisposable {
    return this._emitter.on(DBGP_CLOSE_EVENT, callback);
  }

  onError(callback: (error: string) => void): IDisposable {
    return this._emitter.on(DBGP_ERROR_EVENT, callback);
  }

  listen(): void {
    logger.debug('Creating debug server on port ' + this._port);

    const server = net.createServer();

    server.on('close', socket => logger.debug('Closing port ' + this._port));
    server.listen(
      this._port,
      undefined, // Hostname.
      undefined, // Backlog -- the maximum length of the queue of pending connections.
      () => logger.debug('Listening on port ' + this._port),
    );

    server.on('error', error => this._onServerError(error));
    server.on('connection', socket => this._onSocketConnection(socket));
    server.on('close', () => {
      logger.debug('DBGP Server closed.');
    });

    this._server = server;
  }

  _onSocketConnection(socket: Socket) {
    // Xdebug encodes XML messages as iso-8859-1, which is the same as 'latin1'.
    socket.setEncoding('latin1');
    logger.debug('Connection on port ' + this._port);
    if (!this._checkListening(socket, 'Connection')) {
      return;
    }
    socket.once('data', data => this._onSocketData(socket, data));
  }

  _onServerError(error: Object): void {
    let errorMessage;
    if (error.code === 'EADDRINUSE') {
      errorMessage =
        `Can't start debugging because port ${this._port} is being used by another process. ` +
        "Try running 'killall node' on your devserver and then restarting Nuclide.";
    } else {
      errorMessage = `Unknown debugger socket error: ${error.code}.`;
    }

    logger.error(errorMessage);
    this._emitter.emit(DBGP_ERROR_EVENT, errorMessage);

    this.dispose();
  }

  _onSocketData(socket: Socket, data: Buffer | string): void {
    if (!this._checkListening(socket, 'Data')) {
      return;
    }

    let messages;
    try {
      messages = this._messageHandler.parseMessages(data.toString());
    } catch (error) {
      this._failConnection(
        socket,
        'Non XML connection string: ' +
          data.toString() +
          '. Discarding connection.',
        'PHP sent a malformed request, please file a bug to the Nuclide developers.<br />' +
          'Restarting the Nuclide Server may fix the issue.<br />' +
          'Error: Non XML connection string.',
      );
      return;
    }

    if (messages.length !== 1) {
      this._failConnection(
        socket,
        'Expected a single connection message. Got ' + messages.length,
        'PHP sent a malformed request, please file a bug to the Nuclide developers.<br />' +
          'Error: Expected a single connection message.',
      );
      return;
    }

    const message = messages[0];
    this._emitter.emit(DBGP_ATTACH_EVENT, {socket, message});
  }

  _failConnection(
    socket: Socket,
    logMessage: string,
    userMessage: string,
  ): void {
    failConnection(socket, logMessage);
    this._emitter.emit(DBGP_ERROR_EVENT, userMessage);
  }

  /**
   * Checks if listening for connections. If not then close the new socket.
   */
  _checkListening(socket: Socket, message: string): boolean {
    if (!this.isListening()) {
      logger.debug(
        'Ignoring ' +
          message +
          ' on port ' +
          this._port +
          ' after stopped connection.',
      );
      return false;
    }
    return true;
  }

  isListening(): boolean {
    return Boolean(this._server);
  }

  dispose() {
    if (this._server) {
      this._server.close();
      this._emitter.emit(DBGP_CLOSE_EVENT);
      this._server = null;
    }
  }
}
