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

import type {
  Scope,
  PropertyDescriptor,
  RemoteObjectId,
} from '../../nuclide-debugger-base/lib/protocol-types';
import type {MessageSender} from './types';

import logger from './utils';
import {launchPhpScriptWithXDebugEnabled} from './helpers';
import {Connection} from './Connection';
import {getConfig} from './config';
import {getSettings} from './settings';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

import {
  isDummyConnection,
  sendDummyRequest,
  isCorrectConnection,
  failConnection,
} from './ConnectionUtils';
import {BreakpointStore} from './BreakpointStore';
import {DbgpConnector} from './DbgpConnector';
import {
  ConnectionStatus,
  BREAKPOINT_RESOLVED_NOTIFICATION,
  COMMAND_RUN,
} from './DbgpSocket';
import {ASYNC_BREAK, BREAKPOINT, EXCEPTION} from './Connection';
import EventEmitter from 'events';
import invariant from 'assert';
import {attachEvent} from 'nuclide-commons/event';

import type {Socket} from 'net';
import type {DbgpBreakpoint} from './DbgpSocket';

const CONNECTION_MUX_STATUS_EVENT = 'connection-mux-status';
const CONNECTION_MUX_NOTIFICATION_EVENT = 'connection-mux-notification';
const DEBUGGER_CONNECT_TIMEOUT_MS = 30 * 1000;
const DEBUGGER_TEAR_DOWN_TIMEOUT_MS = 3 * 1000;

export const ConnectionMultiplexerStatus = {
  Init: 'Init',
  Running: 'Running',
  SingleConnectionPaused: 'SingleConnectionPaused',
  AllConnectionsPaused: 'AllConnectionsPaused',
  UserAsyncBreakSent: 'UserAsyncBreakSent',
  End: 'End',
};

export const ConnectionMultiplexerNotification = {
  RequestUpdate: 'RequestUpdate',
};

type DbgpError = {
  $: {
    code: number,
  },
  message: Array<string>,
};

type EvaluationFailureResult = {
  error: DbgpError,
  wasThrown: boolean,
};

// The ConnectionMultiplexer makes multiple debugger connections appear to be
// a single connection to the debugger UI.
//
// The initialization sequence occurs as follows:
//  - the constructor is called
//  - onStatus is called to hook up event handlers
//  - initial breakpoints may be added here.
//  - listen() is called indicating that all initial Breakpoints have been set
//    and debugging may commence.
//
// Once initialized, the ConnectionMultiplexer can be in one of 3 main states:
// running, break-disabled, and break-enabled.
//
// Running state means that all connections are in the running state.
// Note that running includes the state where there are no connections.
//
// Break-disabled state has at least one connection in break state.
// And none of the connections is enabled. Once in break-disabled state,
// the connection mux will immediately enable one of the broken connections
// and move to break-enabled state.
//
// Break-enabled state has a single connection which is in break-enabled
// state. There may be connections in break-disabled state and running state
// as well. The enabled connection will be shown in the debugger UI and all
// commands will go to the enabled connection.
//
// The ConnectionMultiplexer will close only if there are no connections
// and if either the attach or launch DbgpConnectors are closed. The DbgpConnectors will likely only
// close if HHVM crashes or is stopped.
export class ConnectionMultiplexer {
  _breakpointStore: BreakpointStore;
  _connectionStatusEmitter: EventEmitter;
  _status: string;
  _previousConnection: ?Connection;
  _enabledConnection: ?Connection;
  _dummyConnection: ?Connection;
  _connections: Map<number, Connection>;
  _attachConnector: ?DbgpConnector;
  _launchConnector: ?DbgpConnector;
  _dummyRequestProcess: ?child_process$ChildProcess;
  _launchedScriptProcess: ?child_process$ChildProcess;
  _launchedScriptProcessPromise: ?Promise<void>;
  _requestSwitchMessage: ?string;
  _lastEnabledConnection: ?Connection;
  _debuggerStartupDisposable: IDisposable;
  _pausePending: boolean;
  _sendOutputMessage: MessageSender;
  _sendNotificationMessage: MessageSender;

  constructor(
    sendOutputMessage: MessageSender,
    sendNotificationMessage: MessageSender,
  ) {
    this._sendOutputMessage = sendOutputMessage;
    this._sendNotificationMessage = sendNotificationMessage;
    this._status = ConnectionMultiplexerStatus.Init;
    this._connectionStatusEmitter = new EventEmitter();
    this._previousConnection = null;
    this._enabledConnection = null;
    this._dummyConnection = null;
    this._connections = new Map();
    this._attachConnector = null;
    this._launchConnector = null;
    this._dummyRequestProcess = null;
    this._breakpointStore = new BreakpointStore();
    this._launchedScriptProcess = null;
    this._launchedScriptProcessPromise = null;
    this._requestSwitchMessage = null;
    this._lastEnabledConnection = null;
    this._debuggerStartupDisposable = new UniversalDisposable();
    this._pausePending = false;
  }

  onStatus(callback: (status: string) => mixed): IDisposable {
    return attachEvent(
      this._connectionStatusEmitter,
      CONNECTION_MUX_STATUS_EVENT,
      callback,
    );
  }

  onNotification(
    callback: (status: string, params: ?Object) => mixed,
  ): IDisposable {
    return attachEvent(
      this._connectionStatusEmitter,
      CONNECTION_MUX_NOTIFICATION_EVENT,
      callback,
    );
  }

  listen(timeoutCallback: () => void): IDisposable {
    this._debuggerStartupDisposable.dispose();
    this._sendOutput(
      'Connecting and pre-loading all of your PHP types and symbols. This may take a moment, ' +
        'please wait...',
      'warning',
    );

    const {launchScriptPath, deferLaunch} = getConfig();
    if (launchScriptPath != null) {
      this._launchModeListen();
    } else {
      this._attachModeListen();
    }

    this._status = ConnectionMultiplexerStatus.Running;
    this._dummyRequestProcess = sendDummyRequest();

    if (launchScriptPath != null && !deferLaunch) {
      const expandedScript = nuclideUri.expandHomeDir(launchScriptPath);
      this._launchedScriptProcessPromise = new Promise(resolve => {
        this._launchedScriptProcess = launchPhpScriptWithXDebugEnabled(
          expandedScript,
          (text, level) => {
            this._sendOutput(text, level);
            this._checkForEnd();
            resolve();
          },
        );
      });
    }

    // If the debugger does not connect within a reasonable amount of time, tell the user.
    this._debuggerStartupDisposable = new UniversalDisposable(
      Observable.of(null)
        .delay(DEBUGGER_CONNECT_TIMEOUT_MS)
        .switchMap(() => {
          this._sendNotificationMessage(
            'Error: Timed out while trying to establish debugger connection. ' +
              'Is the webserver available?',
            'error',
          );
          return Observable.of(null).take(DEBUGGER_TEAR_DOWN_TIMEOUT_MS);
        })
        .subscribe(timeoutCallback),
    );

    return this._debuggerStartupDisposable;
  }

  _attachModeListen(): void {
    const {xdebugAttachPort, xdebugLaunchingPort} = getConfig();
    // When in attach mode we are guaranteed that the two ports are not equal.
    invariant(
      xdebugAttachPort !== xdebugLaunchingPort,
      'xdebug ports are equal in attach mode',
    );
    // In this case we need to listen for incoming connections to attach to, as well as on the
    // port that the dummy connection will use.
    this._attachConnector = this._setupConnector(
      xdebugAttachPort,
      this._disposeAttachConnector.bind(this),
    );
    this._launchConnector = this._setupConnector(
      xdebugLaunchingPort,
      this._disposeLaunchConnector.bind(this),
    );
  }

  _launchModeListen(): void {
    const {xdebugLaunchingPort} = getConfig();
    // If we are only doing script debugging, then the dummy connection listener's port can also be
    // used to listen for the script's xdebug requests.
    this._launchConnector = this._setupConnector(
      xdebugLaunchingPort,
      this._disposeLaunchConnector.bind(this),
    );
  }

  _setupConnector(port: number, onClose: () => void): DbgpConnector {
    const connector = new DbgpConnector(port);
    connector.onAttach(this._onAttach.bind(this));
    connector.onClose(onClose);
    connector.onError(this._handleAttachError.bind(this));
    connector.listen();
    return connector;
  }

  // For testing purpose.
  getDummyConnection(): ?Connection {
    return this._dummyConnection;
  }

  async _onAttach(params: {socket: Socket, message: Object}): Promise<void> {
    const {socket, message} = params;
    const isAttachConnection =
      socket.localPort === getConfig().xdebugAttachPort;
    if (!isCorrectConnection(isAttachConnection, message)) {
      failConnection(
        socket,
        'Discarding connection ' + JSON.stringify(message),
      );
      return;
    }
    await this._handleNewConnection(socket, message);
  }

  async _handleNewConnection(socket: Socket, message: Object): Promise<void> {
    const connection = new Connection(
      socket,
      this._connectionOnStatus.bind(this),
      this._handleNotification.bind(this),
      this._sendOutputMessage.bind(this),
      isDummyConnection(message),
    );
    this._connections.set(connection.getId(), connection);
    await this._handleSetupForConnection(connection);
    await this._breakpointStore.addConnection(connection);
    this._connectionOnStatus(connection, connection.getStatus());
  }

  _handleNotification(
    connection: Connection,
    notifyName: string,
    notify: Object,
  ): void {
    switch (notifyName) {
      case BREAKPOINT_RESOLVED_NOTIFICATION:
        const xdebugBreakpoint: DbgpBreakpoint = notify;
        const breakpointId = this._breakpointStore.getBreakpointIdFromConnection(
          connection,
          xdebugBreakpoint,
        );
        if (breakpointId == null) {
          logger.error(
            `Cannot find xdebug breakpoint ${JSON.stringify(
              xdebugBreakpoint,
            )} in connection.`,
          );
          break;
        }
        this._breakpointStore.updateBreakpoint(breakpointId, xdebugBreakpoint);
        const breakpoint = this._breakpointStore.getBreakpoint(breakpointId);
        this._emitNotification(BREAKPOINT_RESOLVED_NOTIFICATION, breakpoint);
        break;
      default:
        logger.error(`Unknown notify: ${notifyName}`);
        break;
    }
  }

  _shouldPauseAllConnections(): boolean {
    return (
      this._status === ConnectionMultiplexerStatus.UserAsyncBreakSent ||
      this._status === ConnectionMultiplexerStatus.AllConnectionsPaused
    );
  }

  _connectionOnStatus(
    connection: Connection,
    status: string,
    ...args: Array<string>
  ): void {
    logger.debug(
      `Mux got status: ${status} on connection ${connection.getId()}`,
    );

    this._debuggerStartupDisposable.dispose();

    switch (status) {
      case ConnectionStatus.Starting:
        // Starting status has no stack.
        // step before reporting initial status to get to the first instruction.
        // TODO: Use loader breakpoint configuration to choose between step/run.
        if (!this._shouldPauseAllConnections()) {
          connection.sendContinuationCommand(COMMAND_RUN);
        } else {
          // Debugger is in paused mode, wait for user resume.
          // Don't show starting requests in UI because:
          // 1. They do not have interesting information to users.
          // 2. They cause bounce in debugger UI.
        }
        break;
      case ConnectionStatus.Stopping:
        // TODO: May want to enable post-mortem features?
        if (this._isPaused()) {
          this._emitRequestUpdate(connection);
        }
        connection.sendContinuationCommand(COMMAND_RUN);
        return;
      case ConnectionStatus.Running:
        if (connection === this._enabledConnection) {
          this._disableConnection();
        } else if (this._isPaused()) {
          this._emitRequestUpdate(connection);
        }
        if (this._pausePending) {
          // If an async break is pending and a new connection has started,
          // we can finish honoring the Debugger.Pause instruction now.
          this.pause();
        }
        break;
      case ConnectionStatus.Break:
        // Send the preloading complete message after the dummy connection hits its first
        // breakpoint. This means all of the preloading done by the 'require' commands
        // preceding the first xdebug_break() call has completed.
        if (
          connection.isDummyConnection() &&
          connection.getBreakCount() === 1
        ) {
          this._dummyConnection = connection;
          this._sendOutput(
            'Pre-loading is done! You can use console window now.',
            'success',
          );
        }

        if (this._isPaused()) {
          // We don't want to send the first threads updated message until the debugger is
          // paused.
          this._emitRequestUpdate(connection);
        }
        break;
      case ConnectionStatus.Error:
        let message =
          'The debugger encountered a problem with one of the HHVM request connections ' +
          'and the connection had to be shut down. The debugger is still attached to any ' +
          'remaining HHVM requests.';

        if (args[0] != null) {
          message = `${message}  Error message: ${args[0]}`;
        }
        this._sendNotificationMessage(message, 'error');
        if (this._isPaused()) {
          this._emitRequestUpdate(connection);
        }
        this._removeConnection(connection);
        break;
      case ConnectionStatus.Stopped:
      case ConnectionStatus.End:
        if (this._isPaused()) {
          this._emitRequestUpdate(connection);
        }
        this._removeConnection(connection);
        break;
      case ConnectionStatus.Stdout:
        this._sendOutput(args[0], 'log');
        break;
      case ConnectionStatus.Stderr:
        this._sendOutput(args[0], 'info');
        break;
    }

    this._updateStatus();
  }

  _sendOutput(text: string, level: string): void {
    this._sendOutputMessage(text, level);
  }

  _updateStatus(): void {
    if (this._status === ConnectionMultiplexerStatus.End) {
      return;
    }

    if (
      this._status === ConnectionMultiplexerStatus.SingleConnectionPaused ||
      this._status === ConnectionMultiplexerStatus.AllConnectionsPaused
    ) {
      logger.debug('Mux already in break status');
      return;
    }

    // Now check if we can move from running to break.
    for (const connection of this._connections.values()) {
      if (this._shouldEnableConnection(connection)) {
        this._enableConnection(connection);
        break;
      }
    }
  }

  _shouldEnableConnection(connection: Connection): boolean {
    // If no connections are available and we async break, enable a connection in starting mode.
    return (
      this._isFirstStartingConnection(connection) ||
      (connection.getStatus() === ConnectionStatus.Break &&
        // Only enable connection paused by async_break if user has explicitly issued an async_break.
        (connection.getStopReason() !== ASYNC_BREAK ||
          this._status === ConnectionMultiplexerStatus.UserAsyncBreakSent) &&
        // Don't switch threads unnecessarily in single thread stepping mode.
        (!getSettings().singleThreadStepping ||
          // eslint-disable-next-line eqeqeq
          this._lastEnabledConnection === null ||
          connection === this._lastEnabledConnection) &&
        // Respect the visibility of the dummy connection.
        (!connection.isDummyConnection() || connection.isViewable()))
    );
  }

  _isFirstStartingConnection(connection: Connection): boolean {
    return (
      this._status === ConnectionMultiplexerStatus.UserAsyncBreakSent &&
      connection.getStatus() === ConnectionStatus.Starting &&
      this._connections.size === 2 && // Dummy connection + first connection.
      !connection.isDummyConnection()
    );
  }

  _enableConnection(connection: Connection): Promise<void> {
    logger.debug('Mux enabling connection');
    this._enabledConnection = connection;
    this._handlePotentialRequestSwitch(connection);
    this._lastEnabledConnection = connection;
    this._setBreakStatus();
    this._sendRequestInfo(connection);
    return this._pauseConnectionsIfNeeded();
  }

  async _pauseConnectionsIfNeeded(): Promise<void> {
    if (
      getConfig().stopOneStopAll &&
      this._status !== ConnectionMultiplexerStatus.UserAsyncBreakSent
    ) {
      return this._asyncBreak();
    }
  }

  _setBreakStatus(): void {
    this._setStatus(
      this._status === ConnectionMultiplexerStatus.UserAsyncBreakSent ||
      getConfig().stopOneStopAll
        ? ConnectionMultiplexerStatus.AllConnectionsPaused
        : ConnectionMultiplexerStatus.SingleConnectionPaused,
    );
  }

  _sendRequestInfo(connection: Connection): void {
    for (const backgroundConnection of this._connections.values()) {
      this._emitRequestUpdate(backgroundConnection);
    }
  }

  _emitRequestUpdate(connection: Connection): void {
    if (connection.isDummyConnection() && !connection.isViewable()) {
      // Only show dummy connection in requests UI if it is viewable.
      return;
    }
    this._emitNotification(ConnectionMultiplexerNotification.RequestUpdate, {
      id: connection.getId(),
      status: connection.getStatus(),
      stopReason: connection.getStopReason() || connection.getStatus(),
    });
  }

  _setStatus(status: string): void {
    if (status !== this._status) {
      this._status = status;
      this._emitStatus(status);
    }
  }

  _handlePotentialRequestSwitch(connection: Connection): void {
    if (
      this._previousConnection != null &&
      connection !== this._previousConnection
    ) {
      // The enabled connection is different than it was last time the debugger paused
      // so we know that the active request has switched so we should alert the user.
      this._requestSwitchMessage = 'Active request switched';
    }
    this._previousConnection = connection;
  }

  _handleAttachError(error: string): void {
    this._sendNotificationMessage(error, 'error');
    logger.error(`PHP debugger attach error: ${error}`);
    this._emitStatus(ConnectionMultiplexerStatus.End);
  }

  _emitStatus(status: string): void {
    this._connectionStatusEmitter.emit(CONNECTION_MUX_STATUS_EVENT, status);
  }

  _emitNotification(status: string, params: ?Object): void {
    this._connectionStatusEmitter.emit(
      CONNECTION_MUX_NOTIFICATION_EVENT,
      status,
      params,
    );
  }

  async runtimeEvaluate(expression: string): Promise<Object> {
    logger.debug(`runtimeEvaluate() on dummy connection for: ${expression}`);
    if (this._dummyConnection != null) {
      // Global runtime evaluation on dummy connection does not care about
      // which frame it is being evaluated on so choose top frame here.
      const result = await this._dummyConnection.runtimeEvaluate(0, expression);
      this._reportEvaluationFailureIfNeeded(expression, result);
      return result;
    } else {
      this._sendOutput(
        'Error evaluating expression: the console is not ready yet. Please wait...',
        'error',
      );
      throw this._noConnectionError();
    }
  }

  async evaluateOnCallFrame(
    frameIndex: number,
    expression: string,
  ): Promise<Object> {
    if (this._enabledConnection) {
      const result = await this._enabledConnection.evaluateOnCallFrame(
        frameIndex,
        expression,
      );
      this._reportEvaluationFailureIfNeeded(expression, result);
      return result;
    } else {
      throw this._noConnectionError();
    }
  }

  _reportEvaluationFailureIfNeeded(
    expression: string,
    result: EvaluationFailureResult,
  ): void {
    if (result.wasThrown) {
      this._sendOutput(
        'Failed to evaluate ' +
          `"${expression}": (${result.error.$.code}) ${result.error
            .message[0]}`,
        'error',
      );
    }
  }

  getBreakpointStore(): BreakpointStore {
    return this._breakpointStore;
  }

  removeBreakpoint(breakpointId: string): Promise<any> {
    return this._breakpointStore.removeBreakpoint(breakpointId);
  }

  async getStackFrames(): Promise<{stack: Array<Object>}> {
    if (this._enabledConnection == null) {
      // This occurs on startup with the loader breakpoint.
      return {stack: []};
    }
    const frames = await this._enabledConnection.getStackFrames();
    if (frames.stack == null) {
      // This occurs when the enabled connection is in starting mode.
      return {stack: []};
    } else {
      return frames;
    }
  }

  getConnectionStackFrames(id: number): Promise<{stack: Object}> {
    const connection = this._connections.get(id);
    if (
      connection != null &&
      connection.getStatus() === ConnectionStatus.Break
    ) {
      return connection.getStackFrames();
    } else {
      // This occurs on startup with the loader breakpoint.
      return Promise.resolve({stack: {}});
    }
  }

  getConnectionStopReason(id: number): ?string {
    const connection = this._connections.get(id);
    if (connection != null) {
      return connection.getStopReason();
    }

    return null;
  }

  getScopesForFrame(frameIndex: number): Promise<Array<Scope>> {
    if (this._enabledConnection) {
      return this._enabledConnection.getScopesForFrame(frameIndex);
    } else {
      return Promise.reject(this._noConnectionError());
    }
  }

  getStatus(): string {
    return this._status;
  }

  async sendContinuationCommand(command: string): Promise<void> {
    await this._resumeBackgroundConnections();
    if (this._enabledConnection) {
      await this._enabledConnection.sendContinuationCommand(command);
    } else {
      throw this._noConnectionError();
    }
  }

  _connectionBreakpointExits(connection: Connection): boolean {
    // Check if the breakpoint at which the specified connection is stopped
    // still exists in the breakpoint store.
    invariant(connection.getStopReason() === BREAKPOINT);
    const stopLocation = connection.getStopBreakpointLocation();
    if (stopLocation == null) {
      // If the stop location is unknown, we must behave as if the breakpoint existed
      // since we cannot confirm it doesn't, and it is unsafe to just randomly resume
      // connections. This connection could be stopped at an eval, exception or async
      // break.
      return true;
    }

    const exists = this._breakpointStore.breakpointExists(
      stopLocation.filename,
      stopLocation.lineNumber,
    );

    if (!exists) {
      logger.debug('Connection hit stale breakpoint. Resuming...');
    }

    return exists;
  }

  async _resumeBackgroundConnections(): Promise<void> {
    await Promise.all(
      Array.from(this._connections.values()).map(connection => {
        if (
          connection !== this._enabledConnection &&
          (connection.getStopReason() === ASYNC_BREAK ||
            (connection.getStopReason() === BREAKPOINT &&
              connection.getStatus() === ConnectionStatus.Break &&
              !this._connectionBreakpointExits(connection)) ||
            (connection.getStopReason() === EXCEPTION &&
              !this._breakpointStore.getPauseOnExceptions()) ||
            connection.getStatus() === ConnectionStatus.Starting)
        ) {
          try {
            connection.sendContinuationCommand(COMMAND_RUN);
          } catch (e) {
            // Connection could have been closed (or resumed by the frontend) before we resumed it.
          }
        }
      }),
    );
  }

  async _asyncBreak(): Promise<void> {
    await Promise.all(
      Array.from(this._connections.values()).map(connection => {
        if (connection.getStatus() === ConnectionStatus.Running) {
          return connection.sendBreakCommand();
        } else {
          return Promise.resolve();
        }
      }),
    );
  }

  async pause(): Promise<void> {
    if (
      this._onlyDummyRemains() &&
      (this._dummyConnection != null && !this._dummyConnection.isViewable())
    ) {
      // If only the dummy remains, and the dummy is not viewable, there are no
      // connections to break into. Since the front-end is waiting for a response
      // from at least one connection, send a message to the console to indicate
      // an async-break is pending, waiting for a request.
      this._pausePending = true;
      this._sendOutput(
        'There are no active requests to break in to! The debugger will break when a new request ' +
          'arrives.',
        'warning',
      );
    } else {
      if (this._pausePending) {
        this._sendOutput(
          'New connection received, breaking into debugger.',
          'success',
        );
      }
      this._pausePending = false;
      this._status = ConnectionMultiplexerStatus.UserAsyncBreakSent;
      // allow a connection that hasn't hit a breakpoint to be enabled, then break all connections.
      await this._asyncBreak();
    }
  }

  resume(): Promise<void> {
    // For now we will have only single thread stepping, not single thread running.
    this._lastEnabledConnection = null;
    return this.sendContinuationCommand(COMMAND_RUN);
  }

  getProperties(remoteId: RemoteObjectId): Promise<Array<PropertyDescriptor>> {
    if (this._enabledConnection) {
      return this._enabledConnection.getProperties(remoteId);
    } else if (this._dummyConnection) {
      return this._dummyConnection.getProperties(remoteId);
    } else {
      return Promise.reject(this._noConnectionError());
    }
  }

  _removeConnection(connection: Connection): void {
    connection.dispose();
    this._connections.delete(connection.getId());

    if (connection === this._enabledConnection) {
      this._disableConnection();
      this._lastEnabledConnection = null;
    }
    this._checkForEnd();
  }

  _disableConnection(): void {
    logger.debug('Mux disabling connection');
    this._enabledConnection = null;
    this._setStatus(ConnectionMultiplexerStatus.Running);
  }

  _disposeAttachConnector(): void {
    // Avoid recursion with connector's onClose event.
    const connector = this._attachConnector;
    if (connector != null) {
      this._attachConnector = null;
      connector.dispose();
    }
    this._checkForEnd();
  }

  _disposeLaunchConnector(): void {
    // Avoid recursion with connector's onClose event.
    const connector = this._launchConnector;
    if (connector != null) {
      this._launchConnector = null;
      connector.dispose();
    }
    this._checkForEnd();
  }

  async _checkForEnd(): Promise<void> {
    if (
      (this._connections.size === 0 || this._onlyDummyRemains()) &&
      (this._attachConnector == null ||
        this._launchConnector == null ||
        getConfig().endDebugWhenNoRequests)
    ) {
      if (this._launchedScriptProcessPromise != null) {
        await this._launchedScriptProcessPromise;
        this._launchedScriptProcessPromise = null;
      }

      this._setStatus(ConnectionMultiplexerStatus.End);
    }
  }

  _onlyDummyRemains(): boolean {
    return (
      this._connections.size === 1 &&
      this._dummyConnection != null &&
      this._connections.has(this._dummyConnection.getId())
    );
  }

  _noConnectionError(): Error {
    // This is an indication of a bug in the state machine.
    // .. we are seeing a request in a state that should not generate
    // that request.
    return new Error('No connection');
  }

  async _handleSetupForConnection(connection: Connection): Promise<void> {
    await this._setupStdStreams(connection);
    await this._setupFeatures(connection);
  }

  async _setupStdStreams(connection: Connection): Promise<void> {
    const stdoutRequestSucceeded = await connection.sendStdoutRequest();
    if (!stdoutRequestSucceeded) {
      logger.error('HHVM returned failure for a stdout request');
      this._sendOutput(
        'HHVM failed to redirect stdout, so no output will be sent to the output window.',
        'error',
      );
    }
    // TODO: Stderr redirection is not implemented in HHVM so we won't check this return value.
    await connection.sendStderrRequest();
  }

  async _setupFeatures(connection: Connection): Promise<void> {
    // max_depth sets the depth that the debugger engine respects when
    // returning hierarchical data.
    let setFeatureSucceeded = await connection.setFeature('max_depth', '5');
    if (!setFeatureSucceeded) {
      logger.error('HHVM returned failure for setting feature max_depth');
    }
    // show_hidden allows the client to request data from private class members.
    setFeatureSucceeded = await connection.setFeature('show_hidden', '1');
    if (!setFeatureSucceeded) {
      logger.error('HHVM returned failure for setting feature show_hidden');
    }
    // Turn on notifications.
    setFeatureSucceeded = await connection.setFeature('notify_ok', '1');
    if (!setFeatureSucceeded) {
      logger.error('HHVM returned failure for setting feature notify_ok');
    }
  }

  _isPaused(): boolean {
    return (
      this._status === ConnectionMultiplexerStatus.SingleConnectionPaused ||
      this._status === ConnectionMultiplexerStatus.AllConnectionsPaused
    );
  }

  getRequestSwitchMessage(): ?string {
    return this._requestSwitchMessage;
  }

  resetRequestSwitchMessage(): void {
    this._requestSwitchMessage = null;
  }

  getEnabledConnectionId(): ?number {
    if (this._enabledConnection != null) {
      return this._enabledConnection.getId();
    } else {
      return null;
    }
  }

  getEnabledConnection(): ?Connection {
    return this._enabledConnection;
  }

  selectThread(id: number): void {
    const connection = this._connections.get(id);
    if (
      connection != null &&
      connection.getStatus() === ConnectionStatus.Break
    ) {
      this._enabledConnection = connection;
    }
  }

  dispose(): void {
    if (this._launchedScriptProcess != null) {
      this._launchedScriptProcessPromise = null;
      this._launchedScriptProcess.kill('SIGKILL');
      this._launchedScriptProcess = null;
    }
    for (const connection of this._connections.values()) {
      this._removeConnection(connection);
    }
    if (this._dummyRequestProcess) {
      this._dummyRequestProcess.kill('SIGKILL');
    }
    this._disposeLaunchConnector();
    this._disposeAttachConnector();
  }
}
